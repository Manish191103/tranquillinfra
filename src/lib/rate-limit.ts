import { env } from 'cloudflare:workers';

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/**
 * Platform rate limiter keyed per visitor and route (see `rateLimitKey` in
 * `src/lib/http.ts` for the bucket shape) — the `ratelimits` binding declared
 * in `wrangler.jsonc` (`env.LEAD_RATE_LIMITER`). Cloudflare documents the
 * counter as permissive and per-location, so it throttles sustained abuse
 * rather than capping bursts; the precise control is a zone rate-limiting rule
 * once the domain is on Cloudflare.
 *
 * This module is the only place that touches the binding, so the pure guards in
 * `src/lib/http.ts` stay testable outside workerd.
 *
 * A missing binding throws. Wrangler does not inherit `ratelimits` into named
 * environments, so an environment that forgot to repeat the block used to ship
 * completely unthrottled behind one console warning per isolate — which is a
 * deployment mistake, not a runtime condition to absorb: the lead endpoints
 * answer 500, Workers Logs carries the reason, and the visitor is told the
 * request failed instead of being shown a success that reached nobody.
 */
export async function isRateLimited(key: string): Promise<boolean> {
  const limiter = (env as Record<string, unknown>).LEAD_RATE_LIMITER as RateLimiter | undefined;

  if (!limiter) {
    throw new Error(
      'LEAD_RATE_LIMITER is not bound: repeat the `ratelimits` block from wrangler.jsonc in this environment.'
    );
  }

  const { success } = await limiter.limit({ key });
  return !success;
}
