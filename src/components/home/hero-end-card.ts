/**
 * hero-end-card.ts
 *
 * Both home hero clips end on a Tranquill City logo card (it fades in at
 * END_CARD_IN and out before the loop restarts). While it is up, the copy
 * panel is raised as well, so the headline lands with the logo; for the rest
 * of the fly-over the panel stays clear and the plots show through.
 *
 * The footage clip is the clock — the after clip is kept in sync with it by
 * hero-view-switch.ts — and `data-end-card` on the hero drives the CSS.
 */

/** Seconds into the clip where the logo starts to fade in (render.py T_IN). */
const END_CARD_IN = 7.4;
/** Seconds where it has faded back out, just before the 10 s loop. */
const END_CARD_OUT = 9.9;

/** Mount every hero with a clip; mounted roots are skipped. */
export function initHeroEndCard(): void {
  document.querySelectorAll<HTMLElement>('[data-image-hero]').forEach((hero) => {
    if (hero.dataset.heroEndCardInit === 'true') return;
    const footage = hero.querySelector<HTMLVideoElement>('[data-hero-video]');
    if (!footage) return;
    hero.dataset.heroEndCardInit = 'true';

    const update = (): void => {
      const t = footage.currentTime;
      if (t >= END_CARD_IN && t < END_CARD_OUT) hero.dataset.endCard = 'on';
      else delete hero.dataset.endCard;
    };
    footage.addEventListener('timeupdate', update);
    footage.addEventListener('seeked', update);
  });
}
