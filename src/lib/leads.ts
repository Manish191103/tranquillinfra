/**
 * The lead submission pipeline every lead surface shares — the inline contact
 * form, the enquiry dialog, the newsletter. Formspree is the browser-side
 * endpoint; the Worker's own mail is the independent backup; the browser
 * conversion events fire the moment the lead is accepted.
 *
 * The pure payload builders (`enquirySubject`, `composeEnquiryFields`) are
 * covered by unit tests; the DOM wiring is not.
 */
import {
  collectLeadContext,
  firstTouchTimestampMs,
  LEAD_EVENTS,
  trackFormStart,
  trackLead,
  type LeadKind,
} from './analytics';
import { relayLeadConversion } from './meta-pixel';
import { ENQUIRY_SUCCESS_MESSAGE, REQUEST_TYPE_SUBJECT_LABELS } from './enquiry-cta';

/** Stable per-submission id shared by the browser events and the lead payload. */
function generateEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/* -------------------------------------------------------------------------
   Payload builders (pure)
   ------------------------------------------------------------------------- */

/** The request-type control's value plus the visitor's name, as submitted. */
export interface EnquirySubjectFields {
  name: string;
  requestType: string;
  /**
   * The visit date the CTA promised to capture (`YYYY-MM-DD`). Optional
   * because the brochure and general-enquiry paths have no date to give; when
   * it is there the request is a site visit, whatever the trigger's default
   * was, and the date rides along in the notification subject.
   */
  visitDate?: string;
}

/**
 * Notification subject per request type; the team triages the inbox by it.
 *
 * `enquiry` is deliberately absent, and so is any value the form sends that this
 * module does not know: a plain enquiry's subject reads as an enquiry on its own
 * ("New enquiry from …"), which is how the sales inbox has always triaged it. The
 * two labels that do apply are taken from the shared map rather than retyped, so
 * the wording exists once.
 */
const REQUEST_TYPE_LABELS: Record<string, string | undefined> = {
  site_visit: REQUEST_TYPE_SUBJECT_LABELS.site_visit,
  brochure: REQUEST_TYPE_SUBJECT_LABELS.brochure,
};

/**
 * The visit date goes in the subject rather than only in the body: it is the
 * commercial point of the promise the CTA makes, and the subject line is the
 * one field the sales team reads before opening anything. Formatted in UTC so
 * the day never shifts with the reader's time zone.
 */
const VISIT_DATE_FORMAT = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** A submitted `YYYY-MM-DD` value as a readable date; '' when absent or unreadable. */
function formatVisitDate(visitDate: string | undefined): string {
  if (!visitDate) return '';
  const parsed = new Date(`${visitDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return '';
  return VISIT_DATE_FORMAT.format(parsed);
}

/**
 * Formspree uses the `subject` field as the notification subject, so a brochure
 * or site-visit request has to be recognisable in the inbox; anything else — the
 * plain enquiry, or a request type we do not know — falls back to the enquiry
 * line. A site-visit subject carries the date the visitor asked to visit on.
 */
export function enquirySubject({ name, requestType, visitDate }: EnquirySubjectFields): string {
  const who = name || 'the website';
  const label = REQUEST_TYPE_LABELS[requestType];
  if (!label) return `New enquiry from ${who}`;

  const when = formatVisitDate(visitDate);
  return when ? `${label}: ${who} — visiting ${when}` : `${label}: ${who}`;
}

/** `EnquirySubjectFields` plus the contact form's optional "Subject" input. */
export interface EnquiryFields extends EnquirySubjectFields {
  enquirySubject: string;
}

export interface EnquiryPayloadContext {
  /** Shared by the lead payload, the browser events and the CAPI relay. */
  eventId: string;
  /** Path the form was submitted from. */
  page: string;
  /** Composed notification subject. */
  subject: string;
  /** `collectLeadContext()` output: first touch, referrer, UTMs, click ids. */
  context?: Record<string, string>;
}

/**
 * Fill the payload the browser submits. Mutates and returns `formData`: the
 * caller built it from the form for exactly one submission, and an empty
 * context value (a campaign field this visit never had) is skipped rather than
 * stored blank.
 */
export function composeEnquiryFields(formData: FormData, input: EnquiryPayloadContext): FormData {
  formData.set('event_id', input.eventId);
  formData.set('page', input.page);
  formData.set('subject', input.subject);

  for (const [field, value] of Object.entries(input.context ?? {})) {
    if (value) formData.set(field, value);
  }

  return formData;
}

/* -------------------------------------------------------------------------
   Submission
   ------------------------------------------------------------------------- */

type LeadResult = { ok: true } | { ok: false; message: string; retryable: boolean };

/**
 * POST the form's payload to its Formspree endpoint.
 *
 * With `Accept: application/json` Formspree answers `{ ok: true }` on success
 * and `{ errors: [{ field, message }] }` on a rejected submission; anything else
 * (429 once the account quota is spent, a 5xx, an HTML error page) collapses to
 * one message for the status line. Failures are returned, never thrown, so the
 * caller can always re-enable its button.
 */
async function submitLead(
  form: HTMLFormElement,
  formData: FormData,
  offlineMessage: string
): Promise<LeadResult> {
  try {
    const response = await fetch(form.action, {
      method: 'POST',
      body: formData,
      // Without this header Formspree answers with a page, not JSON.
      headers: { Accept: 'application/json' },
    });
    const data = (await response.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      errors?: { message?: string }[];
    } | null;

    if (response.ok && data?.ok) return { ok: true };

    const detail = data?.errors
      ?.map((error) => error.message)
      .filter(Boolean)
      .join(', ');

    return {
      ok: false,
      // A 4xx that named the offending field is the visitor's own input being
      // refused, so there is nothing for the sales desk to act on and nothing to
      // retry. Everything else — a 429, a 5xx, an HTML error page from a proxy —
      // is our copy of the lead failing to travel, and the Worker's own mail is
      // exactly the independent path that gets it there anyway.
      retryable: !(response.status >= 400 && response.status < 500 && Boolean(detail)),
      message:
        detail ||
        data?.error ||
        (response.status === 429
          ? 'Too many submissions right now. Please try again in a few minutes.'
          : 'Something went wrong'),
    };
  } catch {
    // Offline, DNS failure, or the request blocked before it left the browser —
    // the ad-blocker case. The Worker is still reachable, so the lead survives.
    return { ok: false, message: offlineMessage, retryable: true };
  }
}

/** What the Worker managed to deliver for one accepted lead. */
interface CustomerMailResult {
  /** The sales inbox received the enquiry — the lead the team works from. */
  sent: boolean;
  /** The visitor's own mail went out: the confirmation, or the brochure. */
  confirmation: boolean;
  /** Machine-readable failure (`reason` on the endpoint); for the log line. */
  reason?: string;
  /** Server uuid for this submission; the sales mail and the log line share it. */
  leadId?: string;
}

/**
 * The reference the visitor quotes if they phone the desk. Quoted on the
 * failure line only: that is the one moment they may call, and it is what lets
 * the desk find the submission. A uuid on the success line would be noise on
 * the path that is already converting.
 */
function leadReference(leadId: string | undefined): string {
  return leadId ? ` Your reference: ${leadId.slice(0, 8)}.` : '';
}

/**
 * Hand the accepted lead to the Worker, which mails it twice: the sales inbox
 * gets the enquiry itself and the visitor gets their confirmation (or the
 * brochure). The two answers mean different things — `sent` is the lead, so a
 * dead sales copy is a lead the team never saw, while a dead confirmation is
 * only a missing extra once the team has it.
 *
 * Resolves with the reported outcome on every failure, never throws: the lead
 * has already been accepted by the time this runs, so the form reports a
 * delivery problem, never a failed submission.
 */
async function requestCustomerMail(fields: {
  email: string;
  name: string;
  phone: string;
  message: string;
  requestType: string;
  visitDate: string;
  page: string;
  eventId: string;
  gotcha: string;
}): Promise<CustomerMailResult> {
  const payload = new FormData();
  payload.set('email', fields.email);
  payload.set('name', fields.name);
  payload.set('phone', fields.phone);
  payload.set('message', fields.message);
  payload.set('request_type', fields.requestType);
  payload.set('visit_date', fields.visitDate);
  payload.set('page', fields.page);
  payload.set('event_id', fields.eventId);
  payload.set('_gotcha', fields.gotcha);

  try {
    const response = await fetch('/api/customer-mail', { method: 'POST', body: payload });
    const data = (await response.json().catch(() => null)) as {
      sent?: boolean;
      confirmation?: boolean;
      reason?: string;
      lead_id?: string;
    } | null;
    return {
      sent: Boolean(data?.sent),
      confirmation: Boolean(data?.confirmation),
      ...(data?.reason ? { reason: data.reason } : {}),
      ...(data?.lead_id ? { leadId: data.lead_id } : {}),
    };
  } catch {
    return { sent: false, confirmation: false, reason: 'request_failed' };
  }
}

/** Everything `bindLeadForm` needs from the surface that renders the form. */
export interface LeadFormOptions {
  form: HTMLFormElement;
  button: HTMLButtonElement;
  /** The form's `role="status"` line: success and failure text land here. */
  message: HTMLElement;
  /** Drives the events, the CAPI relay and (for enquiries) the customer mail. */
  kind: LeadKind;
  /** Composes the Formspree notification subject from the submitted fields. */
  composeSubject: (fields: EnquiryFields & { email: string }) => string;
  /** Button label restored after a submission. */
  submitLabel?: string;
  /** Button label while the submission is in flight. */
  submittingLabel?: string;
  /** Status text when the submission could not reach Formspree at all. */
  offlineMessage?: string;
  /**
   * Where the visitor goes when the brochure email did not go out. The status
   * line is a text node, so "download it from the project page" with no link is
   * a dead end; the destination is appended as a real anchor instead.
   */
  brochureFallback?: { href: string; label: string };
  /**
   * Status-line classes per outcome. Defaults fit the enquiry surfaces; the
   * newsletter keeps its own hook class so a later re-init can find the line.
   */
  statusClasses?: { success?: string; error?: string };
  /** Runs after a successful submission, once the status line is written. */
  onSuccess?: () => void;
  /**
   * Runs when the lead may not have reached the team: the Formspree POST was
   * rejected, or the sales-desk copy failed. The enquiry surfaces reveal the
   * phone and WhatsApp routes here — a visitor whose enquiry never landed has
   * no other way to reach us.
   */
  onFailure?: () => void;
}

/**
 * Append a fallback destination to the status line as a real anchor. Built with
 * DOM calls rather than `innerHTML`: the line is a live region, and only the
 * surface's own href and label ever go in.
 */
function appendStatusLink(message: HTMLElement, link: { href: string; label: string }): void {
  const anchor = document.createElement('a');
  anchor.href = link.href;
  anchor.textContent = link.label;
  anchor.className = 'underline underline-offset-2';
  // The delegated click layer reads `data-track`, so the fallback brochure
  // shows up as the same download intent as every other brochure link. This is
  // the only copy the visitor gets when the brochure email fails, which makes
  // it the one that most needs counting.
  anchor.dataset.track = 'brochure';
  message.append(' ', anchor);
}

/**
 * Wire a lead form's submission: Formspree first, the customer mail second
 * (enquiries only), the browser events once the lead is accepted.
 */
export function bindLeadForm({
  form,
  button,
  message,
  kind,
  composeSubject,
  submitLabel = 'Submit',
  submittingLabel = 'Sending...',
  offlineMessage = 'Failed to send message. Please try again.',
  statusClasses = {},
  brochureFallback,
  onSuccess,
  onFailure,
}: LeadFormOptions): void {
  // Re-running after a view-transition swap must not stack a second handler.
  if (form.dataset.leadFormInit === 'true') return;
  form.dataset.leadFormInit = 'true';

  const successClass = statusClasses.success ?? 'text-sm text-success';
  const errorClass = statusClasses.error ?? 'text-sm text-destructive';
  const successMessage = form.dataset.successMessage || ENQUIRY_SUCCESS_MESSAGE;
  const markStarted = () => trackFormStart(form);
  form.addEventListener('input', markStarted, { once: true });
  form.addEventListener('focusin', markStarted, { once: true });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    button.disabled = true;
    button.textContent = submittingLabel;
    message.textContent = '';

    // The event id ties the browser conversion events to the lead we submit.
    const eventId = generateEventId();
    const formData = new FormData(form);

    const name = String(formData.get('name') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const phone = String(formData.get('phone') ?? '').trim();
    const gotcha = String(formData.get('_gotcha') ?? '').trim();
    const visitDate = String(formData.get('visit_date') ?? '').trim();
    // The textarea is the enquiry itself; the status line owns `message`.
    const leadMessage = String(formData.get('message') ?? '').trim();
    const enquirySubjectInput = String(formData.get('enquiry_subject') ?? '').trim();
    const page = window.location.pathname;

    const selectedRequestType = String(formData.get('request_type') ?? '').trim();
    // A date in the form IS a site-visit request, whatever the control or the
    // trigger's default said: the visitor asked to be there on a day, and the
    // team triages the inbox by this value.
    const requestType =
      visitDate || selectedRequestType === 'site_visit' ? 'site_visit' : selectedRequestType;
    if (visitDate) formData.set('visit_date', visitDate);
    formData.set('request_type', requestType);

    // Collected once: the payload and the CAPI relay share the same context.
    const context = collectLeadContext();

    composeEnquiryFields(formData, {
      eventId,
      page,
      subject: composeSubject({
        name,
        email,
        requestType,
        visitDate,
        enquirySubject: enquirySubjectInput,
      }),
      context,
    });

    const lead = await submitLead(form, formData, offlineMessage);

    // The lead exists the moment Formspree accepts it, so the conversion is
    // reported there and not one line further down. It used to wait behind the
    // Worker's mail round-trip, which left a real, sales-desk-confirmed enquiry
    // unreported whenever the visitor closed the tab, hit back, followed a nav
    // link or triggered a client-side navigation inside that window — the
    // likeliest mechanical cause of "the campaign records no leads" against a
    // steady stream of enquiries. `trackLead` only queues into `dataLayer`, so
    // firing it before the UI is settled is free.
    if (lead.ok) trackLead(kind, eventId, { page }, { email, phone, name });

    // The Worker's copy is asked for whenever the form itself is sound, and not
    // only when Formspree accepted. Formspree is a third party on every layer —
    // it can be down, its free plan is 50 submissions a month, and formspree.io
    // is on common ad-blocker lists — so a browser POST that failed to travel is
    // precisely the case the backup exists for. Gating it on `lead.ok` would
    // leave the lead lost in exactly the outage it was built to survive. A
    // rejected field is the one case we skip: the visitor's own input is wrong,
    // so there is no lead to deliver.
    const mailable = kind === 'contact' && (lead.ok || lead.retryable);
    const mail = mailable
      ? await requestCustomerMail({
          email,
          name,
          phone,
          message: leadMessage,
          requestType,
          visitDate,
          page,
          eventId,
          gotcha,
        })
      : null;

    // Set when the lead may not have reached the team. Fired after `onSuccess`
    // so a surface cannot hide the fallback the moment it reveals it.
    let undelivered = false;

    if (lead.ok) {
      if (mail) {
        const brochure = requestType === 'brochure';

        if (!mail.sent) {
          // The browser POST is only half the delivery: the sales desk works
          // from the Worker's copy of the enquiry, so a failed copy is a lead
          // the team may never see. A throttled request lost nothing and is
          // worth a retry; anything else is reported as what it is, with the
          // phone and WhatsApp revealed.
          const throttled = mail.reason === 'rate_limited';
          undelivered = !throttled;
          message.textContent = throttled
            ? `${successMessage} Your confirmation could not be sent just now — please try again in a minute.${leadReference(mail.leadId)}`
            : `We could not reach the sales desk with that. Please call or WhatsApp us and we will pick it up straight away.${leadReference(mail.leadId)}`;
          message.className = throttled ? successClass : errorClass;
        } else if (!mail.confirmation) {
          message.textContent = `${successMessage}${
            brochure
              ? ' The brochure email did not go through.'
              : ' Your confirmation email did not go through, but your enquiry has reached us.'
          }`;
          message.className = successClass;
          // The one failure the visitor can still act on: the PDF is right here.
          if (brochure && brochureFallback) appendStatusLink(message, brochureFallback);
        } else {
          message.textContent = `${successMessage}${
            brochure
              ? ` The brochure is on its way to ${email}.`
              : ` A confirmation is on its way to ${email}.`
          }`;
          message.className = successClass;
        }
      } else {
        message.textContent = successMessage;
        message.className = successClass;
      }
      form.reset();
      if (!gotcha) {
        relayLeadConversion({
          eventId,
          eventName: LEAD_EVENTS[kind].meta,
          leadType: kind,
          email,
          phone,
          name,
          fbclid: context.fbclid,
          fbclidAtMs: firstTouchTimestampMs() ?? undefined,
        });
      }
      onSuccess?.();
      if (undelivered) onFailure?.();
    } else if (mail?.sent) {
      // Formspree did not take the POST, but the Worker's own copy reached the
      // sales desk. Reporting the browser failure here would be a lie: the team
      // has the enquiry. The conversion event still fires, because a lead really
      // was delivered.
      message.textContent = `${successMessage} Our form provider is having trouble, but your enquiry has reached the sales desk directly.${leadReference(mail.leadId)}`;
      message.className = successClass;
      trackLead(kind, eventId, { page }, { email, phone, name });
      if (!gotcha) {
        relayLeadConversion({
          eventId,
          eventName: LEAD_EVENTS[kind].meta,
          leadType: kind,
          email,
          phone,
          name,
          fbclid: context.fbclid,
          fbclidAtMs: firstTouchTimestampMs() ?? undefined,
        });
      }
      onSuccess?.();
    } else {
      message.textContent = mail
        ? `${lead.message} Your enquiry did not reach the sales desk — please call or WhatsApp us and we will pick it up straight away.`
        : lead.message;
      message.className = errorClass;
      onFailure?.();
    }

    button.disabled = false;
    button.textContent = submitLabel;
  });
}
