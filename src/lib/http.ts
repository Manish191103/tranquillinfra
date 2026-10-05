/**
 * Pure guards for the public endpoints — no platform imports, so this module is
 * importable by vitest. The rate-limit binding lives in `src/lib/rate-limit.ts`.
 *
 * The lead forms post straight to Formspree, so the only endpoint left here is
 * the customer-mail one, which takes a small form body from the site's own form
 * script.
 */

/** The media types `request.formData()` can parse. */
const FORM_CONTENT_TYPES = ['multipart/form-data', 'application/x-www-form-urlencoded'];

/**
 * The cap has to hold the visitor's whole enquiry, not just the contact fields:
 * a prospect describing the plot they are comparing writes several paragraphs,
 * and this endpoint now carries that enquiry to the sales inbox as the backup
 * for the Formspree post. A body refused here is a lead the team never sees.
 */
const MAX_BODY_BYTES = 24 * 1024;

const NOT_A_FORM = {
  status: 415,
  message: 'Please use the website form to send this request.',
} as const;

const TOO_LARGE = { status: 413, message: 'That request is too large.' } as const;

export interface BodyRejection {
  status: number;
  message: string;
}

/**
 * JSON response for the public endpoints. `no-store` because every one of them
 * answers per-request (a rejection status, a delivery outcome) and none is safe
 * to reuse from a cache.
 */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/**
 * Reads the request body and parses it as a form, refusing to buffer past
 * `MAX_BODY_BYTES`.
 *
 * A declared `Content-Length` is rejected up front, but a chunked request has
 * none — so the cap is also enforced while reading, and the reader is cancelled
 * as soon as the body exceeds it. The bytes read are handed back to `formData()`
 * through a rebuilt request (the stream can only be consumed once). Media types
 * `formData()` cannot parse are rejected before the body is touched; the essence
 * decides, so the multipart boundary parameter cannot influence the check.
 */
export async function readFormBody(
  request: Request
): Promise<{ formData: FormData } | { rejection: BodyRejection }> {
  const essence = (request.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase();
  if (!FORM_CONTENT_TYPES.includes(essence)) {
    return { rejection: NOT_A_FORM };
  }

  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return { rejection: TOO_LARGE };
  }

  let bytes: ArrayBuffer | null;
  try {
    bytes = await readCapped(request, MAX_BODY_BYTES);
  } catch {
    // Truncated or otherwise unreadable body — the caller cannot fix this.
    return { rejection: NOT_A_FORM };
  }

  if (!bytes) {
    return { rejection: TOO_LARGE };
  }

  const headers = new Headers(request.headers);
  headers.delete('content-length');
  headers.delete('transfer-encoding');

  try {
    const formData = await new Request(request.url, {
      method: 'POST',
      headers,
      body: bytes,
    }).formData();
    return { formData };
  } catch {
    // A body the parser refuses despite a form media type (bad boundary, bad percent-encoding).
    return { rejection: NOT_A_FORM };
  }
}

/** Streams at most `max` bytes, cancelling the body as soon as it exceeds the cap. */
async function readCapped(request: Request, max: number): Promise<ArrayBuffer | null> {
  if (!request.body) return new ArrayBuffer(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const buffer = new ArrayBuffer(total);
  const bytes = new Uint8Array(buffer);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return buffer;
}

/**
 * Collapses a visitor address to the unit the limiter counts: IPv4 verbatim,
 * IPv6 to its /56 prefix. A single visitor is routinely delegated a whole
 * prefix (residential and mobile allocations are /56 or shorter), so counting
 * the full address would hand them 2^64 fresh buckets and make the ceiling
 * unbounded.
 *
 * /56 rather than /64: an Indian mobile carrier hands one /64 to a whole
 * subscriber group, and counting that as one visitor refused the sixth real
 * enquiry in a minute from behind it (observed 2026-09) — the brochure or
 * confirmation was dropped while the lead itself had already been accepted.
 * A /56 keeps a group split into 256 buckets, which is far finer than the
 * subscriber count a carrier shares.
 */
export function rateLimitKey(scope: string, address: string | undefined): string {
  return `${scope}:${addressKey(address)}`;
}

function addressKey(address: string | undefined): string {
  if (!address) return 'unknown';

  const value = address.trim().toLowerCase();
  if (!value.includes(':')) return value;

  const prefix = ipv6Prefix56(value);
  // Prefix the family so an IPv4 address can never collide with a prefix string.
  return prefix ? `v6-56:${prefix}` : `v6:${value}`;
}

/**
 * The first 14 hex digits (56 bits) of an IPv6 address, or `null` for a value
 * that will not expand — an IPv4-mapped or malformed address then keys
 * verbatim rather than collapsing unrelated visitors into one bucket.
 */
function ipv6Prefix56(address: string): string | null {
  const gap = address.indexOf('::');
  const head = gap === -1 ? address : address.slice(0, gap);
  const tail = gap === -1 ? '' : address.slice(gap + 2);
  const headGroups = head ? head.split(':') : [];
  const tailGroups = tail ? tail.split(':') : [];
  const missing = 8 - headGroups.length - tailGroups.length;
  if (missing < 0 || (gap === -1 && missing !== 0)) return null;

  const groups =
    gap === -1 ? headGroups : [...headGroups, ...Array<string>(missing).fill('0'), ...tailGroups];
  const hex = groups.map((group) => group.padStart(4, '0')).join('');
  return /^[0-9a-f]{32}$/.test(hex) ? hex.slice(0, 14) : null;
}
