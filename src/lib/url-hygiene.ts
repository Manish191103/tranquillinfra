/**
 * URL hygiene: keep Google's link decoration and every paid-media click id out
 * of the address bar once nothing reads them any more, and hold what the
 * visitor sees to the canonical form of the URL.
 *
 * The Google tag decorates URLs with visitor state whenever it preserves
 * measurement across a hop or works without cookies (`_gl` linker value, the
 * `_ga` client id and `_ga_<container>` session id) and the paid-media click
 * ids arrive on every ad click. Left in place they ride into shared links,
 * browser history and referrers — re-associating a visitor who deliberately
 * dropped the identifiers, and polluting attribution for anyone opening the
 * link later. The same rewrite puts the address bar on the host and the
 * trailing-slash form the page's canonical URL already names, so a link
 * copied off a redirect never becomes a second, un-canonicalised entry point.
 *
 * The strip is lossless for measurement: `firstTouchContext` in
 * `src/lib/analytics.ts` records the click ids into first-touch storage and the
 * Google tag takes its attribution from the URL before this cleanup runs (see
 * `scheduleTrackingParamCleanup` there). Only the URL copy is dropped.
 *
 * Import from client scripts only.
 */

import { canonicalPathname } from './canonical';

/**
 * Paid-media click ids: present means the visitor arrived from an ad. The one
 * list in the site — first-touch attribution captures exactly these keys
 * (`TOUCH_KEYS` in `src/lib/analytics.ts`) and the stripper below removes
 * exactly them, so an id can never be attributed while still riding out in a
 * shared link. Adding one here needs no second edit.
 */
export const CLICK_ID_KEYS: readonly string[] = [
  'gclid', // Google Ads
  'gbraid', // Google Ads, app → web handoff
  'wbraid', // Google Ads, web → app handoff
  'dclid', // Google Ads display
  'fbclid', // Meta
  'igshid', // Instagram
  'ttclid', // TikTok
  'li_fat_id', // LinkedIn
  'msclkid', // Microsoft Ads
  'twclid', // X
  'rtd_cid', // Reddit
  'sccid', // Snap
];

/**
 * Google linker decoration, stripped alongside the click ids; the GA4 session
 * id travels as `_ga_<container id>` and is matched by prefix.
 */
const GOOGLE_DECORATION_PARAMS: readonly string[] = ['_gl', '_ga'];

/**
 * The query string without the tracking parameters. Every other parameter —
 * campaign tags, filters — keeps its value and its order. A query that becomes
 * empty returns `''`, so the result drops straight into a path + hash rebuild.
 */
export function stripTrackingParams(search: string): string {
  const params = new URLSearchParams(search);
  let removed = false;
  for (const name of [...params.keys()]) {
    if (
      name.startsWith('_ga_') ||
      GOOGLE_DECORATION_PARAMS.includes(name) ||
      CLICK_ID_KEYS.includes(name)
    ) {
      params.delete(name);
      removed = true;
    }
  }
  // Nothing to strip: hand the original bytes back instead of a re-encoded
  // round trip of values URLSearchParams would normalise.
  if (!removed) return search;
  return params.toString() ? `?${params.toString()}` : '';
}

/**
 * The origin this page's canonical URLs are built from, read back out of the
 * served head instead of declared again here: `src/config/site.config.ts` is a
 * server module (`astro:env/server` plus the image pipeline) and cannot be
 * imported into a client bundle, but every page publishes the URL it resolved
 * from `siteConfig.url` — as `<link rel="canonical">` and as `og:url`, both
 * emitted by `src/components/seo/SEO.astro`. `og:url` is the fallback because
 * the canonical link is omitted on noindex pages (the 404 among them).
 *
 * `null` when the head carries neither, which only a page that skips the SEO
 * head can do; callers treat it as "cannot confirm" and do nothing.
 */
export function canonicalSiteOrigin(): string | null {
  const href =
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ??
    document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content;
  if (!href) return null;
  try {
    return new URL(href).origin;
  } catch {
    return null;
  }
}

/**
 * Whether the request host and the canonical origin are the same site behind a
 * `www.` difference — the apex and the canonical host are the only aliases that
 * answer for the same pages. Any other host (a `localhost` dev server, a
 * Cloudflare preview domain) is a different site and is left alone: rewriting
 * it would send the visitor off a page that works.
 */
function isCanonicalHostAlias(origin: string): boolean {
  const canonicalHost = new URL(origin).hostname.replace(/^www\./, '');
  return canonicalHost === window.location.hostname.replace(/^www\./, '');
}

/**
 * `history.replaceState` as the browser shipped it, applied to this window.
 *
 * gtag.js overrides `History.prototype.replaceState` to observe SPA
 * navigations and answers every observed rewrite with its own `page_view`
 * (`gtm.historyChangeSource`) plus a rewritten `dl`/`dr` pair — a second page
 * view on every decorated landing and hit bookkeeping the site never asked
 * for. A same-origin about:blank frame still carries the shipped method, so
 * the rewrite can pass by that observer.
 */
let nativeReplaceState: History['replaceState'] | undefined;
let guardedReplaceState: History['replaceState'] | undefined;

function shippedReplaceState(): History['replaceState'] {
  if (nativeReplaceState) return nativeReplaceState;
  const frame = document.createElement('iframe');
  frame.hidden = true;
  document.documentElement.append(frame);
  try {
    nativeReplaceState = frame.contentWindow!.history.replaceState;
    return nativeReplaceState;
  } finally {
    frame.remove();
  }
}

/**
 * Astro saves scroll position through state-only replaceState calls. After a
 * silent URL cleanup, Google's observer still remembers the decorated URL and
 * mistakes that next scroll update for navigation. Keep state-only updates
 * native too, while real URL changes still reach the installed observer.
 */
function guardStateOnlyHistoryUpdates(): void {
  const history = window.history;
  if (history.replaceState === guardedReplaceState) return;

  const native = shippedReplaceState();
  const observed = history.replaceState;
  const prototype = Object.getPrototypeOf(history) as History;
  const inherited = observed === prototype.replaceState;
  guardedReplaceState = function (this: History, ...args) {
    const url = args[2];
    let sameUrl = url == null;
    if (!sameUrl) {
      try {
        sameUrl = new URL(String(url), window.location.href).href === window.location.href;
      } catch {
        // Let the existing History method reject an invalid URL as usual.
      }
    }
    // Resolve inherited observers at call time: a slow Google tag may install
    // its prototype wrapper after the bounded attribution wait has expired.
    const delegate = inherited ? prototype.replaceState : observed;
    return (sameUrl ? native : delegate).apply(this, args);
  };
  history.replaceState = guardedReplaceState;
}

/**
 * Rewrite the address bar to the clean, canonical URL: the tracking parameters
 * gone, the directory paths slash-terminated and a host alias on the canonical
 * origin. The path, the remaining parameters, the hash and the history entry
 * (state and scroll position) survive. No-op when the URL is already canonical.
 *
 * The host is corrected with a real navigation, because the History API refuses
 * a cross-origin URL. It terminates: on the canonical host neither the origin
 * comparison nor the alias check matches, so the rewrite does nothing.
 */
export function cleanTrackingParamsFromAddressBar(): void {
  const { pathname, search, hash } = window.location;
  const clean = `${canonicalPathname(pathname)}${stripTrackingParams(search)}${hash}`;
  const origin = canonicalSiteOrigin();

  if (origin && origin !== window.location.origin && isCanonicalHostAlias(origin)) {
    window.location.replace(`${origin}${clean}`);
    return;
  }

  guardStateOnlyHistoryUpdates();
  if (clean === `${pathname}${search}${hash}`) return;
  shippedReplaceState().call(window.history, window.history.state, '', clean);
}
