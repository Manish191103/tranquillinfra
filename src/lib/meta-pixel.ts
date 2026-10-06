/**
 * The Meta pixel: fbevents.js loading and the Conversions API relay (the
 * server leg's client trigger).
 *
 * Import from client scripts only. There is no consent system in this repo
 * (India-only audience — see AGENTS.md), so the pixel loads on every page
 * where the id is configured; the only gate is the missing-id guard.
 *
 * Lead relays carry the same `event_id` as the browser events and the lead
 * payload, so Meta deduplicates the browser/server pair.
 */
import type { MetaEventName } from './analytics';

import { analyticsConfig } from '~/config/analytics.config';

/** The Meta pixel id comes from the one measurement config. */
const PIXEL_ID = analyticsConfig.pixelId ?? undefined;

interface FbqFunction {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  loaded?: boolean;
  version?: string;
  push?: FbqFunction;
}

declare global {
  interface Window {
    fbq?: FbqFunction;
    _fbq?: FbqFunction;
    __pixelReady?: boolean;
  }
}

const PIXEL_SRC = 'https://connect.facebook.net/en_US/fbevents.js';

let pixelBasePromise: Promise<FbqFunction> | null = null;
let pixelLoaderScript: HTMLScriptElement | null = null;

/** Page views this tab has pushed: 0 until the first one, +1 per push. */
let pageViewsSent = 0;

function ensurePixelBaseStub(): FbqFunction {
  if (typeof window.fbq === 'function') return window.fbq;

  // Mirrors Meta's snippet: before fbevents.js loads the calls queue up; once it
  // loads it installs `callMethod`, and every later call must go through it.
  const fbq = ((...args: unknown[]) => {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  }) as FbqFunction;
  fbq.queue = [];
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  window.fbq = fbq;
  if (!window._fbq) window._fbq = fbq;

  const script = document.createElement('script');
  script.async = true;
  script.src = PIXEL_SRC;
  document.head.appendChild(script);
  pixelLoaderScript = script;

  return fbq;
}

/**
 * Resolves once the pixel engine has evaluated and installed `callMethod`.
 *
 * Calls are only safe to issue after that point: a command queued before the
 * engine runs is replayed by the engine, but `init`/`consent` ordering relies
 * on the queue being intact — resolving on the loader's `load` (or `error`,
 * which resolves anyway and leaves the events queued on the stub) keeps the
 * every-later-call-through-`callMethod` rule. A script that never loads leaves
 * the promise settled on the stub — nothing is measured either way.
 */
function loadPixelBase(): Promise<FbqFunction> {
  if (pixelBasePromise) return pixelBasePromise;

  pixelBasePromise = new Promise<FbqFunction>((resolve) => {
    if (typeof window.fbq === 'function' && typeof window.fbq.callMethod === 'function') {
      resolve(window.fbq);
      return;
    }

    const stub = ensurePixelBaseStub();
    const settle = () => resolve(window.fbq ?? stub);
    if (pixelLoaderScript) {
      pixelLoaderScript.addEventListener('load', settle, { once: true });
      pixelLoaderScript.addEventListener('error', settle, { once: true });
    } else {
      resolve(stub);
    }
  });

  return pixelBasePromise;
}

/**
 * Fire a Meta standard event. The pixel must already be loaded: a click in the
 * sub-second window before fbevents.js finishes evaluating is dropped by the
 * engine (nothing is queued on the stub on purpose; see `loadPixelBase`), which
 * is why the submission's CAPI relay, not this, is the lead path that must not
 * be lost.
 */
export function metaTrack(name: string, params: Record<string, unknown>, eventId?: string): void {
  if (!PIXEL_ID || typeof window.fbq !== 'function') return;
  window.fbq('track', name, params, eventId ? { eventID: eventId } : {});
}

/**
 * One Meta PageView for a page the visitor landed on or navigated to.
 * One call per logical page view — the caller (`initPageViews` in
 * `analytics.ts`) owns the when; this only owns the one-per-call rule.
 */
export function trackPixelPageView(): void {
  if (!PIXEL_ID || typeof window.fbq !== 'function') return;
  pageViewsSent += 1;
  window.fbq('track', 'PageView');
}

/**
 * Relay the lead to Meta's Conversions API — the server leg of the pixel.
 * Gated on the pixel id only; failures stay invisible because the lead was
 * already accepted by Formspree.
 */
export function relayLeadConversion(input: {
  eventId: string;
  eventName: MetaEventName;
  leadType: string;
  email?: string;
  phone?: string;
  name?: string;
  fbclid?: string;
  /** First-touch capture time, used to rebuild `fbc` when the cookie is gone. */
  fbclidAtMs?: number;
}): void {
  if (!PIXEL_ID) return;

  const payload = new FormData();
  payload.set('event_id', input.eventId);
  payload.set('event_name', input.eventName);
  payload.set('lead_type', input.leadType);
  payload.set('event_source_url', window.location.href);
  for (const [key, value] of Object.entries({
    email: input.email,
    phone: input.phone,
    name: input.name,
    fbclid: input.fbclid,
    fbclid_at_ms: input.fbclidAtMs,
  })) {
    if (value) payload.set(key, String(value));
  }

  // keepalive: a navigation straight after submit must not cancel the relay.
  void fetch('/api/meta-conversion', { method: 'POST', body: payload, keepalive: true }).catch(
    () => undefined
  );
}

/**
 * Load the pixel, init it and send the visit's first PageView. Called once per
 * browser session by `initAnalytics`, after load + idle: fbevents.js is ~112
 * KiB that must not compete with the LCP resource during startup.
 */
export function initMetaPixel(): void {
  const pixelId = PIXEL_ID;
  if (!pixelId || window.__pixelReady) return;
  window.__pixelReady = true;

  void loadPixelBase().then((fbq) => {
    fbq('init', pixelId);
    trackFirstPageView();
  });
}

/**
 * The session's landing PageView, sent once the pixel base is ready.
 * Skipped when `astro:page-load` already sent this tab's first view (a swap
 * that landed before `initMetaPixel`'s async base resolved), so the landing
 * is reported exactly once either way.
 */
function trackFirstPageView(): void {
  if (!PIXEL_ID || pageViewsSent > 0) return;
  const fbq = window.fbq;
  if (typeof fbq !== 'function') return;
  pageViewsSent += 1;
  fbq('track', 'PageView');
}
