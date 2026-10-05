/**
 * Navigation Configuration
 *
 * Defines which pages appear in the site navigation, in the order they render.
 * Astro handles routing via the filesystem — this only controls nav menus.
 *
 * Add an item per public route, e.g.
 *   { label: 'Tranquill City', href: '/projects/tranquill-city/' }
 *
 * This file is the single source for every nav menu on the site — the header,
 * the mobile panel and the footer all render this list.
 */

export interface NavItem {
  label: string;
  href: string;
}

export const navItems: NavItem[] = [
  { label: 'About us', href: '/about-us/' },
  // The label names what the link actually is: one project, not a listing. There
  // is no `/projects/` index — that route redirects here — so "Projects" would
  // promise a comparison the page cannot offer.
  { label: 'Tranquill City', href: '/projects/tranquill-city/' },
  { label: 'Insights', href: '/blog/' },
  { label: 'Contact', href: '/contact-us/' },
];
