/**
 * testimonial-player.ts
 *
 * Upgrades a testimonial card into a dialog player. The card is an <a> to the
 * MP4, so playback is reachable without this module; with it, activation opens
 * the shared Dialog (see Dialog.astro), starts playback — the click is the user
 * gesture — and the dialog's `dialog:closed` event pauses and rewinds so audio
 * never outlives the dialog.
 */

type DialogElement = HTMLElement & { open?: () => void; close?: () => void };

export function initTestimonialPlayers() {
  document.querySelectorAll<HTMLAnchorElement>('[data-testimonial-trigger]').forEach((trigger) => {
    if (trigger.dataset.testimonialInit) return;
    trigger.dataset.testimonialInit = 'true';

    const dialog = document.getElementById(
      trigger.dataset.testimonialTrigger ?? ''
    ) as DialogElement | null;
    const video = dialog?.querySelector<HTMLVideoElement>('[data-testimonial-video]');
    if (!dialog || !video) return;

    trigger.addEventListener('click', (event) => {
      // Modifier clicks keep the browser's behaviour (open or save the MP4).
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      event.preventDefault();
      dialog.open?.();
      void video.play().catch(() => {});
    });

    dialog.addEventListener('dialog:closed', () => {
      video.pause();
      video.currentTime = 0;
    });
  });
}
