/**
 * hero-view-switch.ts
 *
 * The After / Today switch on the home hero, opening on After. Both clips
 * are the same drone fly-over — the footage, and a render of the finished development made from
 * it — so the after clip is laid over the footage and kept on the footage's
 * clock: choosing "After" seeks it to the footage's timestamp and the two then
 * play, pause and loop together.
 *
 * The footage stays the master. image-hero-video.ts owns its playback gates
 * (load, reduced motion, data saver, off-screen, the viewer's pause), and this
 * module only mirrors the footage's `playing` / `pause` onto the after clip, so
 * every one of those gates covers both. The after clip is not fetched until a
 * viewer asks for it.
 */

/** Seek the after clip when it drifts further than this from the footage. */
const MAX_DRIFT_S = 0.25;

/** Mount every hero that carries an after clip; mounted roots are skipped. */
export function initHeroViewSwitch(): void {
  document.querySelectorAll<HTMLElement>('[data-image-hero]').forEach((hero) => {
    if (hero.dataset.heroViewInit === 'true') return;
    const footage = hero.querySelector<HTMLVideoElement>('[data-hero-video]');
    const after = hero.querySelector<HTMLVideoElement>('[data-hero-video-after]');
    if (!footage || !after) return;
    hero.dataset.heroViewInit = 'true';
    start(hero, footage, after);
  });
}

function start(hero: HTMLElement, footage: HTMLVideoElement, after: HTMLVideoElement): void {
  const buttons = hero.querySelectorAll<HTMLButtonElement>('[data-hero-view]');
  const note = hero.querySelector<HTMLElement>('[data-hero-media-note]');
  const showingAfter = (): boolean => hero.dataset.heroView === 'after';

  const sync = (): void => {
    if (Math.abs(after.currentTime - footage.currentTime) > MAX_DRIFT_S) {
      after.currentTime = footage.currentTime;
    }
  };

  const follow = (): void => {
    if (!showingAfter()) return;
    sync();
    if (footage.paused) after.pause();
    else
      void after.play().catch(() => {
        /* Refused: the footage stays on screen under the hidden layer. */
      });
  };

  const choose = (view: 'today' | 'after'): void => {
    hero.dataset.heroView = view;
    buttons.forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.heroView === view))
    );
    if (note) note.textContent = (view === 'after' ? note.dataset.noteAfter : note.dataset.noteToday) ?? '';
    if (view === 'after') {
      if (after.preload === 'none') after.preload = 'auto';
      follow();
    } else {
      after.pause();
    }
  };

  buttons.forEach((button) =>
    button.addEventListener('click', () => choose(button.dataset.heroView === 'after' ? 'after' : 'today'))
  );

  // The layer shows once the after clip has a frame to show: playing alongside
  // the footage, or seeked to the paused footage's frame.
  after.addEventListener('loadeddata', () => {
    sync();
    hero.dataset.afterState = 'ready';
  });

  // The server renders the hero on its opening view (After); fetch that clip
  // with the footage so it is ready when playback starts.
  choose(showingAfter() ? 'after' : 'today');

  footage.addEventListener('playing', follow);
  footage.addEventListener('pause', () => after.pause());
  footage.addEventListener('seeked', follow);
  footage.addEventListener('timeupdate', () => {
    if (showingAfter() && !after.paused) sync();
  });
}
