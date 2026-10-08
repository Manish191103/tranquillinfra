/**
 * Lead mail: the Resend transport, the two visitor templates (the brochure for
 * a brochure request, the confirmation for an enquiry or site visit) and the
 * sales notification. The one module that knows how a lead becomes an email.
 *
 * Server-only. The credentials come from the Worker secrets — a missing value
 * degrades into a thrown `EmailDeliveryError`, which the endpoint surfaces as
 * an honest 502 rather than a fake success.
 */
import {
  CONTACT_TO_EMAIL,
  RESEND_API_KEY,
  RESEND_FROM_EMAIL,
  RESEND_API_URL,
} from 'astro:env/server';

import { contact } from '~/contact';
import { dayName, openingWindowDays, parseOpeningHours } from '~/lib/opening-hours';
import siteConfig from '~/config/site.config';
import {
  PHONE_CTA_LABEL,
  REQUEST_TYPE_SUBJECT_LABELS,
  SITE_VISIT_CTA_LABEL,
  type EnquiryRequestType,
} from '~/lib/enquiry-cta';

/* -------------------------------------------------------------------------
   Resend transport
   ------------------------------------------------------------------------- */

interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Team inbox the recipient can reply to. */
  replyTo?: string;
  idempotencyKey?: string;
  /**
   * Files Resend pulls from a public URL itself (`attachments[].path`). The
   * brochure is 13 MB; uploading it would mean buffering and base64-encoding
   * the whole PDF in the Worker on every brochure request, while the hosted
   * copy is already served from Cloudflare's cache. Omitted when there is
   * nothing to attach, so a mail with no attachment carries no empty array.
   */
  attachments?: { path: string; filename: string }[];
}

/** Thrown when an email cannot be handed to Resend. Callers must surface this as a 5xx. */
export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailDeliveryError';
  }
}

const DEFAULT_ENDPOINT = 'https://api.resend.com/emails';
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Flatten a value that ends up in a mail header: control characters (CR/LF
 * among them) and whitespace runs collapse to single spaces, format characters
 * (bidi overrides, zero-width marks) are dropped, and the result is
 * length-capped. The recipient address, the subject and the reply-to all carry
 * visitor-influenced text, so the strip happens inside the delivery function
 * where it cannot be forgotten.
 */
function sanitizeHeader(value: string, max: number): string {
  return value
    .replace(/[\p{Cc}\p{Cf}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/**
 * Sends one transactional email through Resend.
 *
 * Misconfiguration and provider failures both throw — a message is never
 * dropped silently.
 */
async function sendEmail({
  to,
  subject,
  text,
  html,
  replyTo,
  attachments,
  idempotencyKey,
}: OutboundEmail): Promise<void> {
  const missing = [
    !RESEND_API_KEY && 'RESEND_API_KEY',
    !RESEND_FROM_EMAIL && 'RESEND_FROM_EMAIL',
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new EmailDeliveryError(`Email delivery is not configured: missing ${missing.join(', ')}`);
  }

  let response: Response;
  try {
    response = await fetch(RESEND_API_URL || DEFAULT_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [sanitizeHeader(to, 320)],
        subject: sanitizeHeader(subject, 240),
        text,
        html,
        ...(attachments?.length ? { attachments } : {}),
        ...(replyTo ? { reply_to: sanitizeHeader(replyTo, 320) } : {}),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new EmailDeliveryError(
      `Email delivery request failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!response.ok) {
    // Provider errors can echo submitted values (a rejected address, a subject).
    // The message is logged, so the body is flattened to one line, addresses are
    // masked, and the tail is dropped before it is embedded.
    const detail = (await response.text().catch(() => ''))
      .replace(/[\p{Cc}]+/gu, ' ')
      .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[email]')
      .trim()
      .slice(0, 200);

    throw new EmailDeliveryError(
      `Email delivery rejected (${response.status})${detail ? `: ${detail}` : ''}`
    );
  }
}

/* -------------------------------------------------------------------------
   Templates
   ------------------------------------------------------------------------- */

/** Path of the hosted brochure PDF the brochure mail links to. */
const BROCHURE_PATH = '/brochure/tranquill-city-final.pdf';

/**
 * Filename the sales notification's attachment carries. The hosted file keeps
 * its build name; an inbox attachment is read by a person, so the version
 * suffix is noise.
 */
const BROCHURE_FILENAME = 'Tranquill-City-Brochure.pdf';

/* -------------------------------------------------------------------------
   Visitor-mail design system

   One shell renders both visitor mails — the brochure and the confirmation —
   so the header, the CTAs and the footer NAP cannot drift apart between the
   two sends. The palette is lifted from the site tokens (`src/styles/tokens/`:
   the sand page, the forest ink, the gold accent, the darkened WhatsApp green
   the site buttons also use); hex is inlined because email clients strip
   `<style>` and CSS variables.
   ------------------------------------------------------------------------- */

const EMAIL = {
  page: '#f7f4ec',
  card: '#ffffff',
  ink: '#103e33',
  text: '#24443b',
  muted: '#3f6459',
  faint: '#6d8a80',
  hairline: '#e3ddd0',
  gold: '#f2cb67',
  whatsapp: '#0d7a41',
  white: '#ffffff',
  face: "Manrope,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
} as const;

/** Absolute URL for a site path — the only form that works from an inbox. */
function emailUrl(path: string): string {
  return new URL(path, siteConfig.url).toString();
}

/**
 * The "Book a site visit" destination for a reader of the mail: the contact
 * page's inline enquiry form, the one surface that carries all three request
 * types. The hash matches the site's own CTA target (`enquiryCtaTarget`);
 * `enquiryCtaTarget` itself is not reused because it keys off the visitor's
 * pathname, which an email does not have.
 */
const BOOK_VISIT_PATH = '/contact-us/#contact-form';

interface EmailButton {
  href: string;
  label: string;
  kind: 'gold' | 'green' | 'ghost';
}

/**
 * A bulletproof button: the fill lives on a `bgcolor` attribute (which Outlook
 * Desktop renders — CSS colors on the anchor alone are dropped), the rounded
 * look on inline style (which it ignores, degrading to a square), and the
 * padding on the anchor itself (which Outlook collapses to nothing, so the
 * `bgcolor` cell keeps the label readable regardless).
 */
function emailButton({ href, label, kind }: EmailButton): string {
  const fill =
    kind === 'gold'
      ? { bg: EMAIL.gold, text: EMAIL.ink, weight: 700 }
      : kind === 'green'
        ? { bg: EMAIL.whatsapp, text: EMAIL.white, weight: 700 }
        : { bg: EMAIL.card, text: EMAIL.text, weight: 600 };
  const border = kind === 'ghost' ? `border:1px solid ${EMAIL.hairline};` : '';
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" bgcolor="${fill.bg}" style="${border}background-color:${fill.bg};border-radius:8px;"><a href="${escapeHtml(
    href
  )}" target="_blank" style="display:block;font-family:${EMAIL.face};font-size:14px;line-height:1.3;font-weight:${
    fill.weight
  };color:${fill.text};text-decoration:none;padding:13px 10px;">${escapeHtml(label)}</a></td></tr></table>`;
}

/** Buttons arranged in one row, each cell sized equally. */
function emailActionRow(buttons: EmailButton[]): string {
  const cells = buttons
    .map(
      (button) =>
        `<td width="${Math.floor(100 / buttons.length)}%" align="center" valign="top" style="padding:0 3px;">${emailButton(
          button
        )}</td>`
    )
    .join('');
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:26px 0 0;"><tr>${cells}</tr></table>`;
}

/** The one hero action of a mail: full-width, gold, centered label. */
function emailHeroButton({ href, label }: { href: string; label: string }): string {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:26px 0 0;"><tr><td align="center"><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" bgcolor="${EMAIL.gold}" style="background-color:${EMAIL.gold};border-radius:8px;"><a href="${escapeHtml(
    href
  )}" target="_blank" style="display:block;font-family:${EMAIL.face};font-size:15px;line-height:1.3;font-weight:700;color:${EMAIL.ink};text-decoration:none;padding:16px 24px;">${escapeHtml(
    label
  )}</a></td></tr></table></td></tr></table>`;
}

/** Project facts a reader would otherwise have to find on the website. */
function emailFacts(facts: { term: string; value: string }[]): string {
  const rows = facts
    .map(
      ({ term, value }) =>
        `<tr><td valign="top" style="padding:7px 0;color:${EMAIL.muted};font-size:14px;width:1%;white-space:nowrap;">${escapeHtml(
          term
        )}</td><td valign="top" style="padding:7px 0 7px 16px;color:${EMAIL.text};font-size:14px;font-weight:600;">${escapeHtml(
          value
        )}</td></tr>`
    )
    .join('');
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:26px 0 0;background-color:${EMAIL.page};border-radius:10px;"><tr><td style="padding:16px 20px;"><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">${rows}</table></td></tr></table>`;
}

/**
 * The shared card: gold brand bar, logo header, the mail's body, and a footer
 * carrying the NAP lines the site publishes. Both visitor templates render
 * through it, so a palette or a NAP change lands in both mails at once.
 */
function emailShell({
  preheader,
  body,
  footnote,
}: {
  preheader: string;
  body: string;
  footnote: string;
}): string {
  const logoUrl = emailUrl(siteConfig.schemaLogo);
  const approvalLine = [
    `${contact.approvals.rera.label} ${contact.approvals.rera.number}`,
    `${contact.approvals.hmda.label} ${contact.approvals.hmda.number}`,
  ].join(' · ');
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Tranquill Infra Projects</title>
</head>
<body style="margin:0;padding:24px 12px;background-color:${EMAIL.page};">
<div style="display:none;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;">${escapeHtml(
    preheader
  )}</div>
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background-color:${EMAIL.card};border-radius:14px;">
  <tr><td height="4" bgcolor="${EMAIL.gold}" style="height:4px;line-height:4px;font-size:0;">&#8203;</td></tr>
  <tr><td style="padding:24px 40px 0;"><img src="${escapeHtml(logoUrl)}" width="176" height="36" alt="${escapeHtml(
    siteConfig.branding.logo.alt
  )}" style="display:block;width:176px;height:36px;border:0;outline:none;"></td></tr>
  <tr><td style="padding:14px 40px 34px;font-family:${EMAIL.face};font-size:16px;line-height:1.65;color:${EMAIL.text};">
    ${body}
  </td></tr>
  <tr><td style="padding:18px 40px;font-family:${EMAIL.face};font-size:12.5px;line-height:2;color:${EMAIL.faint};border-top:1px solid ${EMAIL.hairline};">
    <p style="margin:0;">${escapeHtml(contact.project.lines.join(' · '))}</p>
    <p style="margin:0;">${escapeHtml(siteConfig.hours?.join(' · ') ?? '')}</p>
    <p style="margin:0;">${escapeHtml(approvalLine)}</p>
  </td></tr>
  <tr><td style="padding:0 40px 28px;font-family:${EMAIL.face};font-size:11.5px;line-height:1.8;color:${EMAIL.faint};">
    ${footnote}
  </td></tr>
</table>
</td></tr></table>
</body>
</html>`;
}

/** The sign-off block both visitor mails end on: team name with mail and tap-to-call. */
function emailSignature(): string {
  return `<p style="margin:30px 0 0;padding-top:22px;border-top:1px solid ${EMAIL.hairline};font-size:14px;color:${EMAIL.muted};">Reply to this email and it goes straight to our team inbox.</p>
<p style="margin:14px 0 0;font-size:14px;color:${EMAIL.text};font-weight:600;">${escapeHtml(contact.name)}</p>
<p style="margin:2px 0 0;font-size:14px;"><a href="mailto:${escapeHtml(contact.email)}" style="color:${EMAIL.ink};">${escapeHtml(contact.email)}</a>${contact.phone ? ` &middot; <a href="tel:${escapeHtml(contact.phoneE164)}" style="color:${EMAIL.ink};">${escapeHtml(contact.phone)}</a>` : ''}</p>`;
}

/* -------------------------------------------------------------------------
   Call-back promise
   ------------------------------------------------------------------------- */

/**
 * The office is in Hyderabad, so the promise is made against the office clock
 * (IST) and not the visitor's — a promise about "business hours" that is read
 * in another timezone still has to be one the office can keep.
 */
const OFFICE_TIME_ZONE = 'Asia/Kolkata';

interface OfficeWindow {
  /** Day of week, 0 = Sunday. */
  day: number;
  /** Minutes since midnight. */
  open: number;
  close: number;
}

/** `09:00` to minutes since midnight; NaN for anything unreadable. */
const toMinutes = (time: string): number => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : Number.NaN;
};

/**
 * The office's weekly windows, read from the same `openingHours` array the site
 * publishes and Google reads — a second copy of the hours here would be free
 * to drift from the ones the visitor was shown (and from a second prose parser,
 * already the case in this file's predecessor). Malformed or absent config
 * yields no windows, and the promise then makes no timing claim at all rather
 * than one the business may be unable to keep.
 */
function officeWindows(): OfficeWindow[] {
  if (!siteConfig.openingHours?.length) return [];

  try {
    return parseOpeningHours(siteConfig.openingHours).flatMap(({ days, opens, closes }) => {
      const open = toMinutes(opens);
      const close = toMinutes(closes);
      if (Number.isNaN(open) || Number.isNaN(close)) return [];
      return openingWindowDays({ days, opens, closes }).map((day) => ({ day, open, close }));
    });
  } catch {
    return [];
  }
}

/** The office clock right now: day of week and minutes since midnight, in IST. */
function officeClock(now: Date): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: OFFICE_TIME_ZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(part('weekday'));
  const minutes = Number(part('hour')) * 60 + Number(part('minute'));

  return { day: day === -1 ? now.getUTCDay() : day, minutes };
}

/** The next day (from `day`, exclusive) the office opens, within a week. */
function nextOpenWindow(day: number, windows: OfficeWindow[]): OfficeWindow | undefined {
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = (day + offset) % 7;
    const window = windows.find((entry) => entry.day === candidate);
    if (window) return { ...window, day: candidate };
  }

  return undefined;
}

/** `540` to `9:00 AM`, for naming a window in the copy. */
function formatClock(minutes: number): string {
  const hours24 = Math.floor(minutes / 60);
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes % 60).padStart(2, '0')} ${suffix}`;
}

/**
 * What the visitor is told about the call-back, decided at send time against
 * the published office hours.
 *
 * The forms used to promise ten minutes "during business hours" while the
 * office is closed on Tuesdays: an enquiry sent on a Tuesday was promised a
 * call-back that could not happen. The promise is now derived from
 * `openingHours` — a same-day call-back while the office is open, and a named
 * next working day when it is not. With no readable hours there is no timing
 * claim at all, which is the only thing that cannot go stale.
 */
function callbackPromise(now: Date): string {
  const windows = officeWindows();
  if (windows.length === 0) {
    return 'We answer every enquiry, normally on the next working day.';
  }

  const { day, minutes } = officeClock(now);
  const today = windows.find((window) => window.day === day);
  const team = 'A member of our sales team will call you back';

  if (today && minutes >= today.open && minutes < today.close) {
    return `${team} on the same working day, while we are open.`;
  }

  const next = nextOpenWindow(day, windows);
  if (!next) {
    return 'We answer every enquiry, normally on the next working day.';
  }

  return `Our office is closed right now. ${team} on ${dayName(next.day)}, from ${formatClock(
    next.open
  )} to ${formatClock(next.close)}.`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Collapse whitespace and cap untrusted text before it reaches the mail body. */
function clean(value: string | undefined, max: number): string | undefined {
  const text = value
    ?.replace(/[\p{Cc}\p{Cf}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.slice(0, max) : undefined;
}

/**
 * Emails the project brochure to a visitor who requested it from the enquiry
 * form. The mail carries the hosted PDF as a link rather than an attachment:
 * the file is 13.2 MB, which mailbox providers routinely defer or quarantine,
 * while the hosted copy is served from Cloudflare's cache in one click.
 *
 * The link is for the visitor's mailbox, which routinely defers or quarantines
 * a 13 MB attachment; the sales notification attaches the same file, because a
 * deferral in the team's inbox costs them the asset with the lead.
 */
async function sendBrochureEmail({
  to,
  name,
  submittedAt,
  leadId,
}: Pick<LeadMail, 'to' | 'name' | 'submittedAt' | 'leadId'> & { to: string }): Promise<void> {
  const brochureUrl = emailUrl(BROCHURE_PATH);
  const projectUrl = emailUrl('/projects/tranquill-city/');
  const visitUrl = emailUrl(BOOK_VISIT_PATH);
  const firstName = clean(name, 80)?.split(' ')[0];
  const greeting = firstName ? `Hi ${firstName},` : 'Hello,';
  const promise = callbackPromise(new Date(submittedAt ?? Date.now()));

  const text = [
    greeting,
    '',
    'Thank you for your interest in Tranquill City, Rudraram. The latest project brochure is ready:',
    '',
    `Download the brochure: ${brochureUrl}`,
    '',
    `Plots and pricing: ${projectUrl}`,
    '',
    promise,
    '',
    `Book a site visit: ${visitUrl}`,
    `Call sales: ${contact.phone}`,
    `WhatsApp: ${contact.whatsapp}`,
    '',
    contact.name,
    contact.email,
    '',
    'You received this email because the brochure was requested on tranquillinfra.com.',
  ].join('\n');

  const body = `
<p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>
<p style="margin:0 0 8px;">
  Thank you for your interest in <b>Tranquill City, Rudraram</b>. The latest project
  brochure is ready — every plot, price and approval document inside.
</p>
${emailHeroButton({ href: brochureUrl, label: 'Download the brochure' })}
${emailFacts([
  { term: 'Plots', value: contact.plotSizes },
  { term: 'Entry price', value: contact.details.priceDisplay },
  {
    term: 'Approvals',
    value: `${contact.approvals.rera.label} ${contact.approvals.rera.number} · ${contact.approvals.hmda.label} ${contact.approvals.hmda.number}`,
  },
])}
<p style="margin:22px 0 0;font-size:14px;color:${EMAIL.muted};">${escapeHtml(promise)}</p>
${emailActionRow([
  { href: visitUrl, label: SITE_VISIT_CTA_LABEL, kind: 'ghost' },
  { href: `tel:${escapeHtml(contact.phoneE164)}`, label: PHONE_CTA_LABEL, kind: 'ghost' },
  { href: contact.whatsapp, label: 'WhatsApp us', kind: 'green' },
])}
<p style="margin:24px 0 0;font-size:14px;">
  Plot sizes, pricing and all the documents, browsable any time:
  <a href="${escapeHtml(projectUrl)}" style="color:${EMAIL.ink};">Tranquill City on tranquillinfra.com</a>.
</p>
${emailSignature()}`;

  const html = emailShell({
    preheader: `Your brochure is ready — plots from ₹48 lakh, with the approval documents inside.`,
    body,
    footnote: `You received this email because a brochure was requested on <a href="${escapeHtml(
      emailUrl('/')
    )}" style="color:${EMAIL.faint};">tranquillinfra.com</a>.`,
  });

  await sendEmail({
    to,
    subject: 'Your Tranquill City brochure',
    text,
    html,
    replyTo: CONTACT_TO_EMAIL || contact.email,
    idempotencyKey: `lead-customer/${leadId}`,
  });
}

/**
 * Emails a visitor the confirmation that their enquiry (or site-visit request)
 * reached the team.
 */
async function sendConfirmationEmail({
  to,
  name,
  requestType,
  submittedAt,
  leadId,
}: {
  submittedAt?: string;
  leadId: string;
  to: string;
  name?: string;
  requestType: 'enquiry' | 'site_visit';
}): Promise<void> {
  const projectUrl = emailUrl('/projects/tranquill-city/');
  const visitUrl = emailUrl(BOOK_VISIT_PATH);
  const firstName = clean(name, 80)?.split(' ')[0];
  const greeting = firstName ? `Hi ${firstName},` : 'Hello,';
  const phone = contact.phone;
  const siteVisit = requestType === 'site_visit';

  // The site-visit branch promises only that a team member will confirm the
  // day, which holds on any day; the enquiry branch carries the promise the
  // published hours can actually keep (see `callbackPromise`).
  const opening = siteVisit
    ? 'Thank you for requesting a site visit to Tranquill City, Rudraram. We have received your request and a member of our team will call you to confirm a day and time.'
    : `Thank you for contacting ${contact.name}. We have received your enquiry. ${callbackPromise(
        new Date(submittedAt ?? Date.now())
      )}`;

  const text = [
    greeting,
    '',
    opening,
    '',
    // The three channels, in the order the mail's button row reads.
    ...(siteVisit ? [`Change or add a visit: ${visitUrl}`] : [`Book a site visit: ${visitUrl}`]),
    `Call sales: ${phone}`,
    `WhatsApp: ${contact.whatsapp}`,
    '',
    `Plot sizes, pricing and the approval documents: ${projectUrl}`,
    ...(siteConfig.hours ? ['', `Business hours: ${siteConfig.hours.join(' · ')}`] : []),
    '',
    contact.name,
    contact.email,
    '',
    'You received this email because you submitted an enquiry on tranquillinfra.com.',
  ].join('\n');

  // One hero action per mail; the row underneath carries the two channels the
  // hero did not use, so no mail repeats a CTA.
  const hero = siteVisit
    ? {
        href: `tel:${escapeHtml(contact.phoneE164)}`,
        label: `Call ${escapeHtml(phone)}`,
      }
    : { href: visitUrl, label: SITE_VISIT_CTA_LABEL };
  const rowButtons: EmailButton[] = siteVisit
    ? [
        { href: visitUrl, label: SITE_VISIT_CTA_LABEL, kind: 'ghost' },
        { href: contact.whatsapp, label: 'WhatsApp us', kind: 'green' },
      ]
    : [
        {
          href: `tel:${escapeHtml(contact.phoneE164)}`,
          label: PHONE_CTA_LABEL,
          kind: 'ghost',
        },
        { href: contact.whatsapp, label: 'WhatsApp us', kind: 'green' },
      ];

  const body = `
<p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>
<p style="margin:0 0 4px;">${escapeHtml(opening)}</p>
${emailHeroButton(hero)}
<p style="margin:22px 0 0;font-size:14px;color:${EMAIL.muted};">${
    siteVisit
      ? 'Need a different day or a second visit? The row below gets you there or to our desk in one tap.'
      : 'Prefer to talk or write first? The row below taps straight to our desk.'
  }</p>
${emailActionRow(rowButtons)}
<p style="margin:24px 0 0;font-size:14px;">
  Plot sizes, pricing and the approval documents:
  <a href="${escapeHtml(projectUrl)}" style="color:${EMAIL.ink};">Tranquill City on tranquillinfra.com</a>.
</p>
${emailSignature()}`;

  const html = emailShell({
    preheader: siteVisit
      ? 'We have your site-visit request — a team member will call you to confirm.'
      : 'We have your enquiry — call, WhatsApp or book a site visit in one tap.',
    body,
    footnote: `You received this email because you submitted an enquiry on <a href="${escapeHtml(
      emailUrl('/')
    )}" style="color:${EMAIL.faint};">tranquillinfra.com</a>.`,
  });

  await sendEmail({
    to,
    subject: siteVisit
      ? 'We received your site visit request — Tranquill Infra'
      : 'We received your enquiry — Tranquill Infra',
    text,
    html,
    replyTo: CONTACT_TO_EMAIL || contact.email,
    idempotencyKey: `lead-customer/${leadId}`,
  });
}

/** One lead, as the sales notification carries it. */
export interface LeadMail {
  /** Server-side id: quoted in the mail, in the log line and to the client. */
  leadId: string;
  /**
   * The visitor's address, used as Reply-To so a reply reaches them. Optional
   * in practice: the forms no longer require an email, and an empty `to` skips
   * the visitor send and reads as "not provided" in the sales copy.
   */
  to?: string;
  requestType: EnquiryRequestType;
  name?: string;
  phone?: string;
  message?: string;
  /** `YYYY-MM-DD` from the site-visit date field, when the form carries one. */
  visitDate?: string;
  /** Path the enquiry was submitted from, for the landing page. */
  page?: string;
  /** The browser's conversion event id, to tie this lead to the analytics. */
  eventId?: string;
  submittedAt?: string;
  subject?: string;
  enquirySubject?: string;
  formType?: string;
  context?: Record<string, string>;
}

/**
 * Mails the sales inbox the enquiry itself.
 *
 * This is the copy the business runs on. The browser also posts every lead to
 * Formspree, but that path is a third party on every layer — it can be down,
 * its free plan caps the account's submissions, and `formspree.io` is on
 * common ad-blocker lists — and when it fails the site has no other record of
 * the lead anywhere. The team's own inbox has to hold the enquiry, which is
 * also why this mail is the one that carries every field the visitor typed
 * rather than a summary.
 *
 * Reply-To is the visitor's address: the first reply from sales goes to the
 * person who asked, and the visitor's own confirmation keeps the team inbox as
 * its Reply-To.
 */
async function sendSalesNotification(lead: LeadMail): Promise<void> {
  const label = REQUEST_TYPE_SUBJECT_LABELS[lead.requestType];
  const who = clean(lead.name, 100) ?? 'Unnamed visitor';
  const message = clean(lead.message, 5000);
  const phone = clean(lead.phone, 20);
  const visitDate = clean(lead.visitDate, 40);
  const page = clean(lead.page, 200);
  const eventId = clean(lead.eventId, 64);
  const brochureUrl = new URL(BROCHURE_PATH, siteConfig.url).toString();
  const attached = lead.requestType === 'brochure';

  // One row list feeds both bodies, so the plain-text mail the team reads on a
  // phone and the HTML mail they read in Outlook cannot drift apart. A field
  // the visitor left empty is dropped rather than sent as a blank line.
  const rows: [string, string][] = [
    ['Request type', label],
    ['Name', who],
  ];
  if (lead.enquirySubject) rows.push(['Subject', lead.enquirySubject]);
  if (lead.formType) rows.push(['Form', lead.formType]);
  if (phone) rows.push(['Phone', phone]);
  rows.push(['Email', lead.to || 'not provided']);
  if (visitDate) rows.push(['Preferred site-visit date', visitDate]);
  if (page) rows.push(['Submitted from', page]);
  rows.push(['Reference', lead.leadId]);
  if (eventId) rows.push(['Website event', eventId]);
  for (const [field, value] of Object.entries(lead.context ?? {})) {
    if (value) rows.push([field, value]);
  }

  const replyLine = lead.to
    ? 'Reply to this mail and it goes straight to the visitor.'
    : 'This visitor left no email, so call or WhatsApp them.';
  const text = [
    `${label}: ${who}`,
    '',
    ...rows.map(([field, value]) => `${field}: ${value}`),
    '',
    ...(message ? ['Message:', message] : ['(No message left.)']),
    '',
    ...(attached ? ['The project brochure is attached.'] : []),
    replyLine,
    "Sent by the website as the team's copy of this enquiry; the browser also submits it to Formspree.",
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f7f4ec;font-family:Manrope,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#24443b">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px">
            <tr>
              <td style="padding:32px;font-size:16px;line-height:1.6">
                <h1 style="margin:0 0 20px;font-size:18px;line-height:1.4">${escapeHtml(`${label}: ${who}`)}</h1>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
                  ${rows
                    .map(
                      ([field, value]) =>
                        `<tr><td style="padding:4px 16px 4px 0;color:#3f6459;white-space:nowrap;vertical-align:top">${escapeHtml(
                          field
                        )}</td><td style="padding:4px 0;vertical-align:top">${escapeHtml(value)}</td></tr>`
                    )
                    .join('')}
                </table>
                <p style="margin:24px 0 6px;font-size:14px;color:#3f6459">Message</p>
                <p style="margin:0;font-size:15px">${escapeHtml(message ?? '(No message left.)')}</p>
                ${
                  attached
                    ? '<p style="margin:0 0 16px;font-size:15px">The project brochure is attached.</p>'
                    : ''
                }
                <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #e3ddd0;font-size:13px;color:#6d8a80">
                  Sent by the website as the team's copy of this enquiry; the browser also submits
                  it to Formspree.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  await sendEmail({
    to: CONTACT_TO_EMAIL || contact.email,
    subject: lead.subject || `${label}: ${who}`,
    text,
    html,
    // A reply from sales must land on the visitor, not on the site's own
    // no-reply sender — unless the visitor gave no address, in which case a
    // blank reply-to would hand the same mail back to the team.
    ...(lead.to ? { replyTo: lead.to } : {}),
    idempotencyKey: `lead-sales/${lead.leadId}`,
    // The team gets the asset with the lead: a brochure request is a request
    // for the brochure, and this is the copy that survives a dead Formspree.
    ...(attached ? { attachments: [{ path: brochureUrl, filename: BROCHURE_FILENAME }] } : {}),
  });
}

/** What each of the two sends did, so the endpoint can answer and log them apart. */
export interface LeadMailOutcome {
  /** The sales inbox received the enquiry. */
  sales: boolean;
  /** The visitor received their copy. */
  confirmation: boolean;
  /** No visitor copy was attempted: a phone-only lead with nothing to send. */
  confirmationSkipped?: boolean;
  /** Why the sales copy did not go out; absent when it did. */
  salesError?: Error;
  /** Why the visitor's copy did not go out; absent when it did. */
  confirmationError?: Error;
}

/**
 * Mails one submission twice: the sales inbox gets the enquiry, the visitor
 * gets the brochure or the confirmation.
 *
 * The sales copy is sent first; the visitor receives a receipt or brochure
 * only once sales acceptance is confirmed. Neither failure is allowed to mask the other, and
 * neither is swallowed: both outcomes come back so the endpoint can log a
 * single line carrying the lead id and answer the client with a shape that
 * tells "your confirmation failed" apart from "your enquiry failed".
 */
export async function deliverLeadMail(
  lead: LeadMail,
  onSalesAccepted?: () => void
): Promise<LeadMailOutcome> {
  const outcome: LeadMailOutcome = { sales: false, confirmation: false };

  try {
    await sendSalesNotification(lead);
    outcome.sales = true;
  } catch (error) {
    outcome.salesError = error instanceof Error ? error : new Error(String(error));
  }

  if (!outcome.sales) return outcome;

  try {
    onSalesAccepted?.();
  } catch {
    // An optional measurement callback cannot invalidate accepted sales mail.
    console.warn(
      `meta_conversion event_id=${JSON.stringify(lead.eventId ?? '')} accepted=false reason=callback_failed`
    );
  }

  try {
    // The visitor mail needs an address to arrive at. A lead with a phone but
    // no email still reached the sales inbox above; here the absence just
    // means there is nothing to send, not a failed delivery.
    const visitorTo = lead.to;
    if (visitorTo) {
      const visitorLead = { ...lead, to: visitorTo };
      if (lead.requestType === 'brochure') {
        await sendBrochureEmail(visitorLead);
      } else {
        await sendConfirmationEmail({ ...visitorLead, requestType: lead.requestType });
      }
      outcome.confirmation = true;
    } else {
      outcome.confirmationSkipped = true;
    }
  } catch (error) {
    outcome.confirmationError = error instanceof Error ? error : new Error(String(error));
  }

  return outcome;
}
