/**
 * OAuth broker for the self-hosted Decap CMS — authorize leg.
 *
 * The bundled Decap's `github` backend speaks the Netlify-style window
 * handshake: the CMS opens `{base_url}/{auth_endpoint}?provider=github&site_id=…`
 * in a popup, expects an `authorizing:github` postMessage and then
 * `authorization:github:success:{…json…}`. This endpoint (plus
 * `/api/cms/done`) implements that protocol against our own GitHub OAuth
 * App, so no third-party broker is involved and the CSP needs no extra
 * origin for auth (the popup is same-origin).
 *
 * GitHub does not implement PKCE; this is the classic code flow — the
 * browser only ever sees the short-lived `code`, and the exchange against
 * GitHub happens server-side in `done.ts` with the client secret, which
 * never leaves the Worker.
 *
 * Prerequisites (one-time, GitHub side):
 *   1. The OAuth App's callback URL must be `https://www.tranquillinfra.com/api/cms/done`.
 *   2. If it is a GitHub App (client ids `Ov23li…`), grant the "Contents"
 *      repository permission read+write — the `scope` parameter is ignored
 *      for GitHub Apps; a classic OAuth App gets `repo` from the URL below.
 * Missing client id → honest 503; missing secret surfaces in the callback.
 */
import type { APIRoute } from 'astro';
import { GITHUB_OAUTH_CLIENT_ID } from 'astro:env/server';

export const prerender = false;

/** Textbook CSRF defence for the code flow: the nonce travels in `state` and
 * rides back on a scoped cookie; the callback leg requires both to match. */
const STATE_COOKIE = 'cms-oauth-nonce';

export const GET: APIRoute = async ({ url }) => {
  const provider = url.searchParams.get('provider');
  if (provider !== 'github') {
    return new Response(JSON.stringify({ error: `Unsupported provider: ${provider ?? '(none)'}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  if (!GITHUB_OAUTH_CLIENT_ID) {
    return new Response(
      JSON.stringify({
        error:
          'GITHUB_OAUTH_CLIENT_ID is not set — the CMS cannot authenticate. Set the OAuth App client id in wrangler.jsonc [vars] (see /decapcms/ setup notes).',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
    );
  }

  const scope = url.searchParams.get('scope') || 'repo';
  const nonce = crypto.randomUUID();

  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', GITHUB_OAUTH_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', new URL('/api/cms/done', url).href);
  authorize.searchParams.set('scope', scope);
  authorize.searchParams.set('state', nonce);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.href,
      'Set-Cookie': `${STATE_COOKIE}=${nonce}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      'Cache-Control': 'no-store',
    },
  });
};
