import type { ImageMetadata } from 'astro';

/**
 * Hero carousel controller.
 *
 * Design rule: DOM state is synchronous and authoritative; motion is a
 * fire-and-forget Web Animations effect. Nothing here awaits a frame, a decode
 * or a media load — an earlier implementation awaited `img.decode()` in the
 * middle of a slide change, and a decode promise that never settled (any tab
 * that stops painting) left the transition flag stuck at `true` and the whole
 * control dead: no autoplay, no dots, no keyboard, no console error.
 *
 * Poster variants stay lazy: a slide's `data-carousel-poster*` attributes are
 * applied only when that slide is being shown or is next up, so the initial
 * load still fetches just the LCP slide.
 *
 * Astro is imported for types only, so the pure helpers below stay importable
 * from a plain unit-test process.
 */

const TRANSITION_MS = 720;
const FADE_MS = 240;
const PRELOAD_DELAY_MS = 1200;
const EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';

export type CarouselDirection = 1 | -1;

/** One carousel slide. Lives beside the component so callers can type their
 *  data without importing the `.astro` file. */
export type CarouselSlide = {
  id: string;
  title: string;
  caption: string;
  alt: string;
  poster: ImageMetadata;
  src?: string;
  mobileSrc?: string;
};

/** Wrap any index into `[0, total)`. Exported as the test seam for the maths below. */
export function normalizeIndex(index: number, total: number): number {
  return total > 0 ? ((index % total) + total) % total : 0;
}

/** Shortest path: `1` enters from the right, `-1` from the left. Ties go forward. */
export function resolveDirection(from: number, to: number, total: number): CarouselDirection {
  if (total <= 0) return 1;
  return (to - from + total) % total <= total / 2 ? 1 : -1;
}

/**
 * Transform keyframes for one slide change. The incoming slide starts off the far
 * side and settles at 0; the outgoing slide starts where it is and leaves the
 * opposite way — so the two travel together and tile the frame instead of
 * exposing the media background between them. Both ends of a pair must differ,
 * or the slide simply parks.
 */
export function slideKeyframes(direction: CarouselDirection, kind: 'in' | 'out'): string[] {
  return kind === 'in'
    ? [`translateX(${direction * 100}%)`, 'translateX(0%)']
    : ['translateX(0%)', `translateX(${-direction * 100}%)`];
}

/**
 * Resolve a completed pointer gesture into a slide direction. A gesture counts
 * when it travels at least `thresholdPx` horizontally and its horizontal
 * component clearly dominates the vertical one — otherwise the finger was
 * scrolling the page or tapping, and the carousel must not move. A leftward
 * swipe (negative dx) advances, matching the button direction. Exported as the
 * test seam alongside the index maths.
 */
export function resolveSwipe(
  start: { x: number; y: number },
  end: { x: number; y: number },
  thresholdPx = 48
): CarouselDirection | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) < thresholdPx || Math.abs(dx) <= Math.abs(dy) * 1.5) return null;
  return dx < 0 ? 1 : -1;
}

type Slide = {
  element: HTMLElement;
  clipId: string;
  title: string;
  caption: string;
  video: HTMLVideoElement | null;
  poster: HTMLImageElement | null;
  posterSrc?: string;
  posterSrcset?: string;
  posterSizes?: string;
  videoPoster?: string;
  prepared: boolean;
};

function collectSlides(carousel: HTMLElement): Slide[] {
  return Array.from(carousel.querySelectorAll<HTMLElement>('[data-carousel-slide]')).map(
    (element) => {
      const poster = element.querySelector<HTMLImageElement>('img[data-carousel-poster]');
      const video = element.querySelector<HTMLVideoElement>('[data-carousel-video]');
      const posterSrc = poster?.dataset.carouselPoster;
      const videoPoster = video?.dataset.poster;

      return {
        element,
        clipId: element.dataset.clipId ?? '',
        title: element.dataset.clipTitle ?? 'Cinematic view',
        caption: element.dataset.clipCaption ?? '',
        video,
        poster,
        posterSrc,
        posterSrcset: poster?.dataset.carouselPosterSrcset,
        posterSizes: poster?.dataset.carouselPosterSizes,
        videoPoster,
        prepared: !posterSrc && !videoPoster,
      };
    }
  );
}

/** Hand a deferred poster to the browser. `srcset`/`sizes` go first so the `src`
 *  assignment cannot start an oversized request that `srcset` then replaces. */
function prepareSlide(slide: Slide | undefined, eager: boolean): void {
  if (!slide || slide.prepared) return;
  slide.prepared = true;

  if (slide.poster && slide.posterSrc) {
    slide.poster.loading = eager ? 'eager' : 'lazy';
    if (slide.posterSrcset) slide.poster.srcset = slide.posterSrcset;
    if (slide.posterSizes) slide.poster.sizes = slide.posterSizes;
    slide.poster.src = slide.posterSrc;
    slide.poster.removeAttribute('data-carousel-poster');
    slide.poster.removeAttribute('data-carousel-poster-srcset');
    slide.poster.removeAttribute('data-carousel-poster-sizes');
  }

  if (slide.video && slide.videoPoster) {
    slide.video.poster = slide.videoPoster;
    slide.video.removeAttribute('data-poster');
  }
}

export function mountCarousel(carousel: HTMLElement): void {
  // Re-running after a page swap or a duplicate `astro:page-load` must not stack
  // a second set of timers and listeners on the same element.
  if (carousel.dataset.carouselInit) return;
  carousel.dataset.carouselInit = 'true';

  const slides = collectSlides(carousel);
  if (slides.length < 2) return;

  const dots = Array.from(carousel.querySelectorAll<HTMLButtonElement>('[data-carousel-dot]'));
  const prevButton = carousel.querySelector<HTMLButtonElement>('[data-carousel-prev]');
  const nextButton = carousel.querySelector<HTMLButtonElement>('[data-carousel-next]');
  const playButton = carousel.querySelector<HTMLButtonElement>('[data-carousel-play]');
  const soundButton = carousel.querySelector<HTMLButtonElement>('[data-carousel-sound]');
  const rotationButton = carousel.querySelector<HTMLButtonElement>('[data-carousel-rotation]');
  const titleNode = carousel.querySelector<HTMLElement>('[data-carousel-title]');
  const captionNode = carousel.querySelector<HTMLElement>('[data-carousel-caption]');
  const indexNode = carousel.querySelector<HTMLElement>('[data-carousel-index]');
  const statusNode = carousel.querySelector<HTMLElement>('[data-carousel-status]');
  const playIcon = carousel.querySelector<HTMLElement>('[data-play-icon]');
  const soundIcon = carousel.querySelector<HTMLElement>('[data-sound-icon]');
  const rotationIcon = carousel.querySelector<HTMLElement>('[data-rotation-icon]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Rotation is opt-in: the `autoplay` prop renders as `data-autoplay` in ms and
  // anything that is not a positive number ("false", "", missing) leaves it off.
  const autoplayAttr = Number(carousel.dataset.autoplay);
  const autoplayMs = Number.isFinite(autoplayAttr) && autoplayAttr > 0 ? autoplayAttr : 0;

  let current = Math.max(
    0,
    slides.findIndex((slide) => slide.element.classList.contains('is-active'))
  );
  let autoplayTimer: number | undefined;
  let interactionPaused = false;
  let isVisible = true;
  let videoWanted = !reducedMotion.matches;
  let rotationPaused = false;
  const running = new Map<HTMLElement, Animation[]>();
  const leaving = new Map<Slide, number>();

  const cancelAnimations = (element: HTMLElement) => {
    for (const animation of running.get(element) ?? []) animation.cancel();
    running.delete(element);
  };

  /** Drop the "leaving" state and its animation. Safe to call repeatedly. */
  const settle = (slide: Slide | undefined) => {
    if (!slide) return;
    cancelAnimations(slide.element);
    slide.element.classList.remove('is-leaving');
  };

  const animate = (element: HTMLElement, direction: CarouselDirection, kind: 'in' | 'out') => {
    if (reducedMotion.matches) return;
    cancelAnimations(element);
    const entering = kind === 'in';
    const effects: Animation[] = [
      element.animate(
        slideKeyframes(direction, kind).map((transform) => ({ transform })),
        { duration: TRANSITION_MS, easing: EASING, fill: 'none' }
      ),
    ];
    // The incoming slide fades in over the outgoing one; the outgoing slide stays
    // fully opaque for the whole slide so the two images tile without a gap
    // (a CSS transition cannot do this without a style-recalc dance, which is
    // what made the old choreography fragile).
    if (entering) {
      effects.push(
        element.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: FADE_MS,
          easing: 'ease',
          fill: 'none',
        })
      );
    }
    running.set(element, effects);
  };

  const syncCopy = () => {
    const slide = slides[current];
    if (titleNode) titleNode.textContent = slide.title;
    if (captionNode) captionNode.textContent = slide.caption;
    if (indexNode) {
      indexNode.textContent = `${String(current + 1).padStart(2, '0')} / ${String(
        slides.length
      ).padStart(2, '0')}`;
    }
    if (statusNode) statusNode.textContent = `Showing ${slide.title}`;
  };

  const syncDots = () => {
    dots.forEach((dot, index) => {
      const isActive = index === current;
      dot.classList.toggle('is-active', isActive);
      dot.setAttribute('aria-selected', String(isActive));
      dot.tabIndex = isActive ? 0 : -1;
    });
  };

  const syncControls = () => {
    if (!playButton) return;
    const video = slides[current].video;
    const playing = Boolean(video && !video.paused && !video.ended);
    playButton.setAttribute('aria-pressed', String(playing));
    playButton.setAttribute(
      'aria-label',
      playing ? 'Pause cinematic video' : 'Play cinematic video'
    );
    if (playIcon) playIcon.textContent = playing ? 'Ⅱ' : '▶';
  };

  const syncRotation = () => {
    if (!rotationButton) return;
    rotationButton.setAttribute('aria-pressed', String(!rotationPaused));
    rotationButton.setAttribute(
      'aria-label',
      rotationPaused ? 'Resume rotation' : 'Pause rotation'
    );
    if (rotationIcon) rotationIcon.textContent = rotationPaused ? '↻' : '❚❚';
  };

  const stopAutoplay = () => {
    if (autoplayTimer !== undefined) {
      window.clearInterval(autoplayTimer);
      autoplayTimer = undefined;
    }
  };

  const playVideo = (slide: Slide | undefined) => {
    const video = slide?.video;
    if (!video) {
      syncControls();
      return;
    }
    video.muted = soundButton?.getAttribute('aria-pressed') !== 'true';
    void video.play().then(syncControls).catch(syncControls);
  };

  const pauseVideo = (slide: Slide | undefined) => {
    const video = slide?.video;
    if (!video || video.paused) return;
    video.pause();
  };

  const startAutoplay = () => {
    stopAutoplay();
    if (autoplayMs <= 0 || rotationPaused) return;
    if (reducedMotion.matches || document.hidden || !isVisible) return;
    if (interactionPaused) return;
    autoplayTimer = window.setInterval(() => {
      if (document.hidden || !isVisible || interactionPaused || reducedMotion.matches) return;
      go(current + 1);
    }, autoplayMs);
  };

  const go = (target: number) => {
    const next = normalizeIndex(target, slides.length);
    if (next === current) return;

    const direction = resolveDirection(current, next, slides.length);
    const outgoing = slides[current];
    const incoming = slides[next];

    // State first: this is what the widget is, with or without frames.
    current = next;
    stopAutoplay();
    for (const [slide, timer] of leaving) {
      window.clearTimeout(timer);
      settle(slide);
    }
    leaving.clear();
    settle(outgoing);
    outgoing.element.classList.remove('is-active');
    outgoing.element.classList.add('is-leaving');
    outgoing.element.setAttribute('aria-hidden', 'true');
    outgoing.element.inert = true;
    incoming.element.classList.add('is-active');
    incoming.element.classList.remove('is-leaving');
    incoming.element.removeAttribute('aria-hidden');
    incoming.element.inert = false;

    pauseVideo(outgoing);
    prepareSlide(incoming, true);
    prepareSlide(slides[normalizeIndex(next + 1, slides.length)], false);
    if (videoWanted) playVideo(incoming);
    syncControls();

    syncCopy();
    syncDots();
    animate(incoming.element, direction, 'in');
    animate(outgoing.element, direction, 'out');
    leaving.set(
      outgoing,
      window.setTimeout(() => {
        settle(outgoing);
        // The incoming slide's effect has played out; dropping it keeps the
        // compositor free for the next change.
        cancelAnimations(incoming.element);
        leaving.delete(outgoing);
      }, TRANSITION_MS + 80)
    );
    startAutoplay();
  };

  dots.forEach((dot, index) =>
    dot.addEventListener('click', () => {
      go(index);
    })
  );

  prevButton?.addEventListener('click', () => go(current - 1));
  nextButton?.addEventListener('click', () => go(current + 1));

  // Swipe: a completed horizontal pointer gesture triggers the same animated
  // slide change as the buttons — no finger-tracking drag, per the motion rule
  // above. The media's `touch-action: pan-y` keeps vertical scrolling native;
  // resolveSwipe's axis guard rejects taps and vertical scrolls, and gestures
  // that begin on a control stay with the control.
  const gestureArea = carousel.querySelector<HTMLElement>('.carousel-media') ?? carousel;
  const swipeStart = { x: 0, y: 0, pointerId: -1 };

  gestureArea.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if ((event.target as HTMLElement | null)?.closest('button, a')) return;
    swipeStart.x = event.clientX;
    swipeStart.y = event.clientY;
    swipeStart.pointerId = event.pointerId;
    interactionPaused = true;
    stopAutoplay();
    try {
      gestureArea.setPointerCapture(event.pointerId);
    } catch {
      // A pointer that is already gone cannot be captured; the gesture still
      // works uncaptured because pointerup normally lands on the same element.
    }
  });

  gestureArea.addEventListener('pointerup', (event) => {
    if (event.pointerId !== swipeStart.pointerId) return;
    swipeStart.pointerId = -1;
    // A mouse drag that ends while the cursor is still over the carousel must
    // not restart autoplay the way leaving the pointer would.
    if (event.pointerType !== 'mouse' || !carousel.matches(':hover')) {
      interactionPaused = false;
      startAutoplay();
    }
    const direction = resolveSwipe(
      { x: swipeStart.x, y: swipeStart.y },
      { x: event.clientX, y: event.clientY }
    );
    if (direction !== null) go(current + direction);
  });

  gestureArea.addEventListener('pointercancel', () => {
    // Leave `interactionPaused` as the enter/leave pair set it: on touch the
    // trailing pointerleave resets it, and a mouse that cancelled mid-gesture
    // is still hovering.
    swipeStart.pointerId = -1;
  });

  playButton?.addEventListener('click', () => {
    const video = slides[current].video;
    if (!video) return;
    if (!video.paused && !video.ended) {
      videoWanted = false;
      pauseVideo(slides[current]);
    } else {
      videoWanted = true;
      playVideo(slides[current]);
    }
    syncControls();
  });

  soundButton?.addEventListener('click', () => {
    const video = slides[current].video;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    soundButton.setAttribute('aria-label', nextMuted ? 'Turn sound on' : 'Turn sound off');
    soundButton.setAttribute('aria-pressed', String(!nextMuted));
    if (soundIcon) soundIcon.textContent = nextMuted ? '♪' : '◖';
  });

  rotationButton?.addEventListener('click', () => {
    rotationPaused = !rotationPaused;
    syncRotation();
    if (rotationPaused) stopAutoplay();
    else startAutoplay();
  });

  carousel.addEventListener('keydown', (event) => {
    const key = event.key;
    const inTablist =
      (event.target as HTMLElement | null)?.closest('[data-carousel-dots]') !== null;
    const handled =
      key === 'ArrowLeft' ||
      key === 'ArrowRight' ||
      (inTablist && (key === 'Home' || key === 'End'));
    if (!handled) return;
    event.preventDefault();
    if (key === 'ArrowLeft') go(current - 1);
    else if (key === 'ArrowRight') go(current + 1);
    else if (key === 'Home') go(0);
    else go(slides.length - 1);
    dots[current]?.focus({ preventScroll: true });
  });

  carousel.addEventListener('pointerenter', () => {
    interactionPaused = true;
    stopAutoplay();
  });
  carousel.addEventListener('pointerleave', () => {
    interactionPaused = false;
    startAutoplay();
  });
  carousel.addEventListener('focusin', () => {
    interactionPaused = true;
    stopAutoplay();
  });
  carousel.addEventListener('focusout', () => {
    window.setTimeout(() => {
      if (carousel.matches(':focus-within') || carousel.matches(':hover')) return;
      interactionPaused = false;
      startAutoplay();
    }, 0);
  });

  // Capture phase: a failing <source> fires `error` on the <source> element, not
  // on the <video>, and those events do not bubble.
  carousel.addEventListener(
    'error',
    (event) => {
      const target = event.target as HTMLElement | null;
      const element = target?.closest?.('[data-carousel-slide]') as HTMLElement | null;
      if (!element) return;
      const index = slides.findIndex((slide) => slide.element === element);
      if (index < 0) return;
      const slide = slides[index];
      if (target instanceof HTMLVideoElement || target?.tagName === 'SOURCE') {
        slide.video?.remove();
        slide.video = null;
      }
      syncControls();
      if (index === current) go(current + 1);
    },
    true
  );

  slides.forEach((slide) => {
    const video = slide.video;
    if (!video) return;
    video.addEventListener('play', syncControls);
    video.addEventListener('pause', syncControls);
    video.addEventListener('ended', syncControls);
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        isVisible = entry.isIntersecting;
        if (entry.isIntersecting) {
          if (videoWanted && !reducedMotion.matches) playVideo(slides[current]);
          startAutoplay();
          return;
        }
        stopAutoplay();
        pauseVideo(slides[current]);
      },
      { threshold: 0.35 }
    );
    observer.observe(carousel);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAutoplay();
      pauseVideo(slides[current]);
      syncControls();
      return;
    }
    if (videoWanted && !reducedMotion.matches) playVideo(slides[current]);
    startAutoplay();
  });

  reducedMotion.addEventListener?.('change', () => {
    if (reducedMotion.matches) {
      stopAutoplay();
      pauseVideo(slides[current]);
      videoWanted = false;
      syncControls();
      return;
    }
    videoWanted = true;
    startAutoplay();
  });

  prepareSlide(slides[current], true);
  syncCopy();
  syncDots();
  syncControls();
  syncRotation();
  startAutoplay();

  // Warm the next poster once the page is quiet: the first change is then
  // instant without spending the initial load budget on it.
  const preloadNext = () => prepareSlide(slides[normalizeIndex(current + 1, slides.length)], false);
  if (document.readyState === 'complete') window.setTimeout(preloadNext, PRELOAD_DELAY_MS);
  else
    window.addEventListener('load', () => window.setTimeout(preloadNext, PRELOAD_DELAY_MS), {
      once: true,
    });
}

export function mountCarousels(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-carousel]').forEach(mountCarousel);
}
