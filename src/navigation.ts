import { getPermalink, getBlogPermalink, getAsset } from './utils/permalinks';

/**
 * Header and footer menus.
 *
 * One flat list, mirroring the live site's navigation: the four destinations a
 * buyer actually navigates to. There is no `/projects/` listing — that route
 * redirects to the flagship project — so the link names the project itself
 * rather than promising a comparison the site cannot offer.
 */
export const headerData = {
  links: [
    { text: 'About us', href: getPermalink('/about-us') },
    { text: 'Tranquill City', href: getPermalink('/projects/tranquill-city') },
    { text: 'Insights', href: getPermalink('/blog') },
    { text: 'Contact', href: getPermalink('/contact-us') },
  ],
  actions: [{ text: 'Book a site visit', href: getPermalink('/contact-us') }],
};

export const footerData = {
  links: [
    {
      title: 'Project',
      links: [
        { text: 'Tranquill City', href: getPermalink('/projects/tranquill-city') },
        { text: 'Book a site visit', href: getPermalink('/contact-us') },
      ],
    },
    {
      title: 'Company',
      links: [
        { text: 'About us', href: getPermalink('/about-us') },
        { text: 'Contact', href: getPermalink('/contact-us') },
      ],
    },
    {
      title: 'Resources',
      links: [
        { text: 'Insights', href: getBlogPermalink() },
        { text: 'Privacy policy', href: getPermalink('/privacy-policy') },
      ],
    },
  ],
  secondaryLinks: [{ text: 'Privacy policy', href: getPermalink('/privacy-policy') }],
  socialLinks: [{ ariaLabel: 'RSS', icon: 'tabler:rss', href: getAsset('/rss.xml') }],
  footNote: `© ${new Date().getFullYear()} Tranquill Infra Projects. All rights reserved.`,
};
