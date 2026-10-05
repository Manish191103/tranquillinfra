import { defineMiddleware } from 'astro:middleware';

/**
 * Security headers for on-demand responses.
 *
 * Prerendered pages are served by Cloudflare's static-asset server, where
 * `public/_headers` applies (including the prerendered 404 page, which is
 * fetched through the ASSETS binding before any middleware runs). Cloudflare
 * does not apply that file to responses the Worker generates (documented in
 * developers.cloudflare.com/workers/static-assets/headers), so the lead and
 * measurement API routes get the same headers here instead. The two copies are
 * mirrored by hand — see the CSP note in AGENTS.md.
 */
const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), browsing-topics=(), interest-cohort=(), usb=(), serial=(), hid=(), accelerometer=(), gyroscope=(), magnetometer=()',
  // Same policy as `public/_headers`, `connect-src` included: the Formspree
  // AJAX POST, the GA4/gtag collection endpoints, Meta's pixel relay and the
  // GitHub REST API the Decap CMS admin (/decapcms/) talks to from the
  // browser.
  // `form-action` names formspree.io because the lead forms post there when
  // JavaScript is off; the AJAX path is a fetch, which `form-action` does not
  // govern. The strict hash-based policy needs the inline GA bootstrap script
  // pinned and ClientRouter dropped — that is why there is no
  // `script-src`/`style-src` yet.
  'Content-Security-Policy':
    "base-uri 'self'; connect-src 'self' https://formspree.io https://api.github.com https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://www.facebook.com; object-src 'none'; form-action 'self' https://formspree.io; frame-ancestors 'none'",
} as const;

const SAFE_METHODS: Record<string, true> = { GET: true, HEAD: true, OPTIONS: true };

export const onRequest = defineMiddleware(async (context, next) => {
  // `security.checkOrigin` only compares the Origin header for form-like content
  // types, leaving an unsafe request with any other body type to the route. No
  // visitor flow posts without an Origin, so require a same-origin one here for
  // every unsafe method — the protection then cannot silently regress when a
  // route changes what it accepts.
  const { request, url } = context;

  if (!SAFE_METHODS[request.method] && request.headers.get('origin') !== url.origin) {
    return new Response(`Cross-site ${request.method} submissions are forbidden`, {
      status: 403,
      headers: { ...SECURITY_HEADERS, 'Cache-Control': 'no-store' },
    });
  }

  const response = await next();

  // Astro's dev-only `/_image` endpoint returns a response whose headers are
  // frozen; setting anything on it throws. Copying instead of mutating keeps
  // hero images loading during `astro dev`.
  try {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      if (!response.headers.has(name)) {
        response.headers.set(name, value);
      }
    }
  } catch {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  return response;
});
