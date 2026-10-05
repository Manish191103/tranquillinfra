import {
  PUBLIC_GA_MEASUREMENT_ID,
  PUBLIC_GOOGLE_ADS_ID,
  PUBLIC_GOOGLE_ADS_CONVERSION_LABEL,
  PUBLIC_META_PIXEL_ID,
  PUBLIC_CONSENT_ENABLED,
} from 'astro:env/client';

/**
 * Build-time measurement ids — the single source for the Google tags, the Meta
 * pixel and the events in `src/lib/analytics.ts`.
 *
 * Every value is public and optional: with none set the site ships no
 * measurement. Import this module from Astro components and client scripts
 * alike; Astro inlines the values wherever they are bundled. The Google tags
 * (loader injected by `src/lib/analytics.ts` after load + idle) load with
 * every optional consent signal denied until the banner records a decision.
 */

/**
 * The website events the site reports to Meta.
 *
 * Declared here, not in `src/lib/meta-conversions.ts`, because both sides of the
 * conversion need it: the browser pixel (`meta-pixel.ts`) and the analytics
 * event map (`analytics.ts`) are client code, and `meta-conversions.ts` holds the
 * CAPI access token and so is server-only — importing it from a client module
 * fails the build outright.
 */
export type MetaEventName = 'Lead' | 'NewsletterSignup';

export const analyticsConfig = {
  /** GA4 measurement id (`G-…`), `null` when not configured. */
  gaId: PUBLIC_GA_MEASUREMENT_ID || null,
  /**
   * Google Ads tag / conversion id (`AW-…`), `null` disables the Ads tag and
   * the conversion event it routes.
   */
  adsId: PUBLIC_GOOGLE_ADS_ID || null,
  /**
   * Google Ads conversion label (the `send_to` half after the slash in the
   * `Submit lead form` action's event snippet), `null` disables the conversion.
   */
  adsConversionLabel: PUBLIC_GOOGLE_ADS_CONVERSION_LABEL || null,
  /** Meta pixel id, `null` when not configured. */
  pixelId: PUBLIC_META_PIXEL_ID || null,
  /** Whether the consent banner and Consent Mode gating are enabled. */
  consentEnabled: PUBLIC_CONSENT_ENABLED,
  /** Google tag ids the page configures: GA4 first, then Ads. */
  gtagIds: [PUBLIC_GA_MEASUREMENT_ID, PUBLIC_GOOGLE_ADS_ID].filter((id): id is string => !!id),
};
