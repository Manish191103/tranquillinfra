import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { sendMetaConversion } from '~/lib/meta-conversions';
import { jsonResponse, rateLimitKey, readFormBody } from '~/lib/http';
import { isRateLimited } from '~/lib/rate-limit';

export const prerender = false;

const conversionSchema = z.object({
  event_id: z.string().min(8).max(100),
  /** Website events only, and only the two the site actually reports. */
  event_name: z.enum(['Lead', 'NewsletterSignup']),
  lead_type: z.string().max(40),
  event_source_url: z.string().max(500).optional(),
  email: z.string().max(254).optional(),
  phone: z.string().max(20).optional(),
  name: z.string().max(100).optional(),
  fbclid: z.string().max(512).optional(),
  /** First-touch capture time — the `fbc` rebuild's click time, when known. */
  fbclid_at_ms: z.coerce.number().int().positive().optional(),
});

/** First-party `_fbp` / `_fbc` cookies, set on this domain by fbevents.js. */
function cookieValue(header: string | null, name: string): string | undefined {
  for (const part of header?.split(';') ?? []) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=') || undefined;
  }
  return undefined;
}

/**
 * Relays a browser lead to Meta's Conversions API (the server leg of the
 * pixel). Called by `relayLeadConversion` on submission success, same-origin
 * only (middleware), rate limited like the brochure endpoint. The route holds
 * no consent state and forwards hashed identifiers only.
 */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  const body = await readFormBody(request);
  if ('rejection' in body) return jsonResponse({ accepted: false }, body.rejection.status);

  const field = (name: string) => body.formData.get(name)?.toString().trim() || undefined;
  const parsed = conversionSchema.safeParse({
    event_id: field('event_id') ?? '',
    event_name: field('event_name'),
    lead_type: field('lead_type') ?? 'contact',
    event_source_url: field('event_source_url'),
    email: field('email'),
    phone: field('phone'),
    name: field('name'),
    fbclid: field('fbclid'),
    fbclid_at_ms: field('fbclid_at_ms'),
  });
  if (!parsed.success) return jsonResponse({ accepted: false }, 400);

  if (await isRateLimited(rateLimitKey('meta-conversion', clientAddress))) {
    return jsonResponse({ accepted: false, reason: 'rate_limited' }, 429);
  }

  const cookies = request.headers.get('cookie');
  const result = await sendMetaConversion({
    eventName: parsed.data.event_name,
    eventId: parsed.data.event_id,
    leadType: parsed.data.lead_type,
    eventSourceUrl: parsed.data.event_source_url ?? new URL(request.url).origin,
    email: parsed.data.email,
    phone: parsed.data.phone,
    name: parsed.data.name,
    fbclid: parsed.data.fbclid,
    fbclidAtMs: parsed.data.fbclid_at_ms,
    fbp: cookieValue(cookies, '_fbp'),
    fbc: cookieValue(cookies, '_fbc'),
    clientIp: clientAddress,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });

  // Inert until the pixel id and the access token are provisioned.
  if (!result.accepted && result.reason === 'not-configured') {
    return jsonResponse({ accepted: false }, 503);
  }

  return jsonResponse(result, 200);
};
