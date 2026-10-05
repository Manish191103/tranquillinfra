/**
 * testimonial-rail.ts
 *
 * The dynamic half of the testimonial showcase. The rail itself stays a native
 * scroll container (snap points, touch drag, arrow keys, Home/End); this module
 * makes the card at its leading edge the active one, and the active card plays
 * its muted inline preview. Everything below the rail — prev/next, the segment
 * jumps, the counter and the polite status line — drives that one index, and
 * the pause toggle on the card is the WCAG 2.2.2 mechanism for the motion.
 *
 * Playback policy: the preview starts once the section is in view and the rail
 * has settled (so a flick through the cards does not fetch every clip), stops
 * when the section leaves the viewport, the tab is hidden, the card's dialog
 * opens, or the viewer pauses it. Reduced motion: nothing autoplays and the
 * jumps are instant, but the toggles still play on request. Data saver: the
 * clips are multi-megabyte, so nothing autoplays there either — the same rule
 * the hero clip follows in ../layout/image-hero-video.ts.
 *
 * Without this module the rail still scrolls and every card is a link to its
 * MP4 — the no-JS path.
 */

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** How long the rail must rest before the active preview starts (ms). */
const SETTLE_DELAY = 180;

/** Share of the showcase that must be visible before previews play. */
const VISIBLE_THRESHOLD = 0.35;

const PLAY_LABEL = 'Play the video preview';
const PAUSE_LABEL = 'Pause the video preview';

const pad = (value: number): string => String(value).padStart(2, '0');

/** Wire up every rail on the page; mounted roots are skipped on later calls. */
export function initTestimonialRails(): void {
  document.querySelectorAll<HTMLElement>('[data-testimonial-showcase]').forEach((root) => {
    if (root.dataset.testimonialRailInit === 'true') return;
    root.dataset.testimonialRailInit = 'true';
    start(root);
  });
}

function start(root: HTMLElement): void {
  const rail = root.querySelector<HTMLElement>('[data-testimonial-rail]');
  const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-testimonial-card]'));
  if (!rail || cards.length === 0) return;

  const videos = cards.map((card) =>
    card.querySelector<HTMLVideoElement>('[data-testimonial-inline]')
  );
  const toggles = cards.map((card) =>
    card.querySelector<HTMLButtonElement>('[data-testimonial-toggle]')
  );
  const segments = Array.from(
    root.querySelectorAll<HTMLButtonElement>('[data-testimonial-segment]')
  );
  const counter = root.querySelector<HTMLElement>('[data-testimonial-counter]');
  const status = root.querySelector<HTMLElement>('[data-testimonial-status]');
  const previous = root.querySelector<HTMLButtonElement>('[data-testimonial-prev]');
  const next = root.querySelector<HTMLButtonElement>('[data-testimonial-next]');

  // The dialogs the cards open; while one is open the inline previews rest.
  const dialogs = cards
    .map((card) => card.querySelector<HTMLElement>('[data-testimonial-trigger]'))
    .map((trigger) => trigger?.dataset.testimonialTrigger ?? '')
    .map((id) => document.getElementById(id))
    .filter((dialog): dialog is HTMLElement => dialog !== null);

  const reduceMotion = window.matchMedia(REDUCED_MOTION);
  /** The Network Information API's data-saver flag; absent outside Chromium. */
  type ConnectionAwareNavigator = Navigator & { connection?: { saveData?: boolean } };
  const saveData = (navigator as ConnectionAwareNavigator).connection?.saveData === true;
  const pausedByViewer = new Set<number>();

  let active = -1;
  let inView = false;
  let dialogOpen = false;
  let resumeAfterDialog = false;
  let settleTimer = 0;
  let frame = 0;
  /** Until this timestamp, scroll events are the controls' own doing. */
  let programmaticUntil = 0;

  /** Distance from one card's start to the next (width + gap). */
  const pitch = (): number => {
    if (cards.length < 2) return cards[0]?.getBoundingClientRect().width ?? rail.clientWidth;
    return Math.abs(cards[1].getBoundingClientRect().left - cards[0].getBoundingClientRect().left);
  };

  /** Scroll offset that brings a card to the rail's leading edge. */
  const cardOffset = (index: number): number => {
    const railBox = rail.getBoundingClientRect();
    return cards[index].getBoundingClientRect().left - railBox.left + rail.scrollLeft;
  };

  /** The card the manual scroll has settled on: the one nearest the lead. */
  const indexFromScroll = (): number => {
    const step = pitch();
    if (step <= 0) return 0;
    return Math.max(0, Math.min(cards.length - 1, Math.round(rail.scrollLeft / step)));
  };

  const stop = (index: number): void => {
    const video = videos[index];
    if (video && !video.paused) video.pause();
  };

  const setActive = (index: number): void => {
    if (index === active) return;
    stop(active);
    active = index;

    cards.forEach((card, cardIndex) => {
      card.setAttribute('data-testimonial-active', cardIndex === index ? 'true' : 'false');
    });
    segments.forEach((segment, segmentIndex) => {
      segment.setAttribute('aria-current', segmentIndex === index ? 'true' : 'false');
    });
    if (counter) counter.textContent = `${pad(index + 1)} / ${pad(cards.length)}`;
    if (status) {
      const name = cards[index]?.dataset.testimonialName;
      status.textContent = `Showing testimonial ${index + 1} of ${cards.length}${name ? `: ${name}` : ''}`;
    }
    if (previous) previous.disabled = index <= 0;
    if (next) next.disabled = index >= cards.length - 1;
  };

  /** Start the active preview, unless something says it must not play. */
  const playActive = (): void => {
    const video = videos[active];
    if (
      !video ||
      pausedByViewer.has(active) ||
      dialogOpen ||
      !inView ||
      reduceMotion.matches ||
      saveData
    )
      return;
    video.currentTime = 0;
    void video.play().catch(() => {
      /* Autoplay refused (data saver, iOS low power): the poster stays and the
         card's toggle starts the preview on request. */
    });
  };

  const settle = (): void => {
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(playActive, SETTLE_DELAY);
  };

  const scheduleSync = (): void => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      // The controls already know which card they asked for; only a scroll the
      // viewer made themselves moves the index.
      if (performance.now() < programmaticUntil) return;
      const index = indexFromScroll();
      if (index !== active) setActive(index);
      settle();
    });
  };

  const jumpTo = (index: number): void => {
    const target = Math.max(0, Math.min(cards.length - 1, index));
    setActive(target);
    programmaticUntil = performance.now() + 700;
    rail.scrollTo({
      left: cardOffset(target),
      behavior: reduceMotion.matches ? 'auto' : 'smooth',
    });
    settle();
  };

  /** Pull a card into the rail without moving the page. */
  const revealCard = (index: number): void => {
    const railBox = rail.getBoundingClientRect();
    const cardBox = cards[index].getBoundingClientRect();
    if (cardBox.left >= railBox.left && cardBox.right <= railBox.right) return;
    programmaticUntil = performance.now() + 700;
    cards[index].scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: reduceMotion.matches ? 'auto' : 'smooth',
    });
  };

  rail.addEventListener('scroll', scheduleSync, { passive: true });
  window.addEventListener('resize', scheduleSync);

  previous?.addEventListener('click', () => jumpTo(active - 1));
  next?.addEventListener('click', () => jumpTo(active + 1));
  segments.forEach((segment, index) => {
    segment.addEventListener('click', () => jumpTo(index));
  });

  toggles.forEach((toggle, index) => {
    toggle?.addEventListener('click', () => {
      const video = videos[index];
      if (!video) return;

      if (video.paused) {
        pausedByViewer.delete(index);
        if (index !== active) {
          setActive(index);
          revealCard(index);
        }
        video.currentTime = 0;
        void video.play().catch(() => {});
      } else {
        pausedByViewer.add(index);
        video.pause();
      }
    });
  });

  // The card reflects what the video element is actually doing, whichever path
  // started or stopped it (toggle, activation, dialog, visibility, settings).
  videos.forEach((video, index) => {
    if (!video) return;
    const finished = () => {
      toggles[index]?.setAttribute('aria-pressed', 'false');
      toggles[index]?.setAttribute('aria-label', PLAY_LABEL);
      cards[index]?.setAttribute('data-testimonial-playing', 'false');
    };

    video.addEventListener('playing', () => {
      toggles[index]?.setAttribute('aria-pressed', 'true');
      toggles[index]?.setAttribute('aria-label', PAUSE_LABEL);
      cards[index]?.setAttribute('data-testimonial-playing', 'true');
    });
    video.addEventListener('pause', finished);
    video.addEventListener('ended', finished);
  });

  dialogs.forEach((dialog) => {
    dialog.addEventListener('dialog:open', () => {
      dialogOpen = true;
      const video = videos[active];
      resumeAfterDialog = Boolean(video && !video.paused);
      stop(active);
    });

    dialog.addEventListener('dialog:closed', () => {
      dialogOpen = false;
      if (resumeAfterDialog) playActive();
      resumeAfterDialog = false;
    });
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting === inView) return;
          inView = entry.isIntersecting;
          if (inView) playActive();
          else stop(active);
        });
      },
      { threshold: VISIBLE_THRESHOLD }
    );
    observer.observe(root);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(active);
    else if (inView) playActive();
  });

  reduceMotion.addEventListener('change', () => {
    if (reduceMotion.matches) stop(active);
    else if (inView) playActive();
  });

  setActive(0);
}
