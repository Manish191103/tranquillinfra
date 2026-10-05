/**
 * OAuth broker for the self-hosted Decap CMS — callback leg.
 *
 * GitHub redirects here with `?code=…&state=…`. This endpoint:
 *   1. checks the `state` against the nonce cookie set by `/api/cms/auth`,
 *   2. exchanges the code for an access token server-side (the client
 *      secret never reaches the browser),
 *   3. serves the tiny HTML that speaks Decap's window handshake: it posts
 *      `authorizing:github` to the opener, waits for the opener to echo it
 *      (that echo is the opener proving it heard us — see
 *      `handshakeCallback` in the bundled decap-cms), and then posts
 *      `authorization:github:success:{token,…}` for the popup's origin,
 *      which is exactly what `authorizeCallback` requires.
 *
 * Errors surface through the same handshake as
 * `authorization:github:error:{…}`, which the CMS renders as its login
 * error.
 */
import type { APIRoute } from 'astro';
import { GITHUB_OAUTH_CLIENT_ID, GITHUB_OAUTH_CLIENT_SECRET } from 'astro:env/server';

export const prerender = false;

const STATE_COOKIE = 'cms-oauth-nonce';
const TOKEN_EXCHANGE_TIMEOUT_MS = 10_000;

export const GET: APIRoute = async ({ url, request }) => {
  // `message` is embedded as a JSON string literal, with `<` escaped so the
  // token can never close the script element it rides inside.
  const page = (message: string, status = 200): Response =>
    new Response(
      `<!doctype html><meta charset="utf-8"><title>Signing in…</title><script>
(function () {
  var message = ${JSON.stringify(message).replace(/</g, '\\u003c')};
  // The opener listens for "authorizing:github" and echoes it back to this
  // popup — that echo is our cue that it heard us. Only then do we hand over
  // the final message, mirroring Netlify's done page exactly.
  window.opener.postMessage("authorizing:github", "*");
  window.addEventListener("message", function (event) {
    if (event.data === "authorizing:github") {
      window.opener.postMessage(message, "*");
      window.close();
    }
  });
})();
</script>`,
      {
        status,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          // The nonce has done its job the moment we render any response.
          'Set-Cookie': `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
        },
      }
    );

  const cookieNonce = /(?:^|;\s*)cms-oauth-nonce=([A-Za-z0-9-]+)/.exec(
    request.headers.get('cookie') ?? ''
  )?.[1];
  const state = url.searchParams.get('state') ?? '';
  const code = url.searchParams.get('code') ?? '';
  const oauthError = url.searchParams.get('error');

  if (oauthError) {
    return page(`authorization:github:error:${JSON.stringify({ error: oauthError })}`);
  }
  if (!cookieNonce || cookieNonce !== state) {
    return page(`authorization:github:error:${JSON.stringify({ error: 'state_mismatch' })}`, 400);
  }
  if (!GITHUB_OAUTH_CLIENT_ID || !GITHUB_OAUTH_CLIENT_SECRET) {
    return page(
      `authorization:github:error:${JSON.stringify({
        error: 'broker_unconfigured',
        message: 'Set GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET for the CMS auth broker.',
      })}`,
      503
    );
  }

  const exchange = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: GITHUB_OAUTH_CLIENT_ID,
      client_secret: GITHUB_OAUTH_CLIENT_SECRET,
      code,
      // Must byte-match the authorize leg's redirect_uri.
      redirect_uri: new URL('/api/cms/done', url).href,
    }),
    signal: AbortSignal.timeout(TOKEN_EXCHANGE_TIMEOUT_MS),
  })
    .then((r) => r.json() as Promise<{ access_token?: string; error?: string; error_description?: string }>)
    .catch(() => null);

  if (!exchange?.access_token) {
    return page(
      `authorization:github:error:${JSON.stringify({
        error: exchange?.error ?? 'token_exchange_failed',
        message: exchange?.error_description ?? 'GitHub did not return an access token.',
      })}`
    );
  }

  // The token payload the CMS parses out of the success message: `token` is
  // read by the GitHub backend's `authenticate`; `provider` tells it which
  // API client to build.
  return page(`authorization:github:success:${JSON.stringify({ token: exchange.access_token, provider: 'github' })}`);
};
