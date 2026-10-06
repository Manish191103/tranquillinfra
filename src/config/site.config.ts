import { SITE_URL, GOOGLE_SITE_VERIFICATION, BING_SITE_VERIFICATION } from 'astro:env/server';
import type { ImageMetadata } from 'astro';
import logoLight from '~/assets/brand/logo.png';
import logoDark from '~/assets/brand/logo-dark.png';

/**
 * The entity as it is named on its registration and tax documents.
 *
 * Three names circulate for one company: the short trading name, the legal
 * entity name, and the short byline. They are declared once each below and
 * derived from `LEGAL_NAME` wherever a surface needs the registered form, so a
 * change to the registered name cannot leave a stale string behind on the
 * About page or in the footer NAP block.
 */
const LEGAL_NAME = 'Tranquill Infra Projects Pvt. Ltd.';

/** One office NAP, held as discrete values. */
interface RegisteredOffice {
  /** Street line, without the city, PIN or country. */
  street: string;
  /** City or town. */
  locality: string;
  /** State. */
  region: string;
  /** PIN code. */
  postalCode: string;
  /** ISO 3166-1 alpha-2, as `PostalAddress.addressCountry` requires. */
  country: string;
}

/**
 * The registered office, the single structured source for the office address.
 *
 * It used to be held twice — discrete fields for the JSON-LD `streetAddress` and
 * a pre-wrapped `lines` array for the footer NAP block — so a corrected address
 * could be applied to one and missed in the other, and the two surfaces that
 * render the office differently (structured data, printed block, `llms.txt`)
 * were free to drift. The discrete values here are canonical.
 */
const registeredOffice: RegisteredOffice = {
  street: 'Flat No. 405, Jaya Bharathi Kalpana Apartments, Nandini Nagar, Miyapur',
  locality: 'Hyderabad',
  region: 'Telangana',
  postalCode: '500049',
  country: 'IN',
};

/** The country's English name for the printed block, where `IN` reads as noise. */
const COUNTRY_NAME: Record<string, string> = { IN: 'India' };

/**
 * The office as the footer prints it: one NAP line per array entry.
 *
 * The line breaks are a layout choice for a narrow footer column, not data: the
 * company name takes the first line, the street is wrapped so the final two
 * segments stay together on the closing line, and the locality line carries the
 * PIN. Every value is read from `registeredOffice` and `LEGAL_NAME`, so the
 * printed block cannot state a different address than the structured data.
 */
function officeLines(): string[] {
  const segments = registeredOffice.street.split(', ');
  const breakAt = Math.max(1, segments.length - 2);
  return [
    LEGAL_NAME,
    `${segments.slice(0, breakAt).join(', ')},`,
    `${segments.slice(breakAt).join(', ')}, ${registeredOffice.postalCode}`,
    `${registeredOffice.region}, ${COUNTRY_NAME[registeredOffice.country] ?? registeredOffice.country}`,
  ];
}

export interface SiteConfig {
  name: string;
  /**
   * The registered entity name, for the surfaces that must name the legal
   * entity rather than the trading name: the About page facts, the office NAP
   * block and any `legalName` in structured data.
   */
  legalName: string;
  /**
   * The short form used where a full entity name will not fit, and the name AI
   * answer engines are most likely to have on file for this business.
   */
  alternateName: string;
  description: string;
  url: string;
  /**
   * The publishing entity for content the company writes itself. Held equal to
   * `legalName`: the blog byline is the company, not an individual.
   */
  author: string;
  email: string;
  phone?: string;
  /**
   * E.164 phone (digits only, leading +) for `tel:` links and structured data.
   * This is the machine-readable form, and the only form structured data should
   * carry: the display `phone` above is written for a human reading it in a
   * contact block and is not a valid `tel:` target or `telephone` value.
   */
  phoneE164?: string;
  /** WhatsApp click-to-chat URL */
  whatsapp?: string;
  /**
   * The office NAP under the legacy field names. `src/lib/schema.ts`, the map
   * embed and `contact.config.ts` still read this shape; it is derived from
   * `office` so it is not a second copy of the address. A later wave points
   * those readers at `office` and this alias goes.
   */
  address?: {
    street: string;
    city: string;
    state: string;
    zip?: string;
    country: string;
  };
  /** Registered office: discrete NAP values plus the printed footer block */
  office?: RegisteredOffice & {
    /** One line per array entry (footer NAP block) */
    lines: string[];
  };
  /** Project site address, one line per array entry (footer NAP block) */
  project?: {
    lines: string[];
  };
  /** Business hours, one line per array entry */
  hours?: string[];
  /**
   * Opening hours in schema.org syntax (e.g. `Mo 09:00-18:00`) for structured
   * data. Parsed into `openingHoursSpecification` by `src/lib/opening-hours.ts`;
   * an unreadable entry fails the build rather than publishing wrong hours.
   */
  openingHours?: string[];
  /**
   * Absolute path to the logo used in structured data. `src/lib/schema.ts`
   * hardcoded this path in three places, so a moved or renamed file produced
   * markup pointing at a 404 instead of failing. Declared here, it is one
   * value to keep correct.
   */
  schemaLogo: string;
  /**
   * MCA Corporate Identity Number. Deliberately unset: the business has not
   * supplied it. It is the single highest-value identifier for this entity —
   * it is what an AI answer engine or a buyer can use to confirm that the
   * developer behind this site is the developer on the approval letters — and
   * it must come from the MCA record, not from a plausible-looking guess. Add
   * the real value when the business provides it.
   */
  cin?: string | undefined;
  socialLinks: string[];
  /**
   * X/Twitter handles for card attribution. Intentionally unset.
   *
   * No handle for this business is known, and the commented-out placeholder
   * this field replaced named `@yourhandle` — scaffolding that read as an
   * account somebody owned, which is worse than no scaffolding at all, so it
   * was removed rather than filled in. Do not put a placeholder back: a
   * fabricated handle attributes every shared card to an account the developer
   * does not control. Set a value only when it is the account's real handle.
   *
   * Kept as an extension point rather than deleted because the two emitters in
   * `src/components/seo/SEO.astro` are the only way an X card is attributed to
   * anyone, and keeping them costs nothing today — both are optional in the
   * protocol, a `summary` card is complete without them, and both are gated on
   * a value this config never sets. What it buys is one edit here rather than a
   * template edit when the handle arrives.
   */
  twitter?: {
    site: string;
    creator: string;
  };
  verification?: {
    google?: string;
    bing?: string;
  };
  /**
   * Branding configuration
   * Logo: replace the masters in `src/assets/brand/` and keep `alt` accurate;
   * `public/logo.png` is a stable 512 px export for structured data only.
   * Favicon: the whole set lives in `public/` — `favicon.svg` (the master:
   * the mark on a solid `#FCFBF7` plate), plus `favicon.ico`, `favicon.png`,
   * `apple-touch-icon.png` and the maskable `icon-512.png`. All are exports of
   * the same plated mark — regenerate the whole set together from it (render
   * the SVG at 1583 px native, resize with Lanczos; `icon-512.png` insets the
   * mark to a 55% envelope for the maskable safe zone). Links are plain
   * `/…` hrefs in `Favicons.astro`; `mask-icon` is dropped — Safari's
   * pinned-tab mask renders the SVG silhouette monochrome, never brand
   * colors, and modern Safari pins normal favicons.
   */
  branding: {
    /** Logo alt text for accessibility */
    logo: {
      alt: string;
      /** Light-background logo (sand/paper surfaces) */
      light: ImageMetadata;
      /** Dark-background logo (brand-green surfaces) */
      dark: ImageMetadata;
    };
    /** Favicon path (lives in public/) */
    favicon: {
      path: string;
    };
    /** Theme colors for manifest and browser UI */
    colors: {
      /** Browser toolbar color (hex) */
      themeColor: string;
      /** PWA splash screen background (hex) */
      backgroundColor: string;
    };
  };
}

const siteConfig: SiteConfig = {
  name: 'Tranquill Infra Projects',
  legalName: LEGAL_NAME,
  alternateName: 'Tranquill Infra',
  description:
    'HMDA-approved gated community plots and villa plots in Rudraram, near Patancheru, Hyderabad.',
  url: SITE_URL || 'https://www.tranquillinfra.com',
  author: LEGAL_NAME,
  email: 'info@tranquillinfra.com',
  phone: '+91 95503 62288',
  phoneE164: '+919550362288',
  /**
   * WhatsApp click-to-chat URL. The prefilled text saves the visitor a typing
   * step and tells the team which project the message is about.
   */
  whatsapp: `https://wa.me/919550362288?text=${encodeURIComponent(
    'Hi Tranquill Infra, I would like to know more about Tranquill City — plot availability, pricing and the documents.'
  )}`,
  office: { ...registeredOffice, lines: officeLines() },
  // Derived from `office`, not typed again: see the `address` field above.
  address: {
    street: registeredOffice.street,
    city: registeredOffice.locality,
    state: registeredOffice.region,
    zip: registeredOffice.postalCode,
    country: registeredOffice.country,
  },
  project: {
    lines: ['Tranquill City, Rudraram', 'Near Patancheru, Hyderabad'],
  },
  hours: [
    'Monday: 9:00 AM to 6:00 PM',
    'Tuesday: Closed',
    'Wednesday to Sunday: 9:00 AM to 6:00 PM',
  ],
  openingHours: ['Mo 09:00-18:00', 'We-Su 09:00-18:00'],
  socialLinks: ['https://www.instagram.com/tranquill_infraprojects/'],
  /**
   * The structured-data logo, `public/logo.png` — the 512 px export named in
   * `branding.logo` above, kept stable for `Organization.logo` and the article
   * `publisher` node, which must be a crawlable absolute URL.
   */
  schemaLogo: '/logo.png',
  // Unset until the business supplies the number from its MCA record. See the
  // `cin` field above for why it is worth having.
  cin: undefined as string | undefined,
  verification: {
    google: GOOGLE_SITE_VERIFICATION,
    bing: BING_SITE_VERIFICATION,
  },
  // Branding: the logo masters live in `src/assets/brand/` (rendered through the
  // Astro image pipeline), the favicon set in `public/` — replace both to
  // rebrand, and keep `alt` and the theme colors in step with them.
  branding: {
    logo: {
      alt: 'Tranquill Infra Projects',
      light: logoLight,
      dark: logoDark,
    },
    favicon: {
      path: '/favicon.png',
    },
    colors: {
      themeColor: '#123d31',
      backgroundColor: '#f3f0e7',
    },
  },
};

export default siteConfig;
