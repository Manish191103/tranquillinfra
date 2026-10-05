import { getPermalink, getBlogPermalink } from './utils/permalinks';
import { BROCHURE_DOWNLOAD_HREF } from '~/lib/enquiry-cta';
import { contact } from '~/contact';

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
        /*
          The one link the site has that navigation does not: the footer is its
          stable home. `track` is data, not markup — Footer.astro renders it as
          `data-track="brochure"`. The href is imported from `enquiry-cta` so
          no second copy of the destination drifts.
        */
        {
          text: 'Download brochure',
          href: BROCHURE_DOWNLOAD_HREF,
          track: 'brochure',
        },
      ],
    },
  ],
  secondaryLinks: [{ text: 'Privacy policy', href: getPermalink('/privacy-policy') }],
  /**
   * Instagram is the brand's single social channel — the footer renders it in
   * the brand column and the legal row.
   */
  socialLinks: [{ ariaLabel: 'Tranquill Infra on Instagram', icon: 'tabler:brand-instagram', href: contact.instagram }],
  footNote: `© ${new Date().getFullYear()} Tranquill Infra Projects. All rights reserved.`,
};
