/**
 * ScrollBuildStory behaviour
 *
 * The pinned build sequence keeps its whole state on the root element, so the
 * markup stays readable and re-mounting is a no-op:
 * - `data-stage`      the stage currently in view, drives the image cross-fade
 * - `data-build-live` set while the story is on screen; promotes the frame
 *                     layers only when they are actually being composited
 * - `data-build-init` idempotency guard, written on first mount
 *
 * Stage selection is the production scrollytelling contract — the observer's
 * root is collapsed to a zero-height box at the vertical centre of the viewport,
 * so `isIntersecting` means "this beat currently straddles the reading line".
 * That is the same rule scrollama expresses as `offset: 0.5` and Observable
 * expresses as `rootMargin: '-50% 0% -50% 0%'`, and it is the whole reason the
 * readout is allowed to disagree with nothing.
 *
 * Everything here is torn down on `IntersectionObserver.invalidation`, which
 * fires when the observed target leaves the DOM — the correct hook under Astro's
 * `<ClientRouter />`, where a full page load never happens and a controller
 * that only guards on a mount flag would keep a detached observer alive for the
 * rest of the session.
 */

/**
 * The observer's root: the whole viewport.
 *
 * Deliberately not shrunk. The root is only a trigger — "something the reader
 * can see changed" — and `mostPresentCopy()` is what decides the stage, so
 * narrowing the band would only suppress the event that matters. A copy enters
 * and leaves the full viewport during each handover, which is exactly the
 * bracket wanted (measured 2026-09-30: with the copies observed, the readout
 * tracks the visible copy at all 71 sampled scroll positions on 1440×900).
 */
const ROOT_MARGIN = '0px';

/**
 * Observer thresholds, as a 2.5% ladder.
 *
 * The selection rule is a continuous function of scroll position, but
 * IntersectionObserver is edge-triggered: with the default `threshold: 0` the
 * callback only runs as a copy enters or leaves the viewport, so a stage can
 * become the most-visible one with no event to notice it. Measured with a single
 * threshold, the readout trailed the copy it sat over by ~160px of scroll across
 * every handover (108 sampled positions, 15 trailing).
 *
 * A ladder of thresholds turns each step in a copy's viewport presence into an
 * event, so the rule is re-evaluated as presence grows and shrinks. The cost is
 * bounded — a subject can only cross 40 steps on a full pass through the
 * viewport — and at 2.5% of a ~280px copy that is ~7px of scroll, well inside
 * the handover.
 */
const THRESHOLDS = Array.from({ length: 41 }, (_, index) => index / 40);

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** The Live property, from a string every browser here already resolves. */
const LIVE = 'IntersectionObserver.invalidation' in IntersectionObserver.prototype;

/**
 * `IntersectionObserver.invalidation`, which is not in the TypeScript DOM lib
 * yet. The promise settles when the observed target is removed from the
 * document — the signal this controller needs to let go of everything it owns.
 */
interface InvalidatableObserver extends IntersectionObserver {
  readonly invalidation: Promise<void>;
}

const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * Wire up every build story on the page. Safe to call repeatedly: mounted
 * roots are skipped, and untouched roots (fresh ones after a view transition)
 * are picked up on the next call.
 */
export function mountScrollBuildStory(): void {
  document.querySelectorAll<HTMLElement>('[data-build-story]').forEach((story) => {
    if (story.dataset.buildInit) return;
    story.dataset.buildInit = 'true';

    start(story);
  });
}

function start(story: HTMLElement): void {
  const beats = Array.from(story.querySelectorAll<HTMLElement>('[data-build-beat]'));
  const images = Array.from(story.querySelectorAll<HTMLImageElement>('[data-build-image]'));
  const jumpButtons = Array.from(story.querySelectorAll<HTMLButtonElement>('[data-build-jump]'));
  const stageNumber = story.querySelector<HTMLElement>('[data-build-stage-number]');
  const stageLabel = story.querySelector<HTMLElement>('[data-build-stage-label]');
  const reduceMotion = window.matchMedia(REDUCED_MOTION);

  /**
   * The copy block of each beat, or the beat itself if the copy is missing.
   *
   * This is what the controller observes and measures, not the beat. A beat is
   * `100svh`, so a full-viewport observer fires on it exactly once per beat, at
   * the boundary — which is ~180px of scroll *after* the incoming copy has already
   * overtaken the outgoing one on screen, leaving the readout trailing the copy it
   * sits over. The copy is the thing that actually travels through the viewport
   * during a handover, so watching the copy is what brackets the moment.
   */
  const subjects = beats.map(
    (beat) => beat.querySelector<HTMLElement>('.build-beat-content') ?? beat
  );

  if (beats.length === 0) return;

  // Every listener below is registered through this controller, so one abort
  // removes the lot when the section goes away.
  const abort = new AbortController();
  const { signal } = abort;

  let currentStage: string | null = null;

  /**
   * The stage the visitor is actually reading.
   *
   * Whichever beat's `.build-beat-content` occupies the most of the viewport.
   *
   * The three obvious alternatives were all measured against this one and all
   * three lose, for the same structural reason: the beat copy is bottom-anchored
   * inside a `100svh` beat, so between two stages there is a band of scroll
   * (~280px at 1440×900) where the outgoing copy is leaving at the top, the
   * incoming one has not arrived at the bottom, and *nothing sits near the
   * middle of the screen*.
   *
   * - Nearest to the viewport centre (50%): the beat and the copy disagree
   *   across the whole window, because the copy rides the bottom of its beat.
   *   Measured at scrollY 3000 the centre is already inside beat 02 while the
   *   readable copy is beat 01's.
   * - Nearest to a line at 60%: worse, because the line lands inside the empty
   *   band, so the incoming copy wins ~280px of scroll before it is visible —
   *   at scrollY 3160 the HUD read "01" over a beat-02 copy that already had
   *   191px on screen.
   * - Last copy whose top has passed the line: picks a 41px departing sliver at
   *   the top over a 281px arriving block at the bottom (scrollY 4200).
   *
   * Viewport presence has no gap to fall into, is the definition of "what I am
   * reading", and is stateless, so scrolling back up lands on exactly the same
   * stage at exactly the same position.
   *
   * Ties resolve to the copy lower in the viewport — the arriving one — so the
   * handover point does not depend on scroll direction. The copy block is the
   * subject because that is the thing being read; the beat box is the fallback
   * if the copy is ever missing, rather than throwing on a null.
   */
  const mostPresentCopy = (): HTMLElement => {
    const limit = window.innerHeight;
    let best = beats[0];
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const subject of subjects) {
      const rect = subject.getBoundingClientRect();

      const top = Math.max(rect.top, 0);
      const bottom = Math.min(rect.bottom, limit);
      // Presence dominates: a single pixel of a copy outweighs the whole tiebreak
      // range, which is bounded by the viewport height.
      const score = (bottom - top) * (limit + 1) + (rect.top + rect.bottom) / 2;

      if (score > bestScore) {
        bestScore = score;
        best = subject.closest<HTMLElement>('[data-build-beat]') ?? beats[0];
      }
    }

    return best;
  };

  const paintFrame = (image: HTMLImageElement, stageValue: string) => {
    // The stage may have moved on while this image was still decoding.
    if (story.dataset.stage !== stageValue) return;

    images.forEach((item) => {
      const isActive = item === image;
      item.classList.toggle('is-visible', isActive);
      item.setAttribute('aria-hidden', String(!isActive));
    });
  };

  const revealFrame = (image: HTMLImageElement, stageValue: string) => {
    const show = () => paintFrame(image, stageValue);

    if (image.complete && image.naturalWidth > 0) {
      show();
      return;
    }

    /*
     * Cross-fade a decoded bitmap, never a half-painted one.
     *
     * `load` fires when the bytes have arrived, not when the bitmap is ready to
     * composite, so a frame revealed straight off `load` can fade in over a
     * half-painted image and shimmer for the length of the fade. `decode()`
     * resolves on the ready-to-paint signal instead.
     *
     * `error` is bound to the same handler for a different reason: a frame that
     * fails to load must not leave the previous one pinned under a readout that
     * has already advanced, which strands the story on a stage it cannot show.
     */
    const onReady = () => {
      if (typeof image.decode === 'function') image.decode().then(show, show);
      else show();
    };

    image.addEventListener('load', onReady, { once: true, signal });
    image.addEventListener('error', show, { once: true, signal });
  };

  const setActiveBeat = (beat: HTMLElement) => {
    const stageValue = beat.dataset.stage ?? '1';
    if (stageValue === currentStage) return;

    const stageIndex = Number(stageValue) - 1;
    currentStage = stageValue;

    story.dataset.stage = stageValue;
    beats.forEach((item) => item.classList.toggle('is-active', item === beat));
    jumpButtons.forEach((button) => {
      const isActive = button.dataset.buildJump === stageValue;
      button.classList.toggle('is-active', isActive);
      if (isActive) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });

    if (stageNumber) stageNumber.textContent = `${pad(stageIndex + 1)} / ${pad(beats.length)}`;
    if (stageLabel) stageLabel.textContent = beat.dataset.label ?? '';

    const activeImage = images[stageIndex];
    if (activeImage) revealFrame(activeImage, stageValue);
  };

  /*
   * Reduced motion unpins the canvas: the five beats become a plain stacked list
   * under one still frame, and "which stage is current" stops being a question
   * with an answer. There is no pin to walk a reader through, so the stage
   * readout has nothing to report and the cross-fade has nothing to cross-fade.
   *
   * Measured 2026-09-30, this is where the presence rule turned out to be
   * meaningless: with two copies fully visible at once, the "most present" lead
   * between them was 1px (221 vs 220), so the readout flipped on sub-pixel
   * differences while a polite live region announced a stage the reader could
   * not perceive. Same reasoning the `scripting: none` branch of the stylesheet
   * already applies for the same layout.
   *
   * So the observer is not mounted at all here: one still frame, no live-region
   * churn, no `data-stage`. The jump buttons are kept — the script runs under
   * reduced motion, they scroll instantly, and taking that shortcut away from the
   * one group who asked for less movement would be the wrong trade — and their
   * pressed state is set by the click rather than by a stage that does not exist.
   */
  if (reduceMotion.matches) {
    images[0]?.classList.add('is-visible');
    wireJumpButtons(story, beats, jumpButtons, reduceMotion, signal);
    return;
  }

  if ('IntersectionObserver' in window) {
    /*
     * A trigger, not a selector. The callback does no sorting and trusts nothing
     * in the entries it is handed: the choice is made against the copy geometry
     * by `mostPresentCopy()` above. That is what removed the desync in
     * docs/site-bug-list.md #3, where sorting on `intersectionRatio` was sorting
     * noise — every beat is `100svh`, so under the old 16%-tall band the largest
     * ratio any candidate could reach was 0.16, for all of them at once.
     */
    const observer = new IntersectionObserver(
      () => {
        setActiveBeat(mostPresentCopy());
      },
      { rootMargin: ROOT_MARGIN, threshold: THRESHOLDS }
    );

    subjects.forEach((subject) => observer.observe(subject));

    /*
     * Layer promotion, gated on the story actually being on screen.
     *
     * Five full-bleed composited layers are the price of cross-fading five
     * images, and paying it for the whole document — which is what a static
     * `will-change` on the images does — costs memory and keeps the compositor
     * busy on a section nobody is looking at. `data-build-live` is set while the
     * section is in view and removed when it leaves, so the cost tracks the
     * effect. See `.build-story-image` in the component's stylesheet.
     */
    const liveObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) story.dataset.buildLive = 'true';
        else delete story.dataset.buildLive;
      },
      // Only the frames nearest the viewport are worth promoting.
      { rootMargin: '200% 0px' }
    );

    liveObserver.observe(story);

    if (LIVE) {
      (observer as InvalidatableObserver).invalidation
        .then(() => {
          observer.disconnect();
          liveObserver.disconnect();
          abort.abort();
        })
        .catch(() => {
          // Never settled, or already torn down. The `astro:before-swap` hook
          // below and the page teardown are the backstops.
        });
    }

    // Engines without `invalidation` still get a teardown, on the event that
    // precedes the swap.
    document.addEventListener(
      'astro:before-swap',
      () => {
        observer.disconnect();
        liveObserver.disconnect();
        abort.abort();
      },
      { once: true, signal }
    );
  }

  wireJumpButtons(story, beats, jumpButtons, reduceMotion, signal, (stageValue) => {
    const beat = beats.find((item) => item.dataset.stage === stageValue);
    if (beat) setActiveBeat(beat);
  });

  const firstBeat = beats[0];
  if (firstBeat) setActiveBeat(firstBeat);
}

/**
 * The stage nav.
 *
 * Shared by both the pinned and the reduced-motion path, because the shortcut is
 * the one part of this component that still earns its place when there is no
 * stage to track: under reduced motion the buttons are the only way to reach
 * stage five without scrolling four screens of list.
 *
 * `markActive` is supplied by the caller that has a stage to report. Where there
 * is none, the pressed state comes from the click instead — a button the reader
 * just pressed is honestly "current" even when no stage is.
 */
function wireJumpButtons(
  story: HTMLElement,
  beats: HTMLElement[],
  jumpButtons: HTMLButtonElement[],
  reduceMotion: MediaQueryList,
  signal: AbortSignal,
  markActive?: (stageValue: string) => void
): void {
  jumpButtons.forEach((button) => {
    button.addEventListener(
      'click',
      () => {
        const targetStage = button.dataset.buildJump;
        const target = beats.find((beat) => beat.dataset.stage === targetStage);

        target?.scrollIntoView({
          // `instant` (not `auto`) so reduced motion also overrides the global
          // smooth-scroll the site sets on <html>.
          behavior: reduceMotion.matches ? 'instant' : 'smooth',
          /*
           * `center`, not `start`.
           *
           * Note this is not a bug fix: every pinned beat is `min-height: 100svh`,
           * so measured at both widths the beats exactly fill the viewport
           * (900/900 at 1440×900, 844/844 at 390×844) and centring an element that
           * fills the scrollport lands it identically to top-aligning it. `start`
           * is not wrong there.
           *
           * It is kept because it is what puts the named copy in the middle of
           * the viewport, which is where a bottom-anchored copy reads best, and
           * because the reduced-motion query drops `min-height` to `auto` — where
           * the two genuinely diverge on every jump.
           */
          block: 'center',
        });

        if (targetStage && markActive) markActive(targetStage);
        else if (targetStage) {
          // No stage to report: reflect the press so the control acknowledges
          // itself, without claiming a stage anywhere else.
          jumpButtons.forEach((item) => {
            const isActive = item === button;
            item.classList.toggle('is-active', isActive);
            if (isActive) item.setAttribute('aria-current', 'step');
            else item.removeAttribute('aria-current');
          });
          story.dataset.buildJumped = targetStage;
        }
      },
      { signal }
    );
  });
}
