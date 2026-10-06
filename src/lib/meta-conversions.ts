/**
 * Meta Conversions API — the server leg of the pixel: identifier
 * normalization, hashing and the Graph API sender.
 *
 * One event per sales-accepted lead: the identifiers Meta requires hashed are
 * SHA-256'd, `fbp`/`fbc` and the visitor's IP/user agent ride along as-is, and
 * `event_id` matches the browser `eventID`, so Meta deduplicates the pair
 * (48 h window). Inert without the pixel id or `META_CAPI_ACCESS_TOKEN`.
 *
 * Graph API v26.0 (current 2026-07-29 — check the changelog before bumping).
 */
import type { MetaEventName } from '~/lib/analytics';
import { analyticsConfig } from '~/config/analytics.config';
import { META_CAPI_ACCESS_TOKEN, META_TEST_EVENT_CODE } from 'astro:env/server';

const GRAPH_URL = 'https://graph.facebook.com/v26.0';
const REQUEST_TIMEOUT_MS = 10_000;

export interface LeadConversion {
  eventName: MetaEventName;
  eventId: string;
  /** Original submission time, retained when an accepted lead is retried. */
  eventTimeSeconds?: number;
  eventSourceUrl: string;
  leadType: string;
  email?: string;
  phone?: string;
  name?: string;
  fbclid?: string;
  /** First-touch capture time for the `fbc` rebuild, when the cookie is gone. */
  fbclidAtMs?: number;
  fbp?: string;
  fbc?: string;
  clientIp?: string;
  userAgent?: string;
}

export type MetaConversionResult = { accepted: true } | { accepted: false; reason: string };

/* -------------------------------------------------------------------------
   Identifier normalization — Meta's documented rules (customer-information
   parameters). Everything produced here is hashed before it leaves; `fbp`/
   `fbc`, the IP and the user agent ride along as-is.
   ------------------------------------------------------------------------- */

/** SHA-256 hex digest — the only format Meta accepts for `em`, `ph`, `fn`, `ln`. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * The values Meta matches on, from a form submission: email trimmed and
 * lowercased; phone reduced to digits with the country code kept and leading
 * zeros dropped; first and last name kept as lowercase letters only. `null`
 * means "not matchable" — the sender drops that field.
 */
export function normalizeIdentifiers(input: { email?: string; phone?: string; name?: string }): {
  em: string | null;
  ph: string | null;
  fn: string | null;
  ln: string | null;
} {
  const em = input.email?.trim().toLowerCase() || null;
  const phone = (input.phone ?? '').trim();
  const digits = phone.replace(/\D+/g, '').replace(/^0+/, '');
  const normalizedPhone =
    !phone.startsWith('+') && /^\d{10}$/.test(digits) ? `91${digits}` : digits;
  const parts = (input.name ?? '')
    .trim()
    .split(/\s+/)
    .map((part) => part.toLowerCase().replace(/[^\p{L}]/gu, ''))
    .filter(Boolean);

  return {
    em,
    ph: normalizedPhone.length >= 8 && normalizedPhone.length <= 15 ? normalizedPhone : null,
    fn: parts.at(0) ?? null,
    ln: parts.length > 1 ? (parts.at(-1) ?? null) : null,
  };
}

/** Meta's documented `fbc` format: `fb.1.<click time in ms>.<fbclid>`. */
export function buildFbc(fbclid: string, clickedAtMs: number): string {
  return `fb.1.${clickedAtMs}.${fbclid}`;
}

/** First-party pixel cookies captured from the accepted lead's request. */
export function metaCookieValue(header: string | null, name: '_fbp' | '_fbc'): string | undefined {
  for (const part of header?.split(';') ?? []) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=') || undefined;
  }
  return undefined;
}

/** Continue measurement after responding to the visitor; no durable retry queue. */
export function scheduleLeadConversion(
  waitUntil: (promise: Promise<unknown>) => void,
  input: LeadConversion
): void {
  try {
    waitUntil(
      sendMetaConversion(input)
        .catch((): MetaConversionResult => ({ accepted: false, reason: 'request-failed' }))
        .then((result) => {
          const line = `meta_conversion event_id=${JSON.stringify(input.eventId)} accepted=${result.accepted}${
            result.accepted ? '' : ` reason=${JSON.stringify(result.reason)}`
          }`;
          if (result.accepted) console.info(line);
          else console.warn(line);
        })
    );
  } catch {
    console.warn(
      `meta_conversion event_id=${JSON.stringify(input.eventId)} accepted=false reason=scheduling-failed`
    );
  }
}

/* -------------------------------------------------------------------------
   Sender
   ------------------------------------------------------------------------- */

/** POST the event to the dataset's `/events` edge. Never throws, never logs PII. */
export async function sendMetaConversion(input: LeadConversion): Promise<MetaConversionResult> {
  const pixelId = analyticsConfig.pixelId ?? undefined;
  const token = META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !token) return { accepted: false, reason: 'not-configured' };

  const userData: Record<string, unknown> = {};
  const ids = normalizeIdentifiers({ email: input.email, phone: input.phone, name: input.name });
  if (ids.em) userData.em = [await sha256Hex(ids.em)];
  if (ids.ph) userData.ph = [await sha256Hex(ids.ph)];
  if (ids.fn) userData.fn = [await sha256Hex(ids.fn)];
  if (ids.ln) userData.ln = [await sha256Hex(ids.ln)];
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;
  else if (input.fbclid) userData.fbc = buildFbc(input.fbclid, input.fbclidAtMs ?? Date.now());
  if (input.clientIp) userData.client_ip_address = input.clientIp;
  if (input.userAgent) userData.client_user_agent = input.userAgent;

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: input.eventName,
        event_time: input.eventTimeSeconds ?? Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: 'website',
        event_source_url: input.eventSourceUrl,
        user_data: userData,
        custom_data: { lead_type: input.leadType },
      },
    ],
  };
  if (META_TEST_EVENT_CODE) body.test_event_code = META_TEST_EVENT_CODE;

  try {
    const response = await fetch(
      `${GRAPH_URL}/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        // Bounded like the Resend call: an unreachable Graph endpoint must not
        // hold the request open until the platform gives up on it.
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }
    );
    const result = (await response.json().catch(() => null)) as {
      fbtrace_id?: string;
      events_received?: number;
    } | null;

    if (response.ok && result?.events_received === 1) return { accepted: true };

    // One line, no identifiers: the trace id is what Meta's support asks for.
    console.warn('Meta CAPI rejected the event', response.status, result?.fbtrace_id ?? '');
    return { accepted: false, reason: `graph-${response.status}` };
  } catch (error) {
    console.warn('Meta CAPI request failed', error instanceof Error ? error.name : 'unknown');
    return { accepted: false, reason: 'network' };
  }
}
