import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { EmailDeliveryError, deliverLeadMail } from '~/lib/mail';
import { jsonResponse, rateLimitKey, readFormBody } from '~/lib/http';
import { isRateLimited } from '~/lib/rate-limit';

export const prerender = false;

/**
 * Only the address is load-bearing. Every other field is best-effort — a
 * visitor whose phone number is one character too long still has to reach the
 * sales team, so a field this endpoint does not need is dropped rather than
 * answered with a 400 that would cost the lead.
 */
const customerMailSchema = z.object({
  email: z
    .email('Please enter a valid email address')
    .max(254, 'Please enter a valid email address'),
  name: z.string().max(100).optional(),
  /** The enquiry form's honeypot; a filled value answers like a success and sends nothing. */
  gotcha: z.string().max(200).optional(),
  /** Picks the mail: `brochure` sends the PDF, anything else the confirmation. */
  request_type: z.enum(['enquiry', 'site_visit', 'brochure']).catch('enquiry'),
  phone: z.string().max(20).optional().catch(undefined),
  /** The textarea as the visitor typed it — whitespace is kept, it is their enquiry. */
  message: z.string().max(5000, 'That message is too long').optional().catch(undefined),
  /** `YYYY-MM-DD` from the site-visit date field. An unreadable value is dropped, never fatal. */
  visit_date: z.string().max(40).optional().catch(undefined),
  /** Path the enquiry was submitted from, for the landing page in the notification. */
  page: z.string().max(200).optional().catch(undefined),
  /** The browser's conversion event id, so the sales mail ties back to the analytics. */
  event_id: z.string().max(64).optional().catch(undefined),
});

/**
 * One structured line per delivery attempt, in Workers Logs — the only sink
 * this Worker has.
 *
 * The mail used to fail into a free-text `console.error` that nothing queried,
 * which is how a dead mail path stays dead for weeks while every lead still
 * reports success. The line is flat, single-line and carries the lead id, so
 * `customer_mail` and `sales=failed` are greppable filters rather than prose.
 * No visitor values are logged: they are in the mail, and a log line outlives
 * the enquiry.
 *
 * Level follows severity — a delivered lead is informational, a partial or
 * failed delivery a warning — so the same `customer_mail` filter finds both
 * and the warning count alone answers "is the mail path healthy".
 */
function logDelivery(entry: {
  leadId: string;
  requestType: string;
  sales: boolean;
  confirmation: boolean;
  salesError?: string;
  confirmationError?: string;
}): void {
  const line = [
    'customer_mail',
    `lead_id=${JSON.stringify(entry.leadId)}`,
    `request_type=${JSON.stringify(entry.requestType)}`,
    `sales=${entry.sales ? 'sent' : 'failed'}`,
    `confirmation=${entry.confirmation ? 'sent' : 'failed'}`,
    ...(entry.salesError ? [`sales_error=${JSON.stringify(entry.salesError)}`] : []),
    ...(entry.confirmationError
      ? [`confirmation_error=${JSON.stringify(entry.confirmationError)}`]
      : []),
  ].join(' ');

  if (entry.sales && entry.confirmation) {
    console.info(line);
    return;
  }

  console.warn(line);
}

/**
 * Mails one submission twice: the sales inbox receives the enquiry itself, the
 * visitor receives the brochure or the confirmation.
 *
 * The browser also posts every lead to Formspree, and that is the path this
 * endpoint is the backup for — Formspree being down, out of quota or blocked by
 * the visitor's ad-blocker must not leave the sales team with nothing. The two
 * sends are independent, and the response says which of them happened:
 * `sent` is the sales inbox copy, `confirmation` the visitor's.
 *
 * `reason` names a failure — `rejected_body`, `invalid`, `rate_limited`,
 * `sales_mail_failed`, `confirmation_failed` or `request_failed` — so the
 * client can word the visitor's status line for the case rather than reading
 * a boolean. `sent` and `confirmation` are the delivery contract and only mean
 * anything together.
 *
 * Same-origin callers only: middleware rejects every unsafe method whose Origin
 * header is not the request host.
 */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const body = await readFormBody(request);
    if ('rejection' in body) {
      return jsonResponse(
        { accepted: false, sent: false, reason: 'rejected_body', error: body.rejection.message },
        body.rejection.status
      );
    }

    const field = (name: string): string | undefined =>
      body.formData.get(name)?.toString() || undefined;

    const parsed = customerMailSchema.safeParse({
      email: field('email') ?? '',
      name: field('name'),
      gotcha: field('_gotcha'),
      request_type: field('request_type'),
      phone: field('phone'),
      message: field('message'),
      visit_date: field('visit_date'),
      page: field('page'),
      event_id: field('event_id'),
    });

    if (!parsed.success) {
      return jsonResponse(
        {
          accepted: false,
          sent: false,
          reason: 'invalid',
          error: parsed.error.issues[0]?.message ?? 'Please check the request.',
        },
        400
      );
    }

    // Honeypot: a bot gets the success shape and no mail.
    if (parsed.data.gotcha) {
      return jsonResponse({ accepted: false, sent: true }, 200);
    }

    // Last, so only the mail itself consumes quota: a rejected or honeypotted
    // request sends nothing and must not burn the share of the address it came
    // from (a bot filling the honeypot would otherwise lock out that network).
    if (await isRateLimited(rateLimitKey('customer-mail', clientAddress))) {
      // `reason` is what tells a throttled request apart from a failed send:
      // nothing was handed to Resend here — neither the sales copy nor the
      // visitor's mail — so the client can word the status line for "try again"
      // rather than for a lost enquiry.
      return jsonResponse(
        {
          accepted: false,
          sent: false,
          reason: 'rate_limited',
          error: 'Too many requests. Please try again in a minute.',
        },
        429
      );
    }

    // The lead id is minted here, not taken from the request, and it ties the
    // sales mail, the log line and the client's status line to one submission.
    const leadId = crypto.randomUUID();
    const outcome = await deliverLeadMail({
      leadId,
      to: parsed.data.email,
      name: parsed.data.name,
      phone: parsed.data.phone,
      message: parsed.data.message,
      visitDate: parsed.data.visit_date,
      page: parsed.data.page,
      eventId: parsed.data.event_id,
      requestType: parsed.data.request_type,
    });

    logDelivery({
      leadId,
      requestType: parsed.data.request_type,
      sales: outcome.sales,
      confirmation: outcome.confirmation,
      salesError: outcome.salesError?.message,
      confirmationError: outcome.confirmationError?.message,
    });

    // The sales copy is the one the business runs on: a failure there is a
    // failed request, while a dead visitor mail is only a missing extra once
    // the team has the lead.
    if (!outcome.sales) {
      return jsonResponse(
        {
          accepted: false,
          sent: false,
          reason: 'sales_mail_failed',
          confirmation: outcome.confirmation,
          lead_id: leadId,
          error: 'The email could not be sent. Please try again.',
        },
        outcome.salesError instanceof EmailDeliveryError ? 502 : 500
      );
    }

    return jsonResponse(
      {
        accepted: true,
        sent: true,
        confirmation: outcome.confirmation,
        lead_id: leadId,
        ...(outcome.confirmation
          ? {}
          : {
              reason: 'confirmation_failed',
              error: 'The email could not be sent. Please try again.',
            }),
      },
      200
    );
  } catch (error) {
    // Nothing reached Resend: the failure is in this endpoint, not the provider.
    console.warn(
      `customer_mail lead_id=none reason=request_failed sales=failed confirmation=failed request_error=${JSON.stringify(
        error instanceof Error ? error.message : String(error)
      )}`
    );

    return jsonResponse(
      {
        accepted: false,
        sent: false,
        reason: 'request_failed',
        error: 'The email could not be sent. Please try again.',
      },
      error instanceof EmailDeliveryError ? 502 : 500
    );
  }
};
