/**
 * The enquiry conversion contract.
 *
 * Two things live here, because both used to be typed out at a dozen call sites
 * and drifted: the wording of the conversion CTAs, and where the primary one
 * points. Every surface that offers the primary CTA renders the same label, so
 * the promise the visitor taps is the promise the form makes.
 */

/**
 * What a visitor can be asking for. A trigger declares one on its
 * `data-dialog-request-type` so the dialog opens on the request the CTA was
 * for — without it every submission arrives as a plain enquiry.
 */
export type EnquiryRequestType = 'site_visit' | 'brochure' | 'enquiry';

/** The site's primary conversion action, in the visitor's words. */
export const SITE_VISIT_CTA_LABEL = 'Book a site visit';

/**
 * The phone channel label. One wording everywhere: the mobile contact bar is
 * icon-only, so its `aria-label` is the only phone label most visitors read.
 */
export const PHONE_CTA_LABEL = 'Call sales';

/** The WhatsApp channel label, for the same reason as the phone one. */
export const WHATSAPP_CTA_LABEL = 'Message on WhatsApp';

/**
 * What the visitor reads once a lead is accepted. The binder appends the
 * delivery notes to it, so every lead surface speaks with one voice.
 */
export const ENQUIRY_SUCCESS_MESSAGE = 'Thanks — your request is with the team.';

/** The published brochure; the fallback destination when the PDF email fails. */
export const BROCHURE_DOWNLOAD_HREF = '/brochure/tranquill-city-final.pdf';

/**
 * What the visitor can ask for, in the order the controls render them. The
 * first entry is the site's primary promise, so a reset control returns to it.
 * Shared by the dialog and the inline contact form so both triage the same way.
 */
export const REQUEST_TYPE_OPTIONS: { value: EnquiryRequestType; label: string }[] = [
  { value: 'site_visit', label: SITE_VISIT_CTA_LABEL },
  { value: 'brochure', label: 'Send me the brochure' },
  { value: 'enquiry', label: 'Ask about availability and pricing' },
];

/**
 * The internal subject prefix per request type, for the notification subject the
 * sales inbox triages by. Deliberately different wording from
 * `REQUEST_TYPE_OPTIONS`: those are read by the visitor, these by the team, and
 * a visitor is never promised "Site visit request".
 */
export const REQUEST_TYPE_SUBJECT_LABELS: Record<EnquiryRequestType, string> = {
  site_visit: 'Site visit request',
  brochure: 'Brochure request',
  enquiry: 'Website enquiry',
};

/**
 * An Indian mobile number, as a visitor types it: ten digits starting 6-9, with
 * the optional `+91`/`0` prefix and one space or hyphen a person naturally
 * inserts. Applied as the `pattern` on both lead forms, so a one-character "1"
 * is rejected in the browser instead of reaching the sales inbox.
 *
 * The hyphen is escaped because browsers compile `pattern` with the `v` flag,
 * where a bare `-` inside a character class is a syntax error — and a pattern
 * that does not compile leaves the field unvalidated.
 */
export const PHONE_INPUT_PATTERN = '(?:\\+91[\\s\\-]?|0)?[6-9][0-9]{4}[\\s\\-]?[0-9]{5}';

/** The native validation bubble's text; the field hint carries the softer copy. */
export const PHONE_INPUT_TITLE = 'Enter a 10-digit Indian mobile number, e.g. 95503 62288.';

export interface EnquiryCtaTarget {
  /** Link target: the contact page, or the on-page enquiry form anchor. */
  href: string;
  /** Dialog id to open instead of navigating; omitted where no dialog exists. */
  dialog?: string;
}

/**
 * The "Book a site visit" call to action opens the enquiry dialog on most
 * pages, but the pages that render the inline enquiry form (project, contact)
 * must scroll to it instead — the dialog is not rendered there and a dialog
 * trigger would silently fall through to a page navigation.
 */
export function enquiryCtaTarget(pathname: string): EnquiryCtaTarget {
  // Normalised before matching: a request without the trailing slash must land
  // on the same target as one with it, or a slashless project URL falls
  // through to the contact page and the popup instead of the enquiry card.
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;

  // Project detail pages render the enquiry card at `#project-brochure` (the id
  // is kept for brochure deep links already in the wild). Bare `/projects/` is
  // the redirecting root and falls through below.
  if (/^\/projects\/[^/]+\/$/.test(path)) {
    return { href: `${path}#project-brochure` };
  }

  // The contact page scrolls straight to the form. The id belongs to the
  // enquiry section on that page (`#contact-enquiry`), not `#contact-form` —
  // a wrong anchor is a silent no-op scroll.
  if (path.startsWith('/contact-us/')) {
    return { href: '/contact-us/#contact-form' };
  }

  return { href: '/contact-us/', dialog: 'enquiry-dialog' };
}
