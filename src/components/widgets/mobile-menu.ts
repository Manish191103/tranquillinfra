/**
 * Mobile menu behavior for the site header.
 *
 * Owns the open/closed state, the ARIA wiring, the page scroll lock, and the
 * panel's geometry: `--mobile-nav-top` (the offset below the sticky header that
 * sizes the panel) and `--header-height` (used by the base `scroll-margin-top`
 * rule so in-page anchors land below the chrome).
 *
 * Wired from `Header.astro`. `resetMobileMenu()` runs on `astro:before-swap` so
 * the scroll lock and `inert` never outlive the page that opened the menu.
 */

const DESKTOP_QUERY = '(min-width: 60rem)';
const OPEN_ATTRIBUTE = 'data-mobile-menu-open';

interface MenuRefs {
  panel: HTMLElement;
  button: HTMLElement;
  menuIcon: Element | null;
  closeIcon: Element | null;
}

/** Geometry listeners exist only while the menu is open. */
const geometrySessions = new WeakMap<HTMLElement, () => void>();

function getMenuRefs(header: HTMLElement): MenuRefs | null {
  const { menuId, buttonId } = header.dataset;
  if (!menuId || !buttonId) return null;
  const panel = document.getElementById(menuId);
  const button = document.getElementById(buttonId);
  if (!panel || !button) return null;
  return {
    panel,
    button,
    menuIcon: button.querySelector('.menu-icon'),
    closeIcon: button.querySelector('.close-icon'),
  };
}

function isHeaderMenuOpen(header: HTMLElement): boolean {
  return getMenuRefs(header)?.panel.dataset.open === 'true';
}

function forEachHeader(callback: (header: HTMLElement) => void): void {
  document.querySelectorAll<HTMLElement>('header[data-menu-id]').forEach(callback);
}

/**
 * Publishes the panel offset from the header's padding-box bottom, so it agrees
 * with the panel's `top: 100%` and its bottom edge lands on the viewport edge.
 */
function syncHeaderGeometry(header: HTMLElement): void {
  const rect = header.getBoundingClientRect();
  const borderBottom = Number.parseFloat(getComputedStyle(header).borderBottomWidth) || 0;
  header.style.setProperty('--mobile-nav-top', `${Math.ceil(rect.bottom - borderBottom)}px`);
  document.documentElement.style.setProperty(
    '--header-height',
    `${Math.ceil(header.offsetHeight)}px`
  );
}

/** Everything the panel covers while open stops taking focus. */
const PAGE_CONTENT_SELECTOR = 'main, footer, [data-mobile-contact-bar]';

function startGeometrySession(header: HTMLElement): void {
  if (geometrySessions.has(header)) return;
  const announcement = document.querySelector<HTMLElement>('[data-announcement-bar]');
  const abort = new AbortController();
  const sync = () => syncHeaderGeometry(header);
  sync();

  window.addEventListener('resize', sync, { passive: true, signal: abort.signal });
  // Insurance for platforms where the scroll lock leaks (e.g. iOS Safari).
  window.addEventListener('scroll', sync, { passive: true, signal: abort.signal });

  const resizeObserver = new ResizeObserver(sync);
  resizeObserver.observe(header);
  // The announcement bar sits above the header, so a collapse there moves the
  // panel offset without a header resize of its own.
  if (announcement) resizeObserver.observe(announcement);

  geometrySessions.set(header, () => {
    abort.abort();
    resizeObserver.disconnect();
    geometrySessions.delete(header);
  });
}

function openHeaderMenu(header: HTMLElement): void {
  const refs = getMenuRefs(header);
  if (!refs || refs.panel.dataset.open === 'true') return;
  const { panel, button, menuIcon, closeIcon } = refs;

  syncHeaderGeometry(header);
  panel.dataset.open = 'true';
  panel.setAttribute('aria-hidden', 'false');
  panel.inert = false;
  button.setAttribute('aria-expanded', 'true');
  button.setAttribute('aria-label', 'Close navigation menu');
  menuIcon?.classList.add('hidden');
  closeIcon?.classList.remove('hidden');
  document.documentElement.setAttribute(OPEN_ATTRIBUTE, '');
  document
    .querySelectorAll<HTMLElement>(PAGE_CONTENT_SELECTOR)
    .forEach((element) => (element.inert = true));
  startGeometrySession(header);
}

function closeHeaderMenu(header: HTMLElement, restoreFocus = false): void {
  const refs = getMenuRefs(header);
  if (!refs || refs.panel.dataset.open !== 'true') return;
  const { panel, button, menuIcon, closeIcon } = refs;

  geometrySessions.get(header)?.();
  panel.dataset.open = 'false';
  panel.setAttribute('aria-hidden', 'true');
  panel.inert = true;
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', 'Open navigation menu');
  menuIcon?.classList.remove('hidden');
  closeIcon?.classList.add('hidden');
  document.documentElement.removeAttribute(OPEN_ATTRIBUTE);
  document
    .querySelectorAll<HTMLElement>(PAGE_CONTENT_SELECTOR)
    .forEach((element) => (element.inert = false));
  if (restoreFocus) button.focus();
}

/**
 * Document-level bindings are installed once per page context: the header
 * element is replaced on every view-transition navigation, so per-element
 * bindings would otherwise accumulate on `document` and `window`.
 */
function bindGlobalListeners(): void {
  const scope = window as Window & { __tqHeaderMenus?: boolean };
  if (scope.__tqHeaderMenus) return;
  scope.__tqHeaderMenus = true;

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    forEachHeader((header) => {
      if (isHeaderMenuOpen(header)) closeHeaderMenu(header, true);
    });
  });

  // A dialog opened from the mobile contact bar or the enquiry dialog must not
  // stack over an open menu panel — close the panel first.
  document.addEventListener('dialog:open', () => {
    forEachHeader((header) => {
      if (isHeaderMenuOpen(header)) closeHeaderMenu(header);
    });
  });

  // Leaving the compact range closes the menu, so the desktop header never
  // renders with a stale open state.
  window.matchMedia(DESKTOP_QUERY).addEventListener('change', (event) => {
    if (!event.matches) return;
    forEachHeader((header) => {
      if (isHeaderMenuOpen(header)) closeHeaderMenu(header);
    });
  });
}

/**
 * Instant close for `astro:before-swap`: no focus handling, no animation wait —
 * the page that opened the menu is about to be replaced.
 */
export function resetMobileMenu(): void {
  forEachHeader((header) => {
    if (isHeaderMenuOpen(header)) closeHeaderMenu(header);
  });
}

export function initMobileMenu(): void {
  bindGlobalListeners();
  forEachHeader((header) => {
    if (header.dataset.menuInit === 'true') return;
    const refs = getMenuRefs(header);
    if (!refs) return;
    header.dataset.menuInit = 'true';
    syncHeaderGeometry(header);

    refs.button.addEventListener('click', () => {
      if (isHeaderMenuOpen(header)) closeHeaderMenu(header);
      else openHeaderMenu(header);
    });

    refs.panel.addEventListener('click', (event) => {
      if ((event.target as Element | null)?.closest('a')) closeHeaderMenu(header);
    });
  });
}
