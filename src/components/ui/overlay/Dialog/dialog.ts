/**
 * Dialog runtime for `Dialog.astro`.
 *
 * The markup is inert until this module mounts it. `open()`/`close()` are
 * attached to the dialog element itself, `window.openDialog(id, trigger?)` /
 * `window.closeDialog(id)` stay for inline handlers and sibling scripts
 * (`ConsentBanner`, the component gallery), and `dialog:open` / `dialog:closed`
 * let media inside a dialog react (the testimonial player pauses on close).
 *
 * What the markup cannot carry on its own:
 * - **Background inertness.** Every sibling along the path from the dialog up to
 *   `<html>` goes `inert` while it is open — the whole page except the dialog's
 *   own ancestor chain — so Tab, a screen reader's browse mode and the pointer
 *   cannot reach the content behind, wherever the dialog happens to be rendered.
 * - **A single scroll lock.** `html[data-scroll-lock]` (the rule the mobile menu
 *   shares through its own attribute), counted, so a dialog that closes while
 *   another is open cannot unlock the page.
 * - **Escape and Tab on `document`, for the top-most dialog only.** A backdrop
 *   click leaves focus outside the panel, where a panel-bound key listener
 *   never sees the key; Tab from outside pulls focus back into the panel.
 * - **Focus restore from the trigger.** `open(trigger)` remembers the element
 *   that was clicked — Safari does not focus links on click, so
 *   `document.activeElement` alone would lose the restoration target.
 */

type DialogElement = HTMLElement & {
  open?: (trigger?: HTMLElement) => void;
  close?: (instant?: boolean) => void;
};

declare global {
  interface Window {
    /** Open a dialog by element id; `trigger` is where focus returns on close. */
    openDialog?: (id: string, trigger?: HTMLElement) => void;
    closeDialog?: (id: string) => void;
  }
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Elements that render nothing (or are tooling): never made inert. */
const NON_CONTENT_TAGS: Record<string, true> = {
  SCRIPT: true,
  STYLE: true,
  TEMPLATE: true,
  LINK: true,
  HEAD: true,
  'ASTRO-DEV-TOOLBAR': true,
};

/** Open dialogs, oldest first. Only the last one owns Escape and Tab. */
const openDialogs: DialogElement[] = [];

/** Scroll-lock holders: a counter, so overlapping dialogs cannot unlock early. */
let scrollLocks = 0;

function lockScroll(): void {
  scrollLocks += 1;
  document.documentElement.setAttribute('data-scroll-lock', '');
}

function unlockScroll(): void {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) document.documentElement.removeAttribute('data-scroll-lock');
}

/**
 * Everything to inert while `dialog` is open: the siblings of every element on
 * the path from the dialog up to `<html>`. That is the whole page except the
 * dialog's own ancestor chain, so it does not matter where the dialog is
 * rendered — inside `<main>` leaves the page content beside it inert without
 * inerting the dialog itself. Restoring uses the recorded previous value, so an
 * element some other component already made inert stays that way.
 */
function backgroundElements(dialog: HTMLElement): { element: HTMLElement; wasInert: boolean }[] {
  const background: { element: HTMLElement; wasInert: boolean }[] = [];

  for (let node: HTMLElement | null = dialog; node?.parentElement; node = node.parentElement) {
    for (const sibling of node.parentElement.children) {
      if (sibling === node || !(sibling instanceof HTMLElement)) continue;
      if (NON_CONTENT_TAGS[sibling.tagName]) continue;
      background.push({ element: sibling, wasInert: sibling.inert });
    }
  }

  return background;
}

function focusableElements(panel: HTMLElement | null): HTMLElement[] {
  return Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []).filter(
    (element) => !element.hasAttribute('disabled')
  );
}

let globalHandlersBound = false;

/** Escape and the focus trap: one document listener for the top-most dialog. */
function bindGlobalHandlers(): void {
  if (globalHandlersBound) return;
  globalHandlersBound = true;

  document.addEventListener('keydown', (event) => {
    const dialog = openDialogs[openDialogs.length - 1];
    if (!dialog) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      dialog.close?.();
      return;
    }

    if (event.key !== 'Tab') return;

    const panel = dialog.querySelector<HTMLElement>('[data-dialog-panel]');
    const focusable = focusableElements(panel);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    // Focus outside the panel (a backdrop click leaves it on `body`) re-enters
    // at the edge the visitor is moving towards.
    const outside = !panel?.contains(document.activeElement);

    if (event.shiftKey) {
      if (outside || document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else if (outside || document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

function mount(dialog: DialogElement): void {
  if (dialog.dataset.dialogInit === 'true') return;
  dialog.dataset.dialogInit = 'true';

  const backdrop = dialog.querySelector<HTMLElement>('[data-dialog-backdrop]');
  const panel = dialog.querySelector<HTMLElement>('[data-dialog-panel]');
  const closeButtons = dialog.querySelectorAll('[data-dialog-close]');

  let isOpen = false;
  let restoreFocus: HTMLElement | null = null;
  let inerted: { element: HTMLElement; wasInert: boolean }[] = [];

  function open(trigger?: HTMLElement): void {
    if (isOpen) return;
    isOpen = true;

    restoreFocus = trigger ?? (document.activeElement as HTMLElement | null);
    inerted = backgroundElements(dialog);
    for (const { element } of inerted) element.inert = true;

    openDialogs.push(dialog);
    lockScroll();
    dialog.classList.remove('hidden');

    requestAnimationFrame(() => {
      backdrop?.classList.add('opacity-100');
      panel?.classList.remove('scale-95', 'opacity-0');
      panel?.classList.add('scale-100', 'opacity-100');

      // The first focusable is the close button, so a form dialog marks the
      // field a visitor should land on.
      const target =
        panel?.querySelector<HTMLElement>('[data-dialog-autofocus]') ?? focusableElements(panel)[0];
      target?.focus();
    });

    // Bubbles so document-level listeners (e.g. the mobile menu) can react.
    dialog.dispatchEvent(new CustomEvent('dialog:open', { bubbles: true }));
  }

  function close(instant = false): void {
    if (!isOpen) return;
    isOpen = false;

    // Fires at the start of the close so media stops before the 200 ms hide.
    dialog.dispatchEvent(new CustomEvent('dialog:closed', { bubbles: true }));

    const index = openDialogs.indexOf(dialog);
    if (index !== -1) openDialogs.splice(index, 1);
    unlockScroll();
    for (const { element, wasInert } of inerted) element.inert = wasInert;
    inerted = [];

    backdrop?.classList.remove('opacity-100');
    panel?.classList.add('scale-95', 'opacity-0');
    panel?.classList.remove('scale-100', 'opacity-100');

    // `instant` is the `astro:before-swap` path: the element is about to be
    // replaced, so there is nothing to animate and no focus to restore.
    if (instant) {
      dialog.classList.add('hidden');
      restoreFocus = null;
      return;
    }

    setTimeout(() => {
      // Reopened during the 200 ms fade: the dialog stays visible, and its own
      // close will schedule the hide.
      if (isOpen) return;
      dialog.classList.add('hidden');
      restoreFocus?.focus();
      restoreFocus = null;
    }, 200);
  }

  dialog.open = open;
  dialog.close = close;

  closeButtons.forEach((button) => button.addEventListener('click', () => close()));
  backdrop?.addEventListener('click', () => close());
}

/** Mount every dialog on the page; safe to re-run after a view-transition swap. */
export function initDialogs(): void {
  bindGlobalHandlers();
  document.querySelectorAll<DialogElement>('[data-dialog]').forEach(mount);
}

export function openDialog(id: string, trigger?: HTMLElement): void {
  (document.getElementById(id) as DialogElement | null)?.open?.(trigger);
}

export function closeDialog(id: string): void {
  (document.getElementById(id) as DialogElement | null)?.close?.();
}

/**
 * Instant teardown for `astro:before-swap`: the dialog elements are replaced by
 * the incoming page, so neither the inert set nor the scroll lock may outlive
 * the page that opened the dialog.
 */
export function resetDialogs(): void {
  for (const dialog of [...openDialogs].reverse()) dialog.close?.(true);
}

// Inline handlers (`onclick="openDialog('demo-dialog')"`) and sibling scripts
// (the consent banner) reach the runtime through the window.
window.openDialog = openDialog;
window.closeDialog = closeDialog;
