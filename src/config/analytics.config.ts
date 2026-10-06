/**
 * Build-time measurement ids — inlined at build time from the build env
 * (which `astro.config.ts` fills from the `wrangler.jsonc` vars block, so the
 * values land in the bundle whether or not an `.env` exists). Read directly
 * through `import.meta.env` rather than `astro:env/client` so client code and
 * the vitest runs share the same module without Astro's virtual stubs.
 *
 * Every value is public and optional: with none set the site ships no
 * measurement. The Google tag bootstrap lives in
 * `src/components/common/Analytics.astro`; Ads conversions are addressed here.
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
  /** GA4 measurement id (`G-…`), `null` removes the tag entirely. */
  gaId: import.meta.env.PUBLIC_GA_MEASUREMENT_ID || null,
  /**
   * Google Ads tag / conversion id (`AW-…`), `null` disables the Ads tag and
   * the conversion event it routes.
   */
  adsId: import.meta.env.PUBLIC_GOOGLE_ADS_ID || null,
  /**
   * Google Ads conversion label (the `send_to` half after the slash in the
   * `Submit lead form` action's event snippet), `null` disables the conversion.
   */
  adsConversionLabel: import.meta.env.PUBLIC_GOOGLE_ADS_CONVERSION_LABEL || null,
  /** Meta pixel id, `null` when not configured. */
  pixelId: import.meta.env.PUBLIC_META_PIXEL_ID || null,
};
