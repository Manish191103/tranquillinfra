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
import {
  dayName,
  openingWindowDays,
  parseOpeningHours,
} from '~/lib/opening-hours';
import siteConfig from '~/config/site.config';
import {
  REQUEST_TYPE_SUBJECT_LABELS,
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
async function sendBrochureEmail({ to, name }: { to: string; name?: string }): Promise<void> {
  const brochureUrl = new URL(BROCHURE_PATH, siteConfig.url).toString();
  const projectUrl = new URL('/projects/tranquill-city/', siteConfig.url).toString();
  const firstName = clean(name, 80)?.split(' ')[0];
  const greeting = firstName ? `Hi ${firstName},` : 'Hello,';
  const phone = contact.phone;
  const promise = callbackPromise(new Date());

  const text = [
    greeting,
    '',
    'Thank you for your interest in Tranquill City, Rudraram. The latest project brochure is ready:',
    '',
    brochureUrl,
    '',
    `Plot sizes, pricing, availability and the approval documents: ${projectUrl}`,
    '',
    promise,
    '',
    `Questions or a site visit? Reply to this email${phone ? ` or call ${phone}` : ''}.`,
    '',
    contact.name,
    contact.email,
    '',
    'You received this email because the brochure was requested on tranquillinfra.com.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f7f4ec;font-family:Manrope,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#24443b">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px">
            <tr>
              <td style="padding:32px;font-size:16px;line-height:1.6">
                <p style="margin:0 0 16px">${escapeHtml(greeting)}</p>
                <p style="margin:0 0 24px">
                  Thank you for your interest in Tranquill City, Rudraram. The latest project brochure
                  is ready.
                </p>
                <p style="margin:0 0 28px">
                  <a href="${brochureUrl}" style="display:inline-block;background:#f2cb67;color:#103e33;font-weight:700;text-decoration:none;padding:14px 24px;border-radius:8px">Download the brochure</a>
                </p>
                <p style="margin:0 0 12px;font-size:14px;color:#3f6459">
                  ${escapeHtml(promise)}
                </p>
                <p style="margin:0 0 12px;font-size:14px;color:#3f6459">
                  Prefer to see the project in person? Reply to this email${
                    phone
                      ? ` or call <a href="tel:${escapeHtml(contact.phoneE164)}" style="color:#1b5b4b">${escapeHtml(phone)}</a>`
                      : ''
                  }.
                </p>
                <p style="margin:0 0 28px;font-size:14px">
                  <a href="${projectUrl}" style="color:#1b5b4b">Plot sizes, pricing and the approval documents</a>
                </p>
                <p style="margin:0;font-size:14px;color:#3f6459">
                  ${escapeHtml(contact.name)}<br />
                  <a href="mailto:${escapeHtml(contact.email)}" style="color:#1b5b4b">${escapeHtml(contact.email)}</a>
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;max-width:520px;font-size:12px;line-height:1.5;color:#6d8a80">
            You received this email because the brochure was requested on tranquillinfra.com.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  await sendEmail({
    to,
    subject: 'Your Tranquill City brochure',
    text,
    html,
    replyTo: CONTACT_TO_EMAIL || contact.email,
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
}: {
  to: string;
  name?: string;
  requestType: 'enquiry' | 'site_visit';
}): Promise<void> {
  const projectUrl = new URL('/projects/tranquill-city/', siteConfig.url).toString();
  const firstName = clean(name, 80)?.split(' ')[0];
  const greeting = firstName ? `Hi ${firstName},` : 'Hello,';
  const phone = contact.phone;
  const hours = siteConfig.hours?.join(' · ');
  const siteVisit = requestType === 'site_visit';

  // The site-visit branch promises only that a team member will confirm the
  // day, which holds on any day; the enquiry branch carries the promise the
  // published hours can actually keep (see `callbackPromise`).
  const opening = siteVisit
    ? 'Thank you for requesting a site visit to Tranquill City, Rudraram. We have received your request and a member of our team will call you to confirm a day and time.'
    : `Thank you for contacting ${contact.name}. We have received your enquiry. ${callbackPromise(
        new Date()
      )}`;

  const text = [
    greeting,
    '',
    opening,
    '',
    `Prefer to talk now? Reply to this email${phone ? ` or call ${phone}` : ''}.`,
    ...(contact.whatsapp ? ['', `WhatsApp: ${contact.whatsapp}`] : []),
    '',
    `Plot sizes, pricing and the approval documents: ${projectUrl}`,
    ...(hours ? ['', `Business hours: ${hours}`] : []),
    '',
    contact.name,
    contact.email,
    '',
    'You received this email because you submitted an enquiry on tranquillinfra.com.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f7f4ec;font-family:Manrope,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#24443b">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px">
            <tr>
              <td style="padding:32px;font-size:16px;line-height:1.6">
                <p style="margin:0 0 16px">${escapeHtml(greeting)}</p>
                <p style="margin:0 0 24px">${escapeHtml(opening)}</p>
                ${
                  phone
                    ? `<p style="margin:0 0 28px">
                  <a href="tel:${escapeHtml(contact.phoneE164)}" style="display:inline-block;background:#f2cb67;color:#103e33;font-weight:700;text-decoration:none;padding:14px 24px;border-radius:8px">Call ${escapeHtml(phone)}</a>
                </p>`
                    : ''
                }
                <p style="margin:0 0 12px;font-size:14px;color:#3f6459">
                  Prefer to write? Reply to this email${
                    contact.whatsapp
                      ? ` or <a href="${escapeHtml(contact.whatsapp)}" style="color:#1b5b4b">message us on WhatsApp</a>`
                      : ''
                  }.
                </p>
                <p style="margin:0 0 12px;font-size:14px">
                  <a href="${projectUrl}" style="color:#1b5b4b">Plot sizes, pricing and the approval documents</a>
                </p>
                ${
                  hours
                    ? `<p style="margin:0 0 28px;font-size:14px;color:#3f6459">Business hours: ${escapeHtml(hours)}</p>`
                    : ''
                }
                <p style="margin:0;font-size:14px;color:#3f6459">
                  ${escapeHtml(contact.name)}<br />
                  <a href="mailto:${escapeHtml(contact.email)}" style="color:#1b5b4b">${escapeHtml(contact.email)}</a>
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;max-width:520px;font-size:12px;line-height:1.5;color:#6d8a80">
            You received this email because you submitted an enquiry on tranquillinfra.com.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  await sendEmail({
    to,
    subject: siteVisit
      ? 'We received your site visit request — Tranquill Infra'
      : 'We received your enquiry — Tranquill Infra',
    text,
    html,
    replyTo: CONTACT_TO_EMAIL || contact.email,
  });
}

/** One lead, as the sales notification carries it. */
export interface LeadMail {
  /** Server-side id: quoted in the mail, in the log line and to the client. */
  leadId: string;
  /** The visitor's address, used as Reply-To so a reply reaches them. */
  to: string;
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
  if (phone) rows.push(['Phone', phone]);
  rows.push(['Email', lead.to]);
  if (visitDate) rows.push(['Preferred site-visit date', visitDate]);
  if (page) rows.push(['Submitted from', page]);
  rows.push(['Reference', lead.leadId]);
  if (eventId) rows.push(['Website event', eventId]);

  const text = [
    `${label}: ${who}`,
    '',
    ...rows.map(([field, value]) => `${field}: ${value}`),
    '',
    ...(message ? ['Message:', message] : ['(No message left.)']),
    '',
    ...(attached ? ['The project brochure is attached.'] : []),
    'Reply to this mail and it goes straight to the visitor.',
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
    subject: `${label}: ${who}`,
    text,
    html,
    // A reply from sales must land on the visitor, not on the site's own
    // no-reply sender.
    replyTo: lead.to,
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
  /** Why the sales copy did not go out; absent when it did. */
  salesError?: Error;
  /** Why the visitor's copy did not go out; absent when it did. */
  confirmationError?: Error;
}

/**
 * Mails one submission twice: the sales inbox gets the enquiry, the visitor
 * gets the brochure or the confirmation.
 *
 * The two are independent sends, each attempted whatever the other did — the
 * sales copy first, because it is the one the business runs on, then the
 * visitor's courtesy copy. Neither failure is allowed to mask the other, and
 * neither is swallowed: both outcomes come back so the endpoint can log a
 * single line carrying the lead id and answer the client with a shape that
 * tells "your confirmation failed" apart from "your enquiry failed".
 */
export async function deliverLeadMail(lead: LeadMail): Promise<LeadMailOutcome> {
  const outcome: LeadMailOutcome = { sales: false, confirmation: false };

  try {
    await sendSalesNotification(lead);
    outcome.sales = true;
  } catch (error) {
    outcome.salesError = error instanceof Error ? error : new Error(String(error));
  }

  try {
    if (lead.requestType === 'brochure') {
      await sendBrochureEmail({ to: lead.to, name: lead.name });
    } else {
      await sendConfirmationEmail({ to: lead.to, name: lead.name, requestType: lead.requestType });
    }
    outcome.confirmation = true;
  } catch (error) {
    outcome.confirmationError = error instanceof Error ? error : new Error(String(error));
  }

  return outcome;
}
