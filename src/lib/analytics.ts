/**
 * Browser-side lead measurement for Google (GA4 via the tag `Analytics.astro`
 * already renders) and the Google Ads conversion, plus the session's first
 * touch that the lead payload carries.
 *
 * This module deliberately does NOT load a second GA tag. The GA4 loader and
 * the `dataLayer`/`gtag` bootstrap live in `src/components/common/Analytics.astro`,
 * configured via `PUBLIC_GA_MEASUREMENT_ID` in `wrangler.jsonc`; everything here pushes into that existing
 * setup. There is no consent gate anywhere: the site is India-only, where
 * analytics cookies are not gated on prior consent (see AGENTS.md, "Measurement").
 * Guards exist for missing ids only.
 *
 * Import from client scripts only. The module self-initialises: Astro dedupes
 * a component script per page and persists module state across view-transition
 * swaps, so the delegated listeners bind once and re-arm per page through the
 * `astro:*` events.
 */
import { initMetaPixel, metaTrack, trackPixelPageView } from './meta-pixel';
import { cleanTrackingParamsFromAddressBar } from './url-hygiene';
import { analyticsConfig } from '~/config/analytics.config';

/** The Google tag bootstrap `Analytics.astro` renders on every page. */
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    /** One-time pixel init marker set by `meta-pixel.ts`. */
    __pixelReady?: boolean;
  }
}

/** Google Ads conversion id and label — the one measurement config. */
const ADS_ID = analyticsConfig.adsId ?? undefined;
const ADS_CONVERSION_LABEL = analyticsConfig.adsConversionLabel ?? undefined;

/** Meta event names the site reports (see `LEAD_EVENTS` and meta-pixel). */
export type MetaEventName = 'Lead' | 'NewsletterSignup';

/**
 * The two lead kinds the site reports. An enquiry is a lead — `generate_lead`
 * in GA4, `Lead` on Meta, the Google Ads conversion — while a newsletter
 * signup is a lighter event that must not feed ad optimization.
 */
export type LeadKind = 'contact' | 'newsletter';

export const LEAD_EVENTS: Record<
  LeadKind,
  { ga: string; meta: MetaEventName; conversion: boolean }
> = {
  contact: { ga: 'generate_lead', meta: 'Lead', conversion: true },
  newsletter: { ga: 'newsletter_signup', meta: 'NewsletterSignup', conversion: false },
};

/** First-party identifiers for Google Ads enhanced conversions for web. */
export interface AdsUserData {
  email?: string;
  phone?: string;
}

/**
 * Normalize identifiers the way Google's declared enhanced-conversions
 * implementation expects: the tag hashes them (SHA-256) before sending, so
 * values go out normalized but unhashed — email trimmed and lowercased, and phone as a plausible E.164 number: the tag cannot infer a
 * country code, so a national number is completed to `+91` (the only market
 * the site sells in) and anything not plausibly E.164 is dropped rather than
 * sent blank. Empty fields are omitted the same way.
 */
export function normalizeAdsUserData({ email, phone }: AdsUserData): Record<string, string> {
  const data: Record<string, string> = {};
  const em = email?.trim().toLowerCase();
  if (em) data.email = em;

  const trimmedPhone = (phone ?? '').trim();
  const digits = trimmedPhone.replace(/\D+/g, '');
  if (trimmedPhone.startsWith('+')) {
    if (digits.length >= 8 && digits.length <= 15) data.phone_number = `+${digits}`;
  } else {
    const national = digits.replace(/^0+/, '');
    if (national.length === 10) data.phone_number = `+91${national}`;
    else if (national.length === 12 && national.startsWith('91'))
      data.phone_number = `+${national}`;
  }

  return data;
}

const FIRST_TOUCH_KEY = 'tranquill-first-touch';

/** Campaign tags the lead payload carries from the touch that started the visit. */
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

/**
 * The click-id list (paid-media attribution ids) lives in `~/lib/url-hygiene`:
 * the capturer and the address-bar stripper must not drift apart, so both read
 * the one shared list.
 */
export { CLICK_ID_KEYS } from './url-hygiene';
import { CLICK_ID_KEYS } from './url-hygiene';

/**
 * Every query key captured into first touch: the campaign tags plus the
 * click ids, so a submission several navigations later still reports the
 * campaign that started the visit.
 */
const TOUCH_KEYS: readonly string[] = [...UTM_KEYS, ...CLICK_ID_KEYS];

/**
 * The captured touch, kept in memory alongside the sessionStorage record: the
 * URL may be navigated within (or the address cleaned) before a later submit,
 * so this copy is the fallback when storage is unavailable.
 */
let firstTouchCache: Record<string, string> | null = null;

let initialized = false;
const startedForms = new WeakSet<HTMLFormElement>();

/**
 * Push a GA4 event through the Google tag the page loaded.
 *
 * No consent gate (see the module comment). A missing tag — `Analytics.astro`
 * renders nothing when the config id is null — is the only guard.
 */
function pushEvent(name: string, params: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  if (!analyticsConfig.gaId || typeof window.gtag !== 'function') return;
  window.gtag('event', name, { ...params, send_to: analyticsConfig.gaId });
}

/**
 * Report a lead as a Google Ads conversion.
 *
 * The tag must carry the Ads destination (`PUBLIC_GOOGLE_ADS_ID`) and the
 * conversion action's label (`PUBLIC_GOOGLE_ADS_CONVERSION_LABEL`, the
 * `send_to` half after the slash in the action's own event snippet); together
 * they address the `Submit lead form` action byte-for-byte as the account
 * generated it — except `value`/`currency`, deliberately absent (no lead value
 * is defined; if one ever is, set it in the action's UI settings).
 * `transactionId` is the submission's `event_id`: Google drops repeat events
 * with the same id inside the action, and a later Data Manager upload can
 * match the tag event with the same value.
 *
 * `user_data` carries first-party identifiers (enhanced conversions for web).
 * The ids ship from the Cloudflare vars — a missing id is otherwise silent:
 * warn once per load, one line per missing id, before the early return.
 */
function trackAdsConversion(transactionId: string, userData: AdsUserData = {}): void {
  if (!ADS_ID || !ADS_CONVERSION_LABEL || typeof window.gtag !== 'function') return;
  const enhanced = normalizeAdsUserData(userData);
  window.gtag('event', 'conversion', {
    send_to: `${ADS_ID}/${ADS_CONVERSION_LABEL}`,
    transaction_id: transactionId,
    ...(Object.keys(enhanced).length ? { user_data: enhanced } : {}),
  });
}

/** Fire the lead's browser events. `eventId` must match the submitted payload. */
export function trackLead(
  kind: LeadKind,
  eventId: string,
  params: Record<string, unknown> = {},
  identifiers: AdsUserData = {}
): void {
  const events = LEAD_EVENTS[kind];
  // gtag keeps the `config`-time page context, so a submission after a
  // client-side navigation must carry the page it happened on.
  pushEvent(events.ga, {
    lead_type: kind,
    event_id: eventId,
    page_location: window.location.href,
    page_title: document.title,
    ...params,
  });
  if (events.conversion) trackAdsConversion(eventId, identifiers);
  metaTrack(events.meta, { content_name: kind, ...params }, eventId);
}

/**
 * Fire `lead_form_start` once per form element, on the visitor's first
 * interaction. Deliberately not `form_start`: GA4's enhanced measurement
 * "Form interactions" module reserves that name for its own auto event and a
 * collision would merge two unrelated signals under one name.
 */
export function trackFormStart(form: HTMLFormElement, params: Record<string, unknown> = {}): void {
  if (startedForms.has(form)) return;
  startedForms.add(form);
  pushEvent('lead_form_start', { form: form.id || 'form', ...params });
}

/**
 * The session's first touch: where the visit started and which campaign
 * parameters it carried. Recorded once per session, on the first page of the
 * visit, so a submission several navigations later still reports it.
 */
function firstTouchContext(): Record<string, string> {
  if (firstTouchCache) return firstTouchCache;
  try {
    const raw = sessionStorage.getItem(FIRST_TOUCH_KEY);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {
    /* storage unavailable — fall through and rebuild */
  }

  const params = new URLSearchParams(window.location.search);
  const firstTouch: Record<string, string> = {
    landing_page: window.location.pathname + window.location.search,
    referrer: document.referrer || '',
    // Capture time — the best available stand-in for an ad click's time when
    // Meta's `_fbc` cookie is absent and the `fbc` value has to be rebuilt.
    touch_at_ms: String(Date.now()),
  };
  for (const key of TOUCH_KEYS) firstTouch[key] = params.get(key) ?? '';
  try {
    sessionStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(firstTouch));
  } catch {
    /* storage unavailable — the in-memory copy serves this page view */
  }
  firstTouchCache = firstTouch;
  return firstTouch;
}

/**
 * When the session's first touch was captured — the fallback click time for
 * Meta's `fbc` rebuild when the `_fbc` cookie is missing at submit.
 */
export function firstTouchTimestampMs(): number | null {
  const ms = Number(firstTouchContext().touch_at_ms);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

/**
 * Campaign context for the lead payload: the touch that started the session plus
 * the ad click ids, so the team can see which campaign produced the enquiry.
 * Values are best-effort — failures leave the field empty, never break a submit.
 */
export function collectLeadContext(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const firstTouch = firstTouchContext();

  const context: Record<string, string> = {
    landing_page: firstTouch.landing_page || '',
    referrer: firstTouch.referrer || '',
  };
  for (const key of TOUCH_KEYS) {
    context[key] = firstTouch[key] || params.get(key) || '';
  }
  return context;
}

/**
 * Delegated capture-phase click listener for the chrome's `data-track` hooks.
 *
 * GA4 only. A click is an intent signal in the analytics property and never a
 * Meta conversion: the hooks must not map `site_visit` and `brochure` onto
 * `Lead`, or a visitor who opened the CTA and closed the dialog counts as a
 * Meta lead and Smart Bidding trains on the inflated volume (observed 2026-09
 * in the predecessor). Meta's `Lead`/`NewsletterSignup` come from `trackLead`
 * — one per accepted submission, deduplicated against the CAPI relay.
 */
function initClickTracking(): void {
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target instanceof Element ? event.target.closest('[data-track]') : null;
      const hook = target?.getAttribute('data-track');
      if (!hook) return;

      const linkUrl = target instanceof HTMLAnchorElement ? target.href : undefined;

      pushEvent(hook, {
        event_category: 'engagement',
        ...(linkUrl ? { link_url: linkUrl } : {}),
      });
    },
    { capture: true }
  );
}

/**
 * Meta page views for client-side (view transition) navigations.
 *
 * GA4 needs no push here: the stream's enhanced measurement covers both ends
 * — the inline `gtag('config')` sends the initial `page_view`, and its "Page
 * changes based on browser history events" module sends one per router
 * navigation. A manual push doubled every navigated page in the predecessor
 * (observed 2026-09-27: two `en=page_view` collects per navigation). If that
 * enhanced-measurement toggle is ever switched off, restore a
 * `pushEvent('page_view', …)` here or navigations stop counting.
 */
function initPageViews(): void {
  let navigated = false;

  document.addEventListener('astro:after-swap', () => {
    navigated = true;
  });

  document.addEventListener('astro:page-load', () => {
    if (navigated) {
      navigated = false;
      trackPixelPageView();
      return;
    }
    // Initialization owns the initial PageView, even when an early lead or
    // navigation starts the pixel before the scheduled idle callback.
  });
}

/**
 * Entry point. Idempotent: the module script is deduped per page and persists
 * across view transitions, so one binding survives every swap; a second
 * evaluation (hard navigation to another page) re-runs only what must re-arm.
 *
 * `firstTouchContext()` records the session's landing page + campaign
 * parameters immediately — a submission on this very page needs it, and
 * storage makes later navigations cheap.
 */
export function initAnalytics(): void {
  if (typeof window === 'undefined') return;

  if (!ADS_ID) {
    console.warn(
      '[measurement] PUBLIC_GOOGLE_ADS_ID not set — the Google Ads tag never loads and lead conversions are silently dropped (observed 2026-09: live campaign, 0 measured conversions).'
    );
  }
  if (!ADS_CONVERSION_LABEL) {
    console.warn(
      '[measurement] PUBLIC_GOOGLE_ADS_CONVERSION_LABEL not set — no conversion action is addressed and lead conversions are silently dropped.'
    );
  }

  firstTouchContext();
  scheduleTrackingParamCleanup(); // the captured ids must not ride shared links

  if (initialized) return;
  initialized = true;

  // One delegation per tab: the `astro:page-load` handlers bound here outlive
  // the swaps (the module persists), so a second evaluation must not bind a
  // second set — a doubled Meta PageView per navigation is exactly what that
  // costs. `scheduleTrackingParamCleanup`, above the guard, may re-run: each
  // poll ends in one idempotent strip pass.
  initPageViews();
  initClickTracking();
  // The pixel engine fetches after load + idle so it never competes with the
  // LCP resource during startup.
  afterLoadIdle(() => initMetaPixel());
}

/**
 * Drop the Google tracking parameters (`_gl`/`_ga*` linker state and the
 * paid-media click ids) from the address bar once nothing reads them any more.
 * `firstTouchContext` has recorded the click ids already; the configured tags
 * (`#ga-init` renders whenever any Google id is set) are the remaining readers
 * and they read the URL late and live — the tag's click-id collection writes
 * the `gclid` linkage (`_gcl_aw`) and its hits take `dl` from `location.href`
 * when the containers finish, not when their loader executes (stripping as
 * soon as the loader had run cost the click id its `gclid` linkage entirely;
 * observed in the predecessor's equivalent gate, 2026-09).
 *
 * The gate asks whether ANY endpoint that reads the URL is configured — GA4
 * alone is enough — not whether the Ads conversion pair is; with GA4 only, the
 * collect still carries the URL and the wait still applies. The tag itself is
 * a plain script render we own no handle on: instead of a load event (which
 * proves loader execution, not attribution readiness — a cached gtag.js can
 * finish running before the first collect builds), poll for the GA4
 * collection request and hold two seconds of margin while the first wave's
 * remaining pings build their `dl`, giving up after 20 seconds of a blocked
 * or stalled tag. No tag configured → nothing reads the URL: strip at once.
 */
function scheduleTrackingParamCleanup(): void {
  afterLoadIdle(() => {
    const bootstrap = document.getElementById('ga-init');
    if (!bootstrap?.dataset.id && !bootstrap?.dataset.adsId) {
      cleanTrackingParamsFromAddressBar();
      return;
    }
    stripAfterFirstCollect();
  });
}

/** Poll until the Google tag's GA4 collection request is two seconds behind us. */
function stripAfterFirstCollect(): void {
  const startedAt = Date.now();
  const poll = (): void => {
    const collected = performance
      .getEntriesByType('resource')
      .some((entry) => /\/g\/collect\?/.test(entry.name));
    if (collected) {
      // Two seconds of margin: the first wave's remaining pings build around
      // the same request, and each hit reads the URL as it is built.
      window.setTimeout(cleanTrackingParamsFromAddressBar, 2000);
      return;
    }
    if (Date.now() - startedAt >= 20000) {
      cleanTrackingParamsFromAddressBar();
      return;
    }
    window.setTimeout(poll, 500);
  };
  poll();
}

/** Run `callback` once the page has fully loaded and the browser is idle. */
function afterLoadIdle(callback: () => void): void {
  const run = (): void => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => callback(), { timeout: 2000 });
    } else {
      window.setTimeout(callback, 1);
    }
  };

  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
}

/**
 * One `page_not_found` event per 404 render. Fired from `src/pages/404.astro`
 * on `astro:page-load` (never reached by client-side routing), after
 * BaseLayout's script has run `gtag('config')`.
 */
export function trackNotFound(path: string): void {
  pushEvent('page_not_found', { page_path: path, page_location: window.location.href });
}
