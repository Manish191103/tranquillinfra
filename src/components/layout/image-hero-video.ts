/**
 * image-hero-video.ts
 *
 * The background clip on the shared `ImageHero` shell. The still under the
 * video is the whole hero until playback actually starts, and this module is
 * what starts it: the server renders the <video> muted, inline and unstarted
 * (`preload="none"`, no `autoplay`), and playback waits for the window `load`
 * event so the still stays the LCP element. Automatic playback needs every gate
 * open — no `prefers-reduced-motion`, no `navigator.connection.saveData`, tab
 * visible, hero in view — and each automatic stop (scrolled past, tab hidden,
 * setting flipped, consent sheet raised) re-arms them on the way back. The
 * toggle is the WCAG 2.2.2 pause mechanism: it always plays on request,
 * including under reduced motion, and a viewer's pause is never overridden by
 * an automatic path.
 *
 * The fade and the button follow the element, not the intent: state is written
 * from the `playing`/`pause` events, so a refused `play()` (iOS low power,
 * data saver) leaves the still showing and the button reading "Play".
 */

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const PLAY_LABEL = 'Play background video';
const PAUSE_LABEL = 'Pause background video';

/** The data saver flag lives on the Network Information API, which this
 *  DOM lib does not declare; Chromium ships it, other engines leave it absent. */
type ConnectionAwareNavigator = Navigator & { connection?: { saveData?: boolean } };

/** Mount every hero on the page; already-mounted roots are skipped. */
export function initImageHeroVideos(): void {
  document.querySelectorAll<HTMLElement>('[data-image-hero]').forEach((hero) => {
    if (hero.dataset.heroVideoInit === 'true') return;
    const video = hero.querySelector<HTMLVideoElement>('[data-hero-video]');
    if (!video) return;
    hero.dataset.heroVideoInit = 'true';
    start(hero, video);
  });
}

function start(hero: HTMLElement, video: HTMLVideoElement): void {
  const toggle = hero.querySelector<HTMLButtonElement>('[data-hero-video-toggle]');
  const reduceMotion = window.matchMedia(REDUCED_MOTION);
  const saveData = (navigator as ConnectionAwareNavigator).connection?.saveData === true;

  // The consent sheet and its settings dialog sit above the controls while
  // they are up, and the sheet slides in half a second after load — behind a
  // clip that is already playing. Nothing runs underneath them; dismissing
  // either re-arms the gates. Both elements are absent when consent UI is off.
  const consentBanner = document.getElementById('consent-banner');
  const consentSettings = document.getElementById('consent-settings');
  const overlayCovering = (): boolean =>
    consentBanner?.classList.contains('consent-banner--visible') === true ||
    (consentSettings !== null && !consentSettings.classList.contains('hidden'));

  let ready = document.readyState === 'complete';
  let inView = false;
  let pausedByViewer = false;

  /** Automatic playback needs every gate open; a viewer's pause is final. */
  const mayAutoplay = (): boolean =>
    ready &&
    inView &&
    !pausedByViewer &&
    !document.hidden &&
    !overlayCovering() &&
    !reduceMotion.matches &&
    !saveData;

  const play = (): void => {
    void video.play().catch(() => {
      /* Refused (iOS low power, data saver): the still stays, no error state. */
    });
  };

  const attempt = (): void => {
    if (mayAutoplay()) play();
  };

  if (!ready) {
    window.addEventListener(
      'load',
      () => {
        ready = true;
        attempt();
      },
      { once: true }
    );
  }

  toggle?.addEventListener('click', () => {
    if (video.paused) {
      pausedByViewer = false;
      play();
    } else {
      pausedByViewer = true;
      video.pause();
    }
  });

  video.addEventListener('playing', () => {
    hero.dataset.videoState = 'playing';
    toggle?.setAttribute('aria-pressed', 'true');
    toggle?.setAttribute('aria-label', PAUSE_LABEL);
  });

  const rest = (): void => {
    delete hero.dataset.videoState;
    toggle?.setAttribute('aria-pressed', 'false');
    toggle?.setAttribute('aria-label', PLAY_LABEL);
  };
  video.addEventListener('pause', rest);
  video.addEventListener('ended', rest);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting === inView) return;
          inView = entry.isIntersecting;
          if (inView) attempt();
          else video.pause();
        });
      },
      { threshold: 0 }
    ).observe(hero);
  } else {
    inView = true;
    attempt();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) video.pause();
    else attempt();
  });

  reduceMotion.addEventListener('change', () => {
    if (reduceMotion.matches) video.pause();
    else attempt();
  });

  const overlays = [consentBanner, consentSettings].filter(
    (element): element is HTMLElement => element !== null
  );
  if (overlays.length > 0) {
    const observer = new MutationObserver(() => {
      if (overlayCovering()) video.pause();
      else attempt();
    });
    overlays.forEach((element) =>
      observer.observe(element, { attributes: true, attributeFilter: ['class'] })
    );
  }
}
