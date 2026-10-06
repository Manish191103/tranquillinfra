/**
 * The Meta browser pixel: fbevents.js loading and event tracking.
 *
 * Import from client scripts only. There is no consent system in this repo
 * (India-only audience — see AGENTS.md), so the pixel loads on every page
 * where the id is configured; the only gate is the missing-id guard.
 *
 * Browser leads share the accepted submission event id with server CAPI
 * events, so Meta deduplicates the browser/server pair.
 */
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

  try {
    const script = document.createElement('script');
    script.async = true;
    script.src = PIXEL_SRC;
    document.head.appendChild(script);
  } catch (error) {
    // Discard only our incomplete stub so a later interaction can retry.
    if (window.fbq === fbq) delete window.fbq;
    if (window._fbq === fbq) delete window._fbq;
    throw error;
  }

  return fbq;
}

/** Queue a standard event after pixel initialization, including before load. */
export function metaTrack(name: string, params: Record<string, unknown>, eventId?: string): void {
  if (!PIXEL_ID) return;
  initMetaPixel();
  if (!window.__pixelReady || typeof window.fbq !== 'function') return;
  const command = name === 'NewsletterSignup' ? 'trackCustom' : 'track';
  window.fbq(command, name, params, eventId ? { eventID: eventId } : {});
}

/**
 * One Meta PageView for a page the visitor landed on or navigated to.
 * One call per logical page view — the caller (`initPageViews` in
 * `analytics.ts`) owns the when; this only owns the one-per-call rule.
 */
export function trackPixelPageView(): void {
  if (!PIXEL_ID) return;
  const alreadyInitialized = window.__pixelReady;
  initMetaPixel();
  // An early navigation initializes and reports this page itself.
  if (!alreadyInitialized) return;
  pageViewsSent += 1;
  window.fbq!('track', 'PageView');
}

/**
 * Load the pixel, init it and send the visit's first PageView. Called once per
 * browser session by `initAnalytics`, after load + idle: fbevents.js is ~112
 * KiB that must not compete with the LCP resource during startup.
 */
export function initMetaPixel(): void {
  const pixelId = PIXEL_ID;
  if (!pixelId || window.__pixelReady) return;
  try {
    const fbq = ensurePixelBaseStub();
    fbq('init', pixelId);
    window.__pixelReady = true;
    trackFirstPageView();
  } catch {
    // Measurement must never turn an accepted enquiry into a form error.
    window.__pixelReady = false;
  }
}

/**
 * Queue the first PageView immediately after init so downloaded engine
 * replay preserves initialization order. Later navigations report separately.
 */
function trackFirstPageView(): void {
  if (!PIXEL_ID || pageViewsSent > 0) return;
  const fbq = window.fbq;
  if (typeof fbq !== 'function') return;
  pageViewsSent += 1;
  fbq('track', 'PageView');
}
