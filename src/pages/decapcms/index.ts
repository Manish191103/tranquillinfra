/**
 * Dev-only companion to `public/decapcms/`: Astro dev has no
 * directory-index resolution, so `/decapcms/` matches nothing and 404s,
 * while the production asset server serves `public/decapcms/index.html`
 * there on its own.
 *
 * This on-demand route fills the gap in dev. In production the Worker is
 * never reached for this URL — the static asset takes precedence first — so
 * this file has no effect on the deployed behaviour.
 */
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = ({ url }) =>
  new Response(null, {
    status: 302,
    headers: { Location: new URL('/decapcms/index.html', url).href, 'Cache-Control': 'no-store' },
  });
