/**
 * The consent record: configuration types, storage, in-memory state and the
 * Google Consent Mode v2 signals it maps to.
 *
 * One owner for everything that reads or writes a visitor's decision. The
 * banner records decisions (`recordConsent`); the measurement layer asks
 * `hasConsent(kind)`; the map embeds ask `hasGrantedCategory(category)`. The
 * `consent-updated` window event (detail: `{ categories }`) stays the public
 * signal other subscribers can listen for.
 *
 * Consent Mode ordering: `initConsentMode` pushes the `consent default` — every
 * optional signal denied, a returning visitor's stored decision applied on top
 * — before anything can push a `consent update`, so script order cannot invert
 * the two commands.
 *
 * Import from client scripts only. The category and UI configuration lives in
 * `src/config/consent.config.ts`.
 */
import consentConfig from '~/config/consent.config';
import { analyticsConfig } from '~/config/analytics.config';

/* -------------------------------------------------------------------------
   Types (the shape `src/config/consent.config.ts` fills in)
   ------------------------------------------------------------------------- */

/** Google Consent Mode v2 signal types */
export type GCMType =
  | 'ad_storage'
  | 'ad_user_data'
  | 'ad_personalization'
  | 'analytics_storage'
  | 'functionality_storage'
  | 'personalization_storage'
  | 'security_storage';

/** Configuration for a single consent category */
export interface ConsentCategoryConfig {
  /** Display label */
  label: string;
  /** Description shown in settings panel */
  description: string;
  /** If true, cannot be toggled off (e.g. necessary cookies) */
  required: boolean;
  /** Default state when no consent has been given */
  defaultEnabled: boolean;
  /** Google Consent Mode v2 types mapped to this category */
  gcmTypes: GCMType[];
}

/** UI text strings for the consent banner */
export interface ConsentUIText {
  heading: string;
  description: string;
  acceptAll: string;
  declineAll: string;
  customize: string;
  savePreferences: string;
  settingsHeading: string;
  /** Label shown on the "always on" badge for required categories */
  alwaysOnLabel?: string;
  /** Label for the privacy policy link */
  privacyPolicyLabel?: string;
}

/** Full consent manager configuration */
export interface ConsentConfig {
  /** Bump to force re-consent when categories change */
  version: number;
  /** localStorage key for storing preferences */
  storageKey: string;
  /** Category definitions */
  categories: Record<string, ConsentCategoryConfig>;
  /** UI text strings */
  ui: ConsentUIText;
  /** Milliseconds before banner appears */
  showDelay: number;
}

/** The visitor's decision as the rest of the site sees it. */
export interface ConsentState {
  decided: boolean;
  categories: Record<string, boolean>;
}

/* -------------------------------------------------------------------------
   State
   ------------------------------------------------------------------------- */

interface StoredConsent {
  version: number;
  timestamp: string;
  categories: Record<string, boolean>;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let state: ConsentState | null = null;
let modeInitialised = false;

/** The gtag queue stub — created before gtag.js loads, then drained by it. */
export function ensureGtag(): (...args: unknown[]) => void {
  if (typeof window.gtag === 'function') return window.gtag;

  window.dataLayer = window.dataLayer || [];
  function gtag(): void {
    // eslint-disable-next-line prefer-rest-params -- GA4 expects the Arguments object, not rest params
    window.dataLayer!.push(arguments);
  }
  // Google's snippet declares gtag at the top level; the measurement layer and
  // the consent updates both push through it.
  window.gtag = gtag;
  return gtag;
}

/** Category states before any decision: `required || defaultEnabled`. */
function defaultCategories(): Record<string, boolean> {
  const categories: Record<string, boolean> = {};
  for (const [key, category] of Object.entries(consentConfig.categories)) {
    categories[key] = category.required || category.defaultEnabled;
  }
  return categories;
}

/** Category states for "everything optional denied": `required` only. */
function deniedCategories(): Record<string, boolean> {
  const categories: Record<string, boolean> = {};
  for (const [key, category] of Object.entries(consentConfig.categories)) {
    categories[key] = category.required;
  }
  return categories;
}

/** Every mapped GCM signal, resolved to granted/denied for these categories. */
function gcmValues(categories: Record<string, boolean>): Record<string, string | number> {
  const values: Record<string, string | number> = {};
  for (const [key, category] of Object.entries(consentConfig.categories)) {
    const granted = categories[key] === true;
    for (const type of category.gcmTypes) {
      values[type] = granted ? 'granted' : 'denied';
    }
  }
  return values;
}

function readStored(): Record<string, boolean> | null {
  try {
    const raw = localStorage.getItem(consentConfig.storageKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as { version?: unknown; categories?: unknown };
    if (record.version !== consentConfig.version) return null;
    if (!record.categories || typeof record.categories !== 'object') return null;
    return record.categories as Record<string, boolean>;
  } catch {
    return null;
  }
}

/** The stored or in-memory decision, or `null` before the visitor has decided. */
export function getConsentState(): ConsentState | null {
  if (state) return state;
  const categories = readStored();
  if (!categories) return null;
  state = { decided: true, categories };
  return state;
}

/**
 * Push the `consent default` exactly once per page load: every optional signal
 * denied and `wait_for_update` 500 ms, with a returning visitor's stored
 * decision applied on top so their first hit is already correct. Then the two
 * privacy settings. No-op without a configured Google tag or with the consent
 * system disabled.
 *
 * `ads_data_redaction` and `url_passthrough` are `set` parameters, not `consent`
 * parameters (Google's consent guide shows `gtag('set', 'ads_data_redaction',
 * true)` as the documented form). Passed inside the consent object they are
 * silently ignored — observed 2026-09-26: with `ad_storage` denied the Ads
 * hit still carried the raw `gclid`, and it redacts once moved to `set`.
 */
export function initConsentMode(): void {
  if (modeInitialised) return;
  modeInitialised = true;
  if (!analyticsConfig.consentEnabled || !analyticsConfig.gtagIds.length) return;

  const values = gcmValues(getConsentState()?.categories ?? defaultCategories());
  values.wait_for_update = 500;
  const gtag = ensureGtag();
  gtag('consent', 'default', values);
  gtag('set', 'ads_data_redaction', true);
  gtag('set', 'url_passthrough', true);
}

/** Push a decision as a `consent update` — never before the default above. */
function consentModeUpdate(categories: Record<string, boolean>): void {
  initConsentMode();
  ensureGtag()('consent', 'update', gcmValues(categories));
}

/** Persist a decision, apply it to Consent Mode and notify subscribers. */
export function recordConsent(categories: Record<string, boolean>): ConsentState {
  const record: StoredConsent = {
    version: consentConfig.version,
    timestamp: new Date().toISOString(),
    categories,
  };
  try {
    localStorage.setItem(consentConfig.storageKey, JSON.stringify(record));
  } catch {
    /* storage unavailable — the decision still governs this page load */
  }

  state = { decided: true, categories };
  consentModeUpdate(categories);
  window.dispatchEvent(new CustomEvent('consent-updated', { detail: { categories } }));
  return state;
}

/** Grant one category on top of the current decision (a map's "Load Map"). */
export function grantConsentCategory(category: string): void {
  const current = getConsentState();
  recordConsent({ ...(current?.categories ?? deniedCategories()), [category]: true });
}

/** Whether the visitor has decided and granted this category. */
export function hasGrantedCategory(category: string): boolean {
  const consent = getConsentState();
  return !!consent?.decided && consent.categories[category] === true;
}

/** The category key that owns a Google signal. */
function categoryKeyFor(signal: 'analytics_storage' | 'ad_storage'): string {
  for (const [key, category] of Object.entries(consentConfig.categories)) {
    if (category.gcmTypes.includes(signal)) return key;
  }
  return signal === 'analytics_storage' ? 'analytics' : 'marketing';
}

/**
 * Whether the visitor's decision (or the absence of a consent system) allows
 * this measurement track: Google events need the analytics category, Meta
 * events the marketing one.
 */
export function hasConsent(kind: 'analytics' | 'marketing'): boolean {
  if (!analyticsConfig.consentEnabled) return true;
  const key = categoryKeyFor(kind === 'analytics' ? 'analytics_storage' : 'ad_storage');
  return getConsentState()?.categories?.[key] === true;
}
