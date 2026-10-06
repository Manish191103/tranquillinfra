/**
 * Announcement bar behaviour, shared by every bar on the page.
 *
 * One message at a time, auto-rotation on the bar's `data-interval`, and
 * previous/pause/next/dismiss controls. Rotation holds while the visitor is
 * interacting with the bar — pointer press, hover or focus — so a link cannot
 * be swapped out from under a finger between touch-down and touch-up on the
 * topmost element of every page. It stops under `prefers-reduced-motion` (the
 * pause control is hidden there).
 *
 * The hold is released at window level: a press whose release lands outside
 * the bar — a drag-select that leaves the band, a finger lifted over the hero
 * — never delivers `pointerup` to the bar, and a hold that outlives its
 * gesture used to stall rotation until reload. Tab switches release too.
 */

/** Geometry/timer cleanup, so no rotation outlives its page. */
const teardowns = new WeakMap<HTMLElement, () => void>();

export function initAnnouncementBars(): void {
  document.querySelectorAll<HTMLElement>('[data-announcement-bar]').forEach((bar) => {
    if (bar.dataset.announcementInit) return;
    bar.dataset.announcementInit = 'true';

    const messages = Array.from(bar.querySelectorAll<HTMLElement>('[data-announcement-message]'));
    if (messages.length === 0) return;

    const liveRegion = bar.querySelector<HTMLElement>('[data-announcement-live]');
    const storageKey = bar.dataset.storageKey || 'tq-announcement-dismissed';

    // Already dismissed: the inline script has hidden the bar; nothing to bind.
    try {
      if (sessionStorage.getItem(storageKey) === 'true') return;
    } catch {
      /* Storage can be unavailable in privacy-restricted browsers. */
    }

    const interval = Number(bar.dataset.interval) || 18000;
    const previousButton = bar.querySelector<HTMLButtonElement>('[data-announcement-prev]');
    const pauseButton = bar.querySelector<HTMLButtonElement>('[data-announcement-pause]');
    const nextButton = bar.querySelector<HTMLButtonElement>('[data-announcement-next]');
    const dismissButton = bar.querySelector<HTMLButtonElement>('[data-announcement-dismiss]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    let currentIndex = 0;
    let paused = reducedMotion.matches;
    let interacting = false;
    let timer: number | undefined;

    /**
     * Hand the region over to the visitor.
     *
     * The bar ships `aria-live="off"`. Rotation is not a change the visitor
     * asked for and a polite region has no way to tell an unsolicited
     * announcement from a wanted one, so a bar that rotates on a timer is
     * only allowed to announce once somebody has touched it — pressed a step
     * control, or moved focus into it. From that moment it is the polite
     * region it was always meant to be, and a manual change is announced.
     * Setting it once is enough; `aria-live` does not need to be armed per
     * announcement.
     */
    const armLiveRegion = () => {
      liveRegion?.setAttribute('aria-live', 'polite');
    };

    const showMessage = (index: number) => {
      currentIndex = (index + messages.length) % messages.length;
      messages.forEach((message, messageIndex) => {
        message.classList.toggle('is-active', messageIndex === currentIndex);
      });
    };

    const stopTimer = () => {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };

    const startTimer = () => {
      stopTimer();
      if (!paused && !interacting && messages.length > 1) {
        timer = window.setInterval(() => showMessage(currentIndex + 1), interval);
      }
    };

    // A press anywhere in the bar holds the rotation until it is released:
    // the visitor's target must not move between touch-down and touch-up.
    // Focus and hover hold it for the same reason.
    const hold = () => {
      interacting = true;
      stopTimer();
    };

    // Guarded release: without a hold there is nothing to release, and a
    // window-level release that unconditionally restarted the timer would
    // reset the countdown on every pointerup anywhere on the page.
    const release = () => {
      if (!interacting) return;
      interacting = false;
      startTimer();
    };

    const abort = new AbortController();
    const { signal } = abort;

    // The press itself binds on the bar, but the release binds on `window`:
    // a pointer that ends over the hero or past the edge of the band never
    // dispatches `pointerup` to the bar. `release` is guarded, so releases
    // without a matching press are no-ops.
    bar.addEventListener('pointerdown', hold, { signal });
    window.addEventListener('pointerup', release, { signal });
    window.addEventListener('pointercancel', release, { signal });
    window.addEventListener('blur', release, { signal });

    bar.addEventListener(
      'focusin',
      () => {
        armLiveRegion();
        hold();
      },
      { signal }
    );
    bar.addEventListener('focusout', release, { signal });

    // Hover only where it is real: a tap synthesizes mouse events on touch
    // screens and would leave the bar paused for the rest of the visit.
    if (window.matchMedia('(hover: hover)').matches) {
      bar.addEventListener('mouseenter', hold, { signal });
      bar.addEventListener('mouseleave', release, { signal });
    }

    previousButton?.addEventListener(
      'click',
      () => {
        armLiveRegion();
        stopTimer();
        showMessage(currentIndex - 1);
        startTimer();
      },
      { signal }
    );

    nextButton?.addEventListener(
      'click',
      () => {
        armLiveRegion();
        stopTimer();
        showMessage(currentIndex + 1);
        startTimer();
      },
      { signal }
    );

    pauseButton?.addEventListener(
      'click',
      () => {
        paused = !paused;
        armLiveRegion();
        const pauseIcon = pauseButton.querySelector<HTMLElement>(
          '[data-announcement-pause-icon]'
        );
        const playIcon = pauseButton.querySelector<HTMLElement>('[data-announcement-play-icon]');
        if (pauseIcon) pauseIcon.hidden = paused;
        if (playIcon) playIcon.hidden = !paused;
        pauseButton.setAttribute(
          'aria-label',
          paused ? 'Resume announcements' : 'Pause announcements'
        );
        pauseButton.setAttribute('aria-pressed', String(paused));
        startTimer();
      },
      { signal }
    );

    if (reducedMotion.matches && pauseButton) {
      pauseButton.hidden = true;
    }

    dismissButton?.addEventListener(
      'click',
      () => {
        document.documentElement.dataset.announcementDismissed = '';
        stopTimer();
        abort.abort();
        try {
          sessionStorage.setItem(storageKey, 'true');
        } catch {
          /* Storage can be unavailable in privacy-restricted browsers. */
        }
      },
      { signal }
    );

    startTimer();

    teardowns.set(bar, () => {
      stopTimer();
      abort.abort();
      teardowns.delete(bar);
    });
  });
}

export function teardownAnnouncementBars(): void {
  document.querySelectorAll<HTMLElement>('[data-announcement-bar]').forEach((bar) => {
    teardowns.get(bar)?.();
  });
}
