/**
 * The lead submission pipeline every lead surface shares — the inline contact
 * form, the enquiry dialog, the newsletter. Formspree is the browser-side
 * endpoint; the Worker's own mail is the independent backup; the browser
 * conversion events fire only after sales-mail acceptance (Formspree for newsletters).
 *
 */
import {
  collectLeadContext,
  firstTouchTimestampMs,
  trackFormStart,
  trackLead,
  type LeadKind,
} from './analytics';
import { LEAD_CONTEXT_FIELDS } from './lead-context';
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

/** Bounds both receiving headers and reading the provider response. */
async function postJson(
  url: string,
  body: FormData,
  timeoutMs: number
): Promise<{ response: Response; data: unknown }> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Submission timed out'));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, {
          method: 'POST',
          body,
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        return { response, data: await response.json().catch(() => null) };
      })(),
      expired,
    ]);
  } finally {
    clearTimeout(timer!);
  }
}

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
    const result = await postJson(form.action, formData, 8_000);
    const response = result.response;
    const data = result.data as {
      ok?: boolean;
      error?: string;
      errors?: { field?: string; message?: string }[];
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
      retryable: !(
        [400, 422].includes(response.status) &&
        data?.errors?.some((error) => Boolean(error.field && error.message))
      ),
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
  /** Genuine enquiry accepted by the sales email provider. */
  accepted: boolean;
  /** The sales inbox received the enquiry — the lead the team works from. */
  sent: boolean;
  /** The visitor's own mail went out: the confirmation, or the brochure. */
  confirmation: boolean;
  /** Machine-readable failure (`reason` on the endpoint); for the log line. */
  reason?: string;
  /** Server-derived reference shared by sales mail, retries and delivery logs. */
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
 * Resolves with the reported outcome on every failure. Only explicit sales
 * acceptance permits enquiry measurement and the real success callback.
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
  pageLocation: string;
  fbclidAtMs?: number;
  subject: string;
  enquirySubject: string;
  formType: string;
  submittedAt: string;
  context: Record<string, string>;
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
  payload.set('subject', fields.subject);
  payload.set('enquiry_subject', fields.enquirySubject);
  payload.set('form_type', fields.formType);
  payload.set('submitted_at', fields.submittedAt);
  payload.set('event_source_url', fields.pageLocation);
  if (fields.fbclidAtMs) payload.set('fbclid_at_ms', String(fields.fbclidAtMs));
  for (const key of LEAD_CONTEXT_FIELDS) {
    if (fields.context[key]) payload.set(key, fields.context[key]);
  }

  try {
    const result = await postJson('/api/customer-mail/', payload, 25_000);
    const response = result.response;
    const data = result.data as {
      accepted?: boolean;
      sent?: boolean;
      confirmation?: boolean;
      reason?: string;
      lead_id?: string;
    } | null;
    return {
      accepted: response.ok && data?.accepted === true && data?.sent === true,
      sent: data?.sent === true,
      confirmation: Boolean(data?.confirmation),
      ...(data?.reason ? { reason: data.reason } : {}),
      ...(data?.lead_id ? { leadId: data.lead_id } : {}),
    };
  } catch {
    return { accepted: false, sent: false, confirmation: false, reason: 'request_failed' };
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

  let submitting = false;
  let pending: {
    fingerprint: string;
    eventId: string;
    submittedAt: string;
    context: Record<string, string>;
    page: string;
    pageLocation: string;
    pageTitle: string;
    fbclidAtMs?: number;
    lead?: LeadResult;
  } | null = null;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    try {
      button.disabled = true;
      button.textContent = submittingLabel;
      message.textContent = '';

      // The event id ties the browser conversion events to the lead we submit.
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
      const pageLocation = window.location.href;
      const pageTitle = document.title;

      const selectedRequestType = String(formData.get('request_type') ?? '').trim();
      // A date in the form IS a site-visit request, whatever the control or the
      // trigger's default said: the visitor asked to be there on a day, and the
      // team triages the inbox by this value.
      const requestType =
        visitDate || selectedRequestType === 'site_visit' ? 'site_visit' : selectedRequestType;
      if (visitDate) formData.set('visit_date', visitDate);
      formData.set('request_type', requestType);

      // Freeze the submission context so retries preserve mail and event identity.
      const fingerprint = JSON.stringify(
        Array.from(formData.entries()).map(([key, value]) => [key, String(value)])
      );
      if (
        !pending ||
        pending.fingerprint !== fingerprint ||
        Date.now() - Date.parse(pending.submittedAt) >= 23 * 60 * 60 * 1000
      ) {
        pending = {
          fingerprint,
          eventId: generateEventId(),
          submittedAt: new Date().toISOString(),
          context: collectLeadContext(),
          page,
          pageLocation,
          pageTitle,
          fbclidAtMs: firstTouchTimestampMs() ?? undefined,
        };
      }
      const { eventId, context, submittedAt } = pending;

      composeEnquiryFields(formData, {
        eventId,
        page: pending.page,
        subject: composeSubject({
          name,
          email,
          requestType,
          visitDate,
          enquirySubject: enquirySubjectInput,
        }),
        context,
      });

      const lead = pending.lead?.ok
        ? pending.lead
        : await submitLead(form, formData, offlineMessage);
      pending.lead = lead;

      const mailable = kind === 'contact' && (lead.ok || lead.retryable);
      const mail = mailable
        ? await requestCustomerMail({
            email,
            name,
            phone,
            message: leadMessage,
            requestType,
            visitDate,
            page: pending.page,
            pageLocation: pending.pageLocation,
            fbclidAtMs: pending.fbclidAtMs,
            eventId,
            gotcha,
            submittedAt,
            context,
            subject: String(formData.get('subject') ?? ''),
            enquirySubject: enquirySubjectInput,
            formType: String(formData.get('form_type') ?? ''),
          })
        : null;

      const accepted = !gotcha && (kind === 'newsletter' ? lead.ok : mail?.accepted === true);
      if (gotcha) {
        message.textContent = successMessage;
        message.className = successClass;
        form.reset();
        pending = null;
      } else if (accepted) {
        const params = {
          page: pending.page,
          page_location: pending.pageLocation,
          page_title: pending.pageTitle,
          request_type: requestType,
          form: form.id || 'form',
        };
        trackLead(kind, eventId, params, { email, phone });
        message.className = successClass;
        if (kind === 'newsletter') {
          message.textContent = successMessage;
        } else if (!mail?.confirmation) {
          message.textContent = `${successMessage} ${
            requestType === 'brochure'
              ? 'The brochure email did not go through.'
              : 'Your confirmation email did not go through, but your enquiry has reached us.'
          }`;
          if (requestType === 'brochure' && brochureFallback)
            appendStatusLink(message, brochureFallback);
        } else {
          message.textContent = `${successMessage} ${
            requestType === 'brochure'
              ? `The brochure is on its way to ${email}.`
              : 'A confirmation is on its way to your email.'
          }`;
        }
        if (!lead.ok)
          message.append(
            ` Our form provider is having trouble, but your enquiry has reached the sales desk directly.${leadReference(mail?.leadId)}`
          );
        form.reset();
        pending = null;
        onSuccess?.();
      } else {
        message.className = errorClass;
        message.textContent =
          lead.ok && kind === 'contact'
            ? `Your enquiry was captured, but we could not notify the sales desk. Please try again or call or WhatsApp us.${leadReference(mail?.leadId)}`
            : mail?.reason === 'rate_limited'
              ? 'Too many requests. Please try again in a minute, or call or WhatsApp us.'
              : kind === 'newsletter' && !lead.ok
                ? lead.message
                : `${lead.ok ? '' : lead.message} Your enquiry did not reach the sales desk — please call or WhatsApp us and we will pick it up straight away.`;
        onFailure?.();
      }
    } finally {
      submitting = false;
      button.disabled = false;
      button.textContent = submitLabel;
    }
  });
}
