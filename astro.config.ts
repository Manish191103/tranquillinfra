import path from 'path';
import { fileURLToPath } from 'url';

import { defineConfig, envField, fontProviders } from 'astro/config';

import { unified } from '@astrojs/markdown-remark';

import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import partytown from '@astrojs/partytown';
import cloudflare from '@astrojs/cloudflare';
import compress from 'astro-compress';
import type { AstroIntegration } from 'astro';

import astrowind from './vendor/integration';

import { readingTimeRemarkPlugin, responsiveTablesRehypePlugin } from './src/utils/frontmatter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const hasExternalScripts = false;
const whenExternalScripts = (items: (() => AstroIntegration) | (() => AstroIntegration)[] = []) =>
  hasExternalScripts ? (Array.isArray(items) ? items.map((item) => item()) : [items()]) : [];

export default defineConfig({
  // Type-safe environment. Runtime secrets are declared with access 'secret';
  // build-time public values (measurement ids, Formspree form id, consent
  // flag) are declared as 'client' and inlined by the compiler — the
  // Cloudflare build loads the wrangler `vars` block into the build env, and
  // the GA4 property id additionally lives in src/config.yaml. Optional
  // secrets keep the graceful degradation the site is designed around — a
  // missing Resend key makes /api/customer-mail answer an honest 502, a
  // missing CAPI token leaves the pixel working alone — instead of blocking
  // the deploy the way `secrets.required` would.
  env: {
    schema: {
      // Site identity / verification, read by src/config/site.config.ts.
      // SITE_URL also feeds the `site` setting above (process.env fallback).
      SITE_URL: envField.string({ context: 'server', access: 'public', optional: true }),
      GOOGLE_SITE_VERIFICATION: envField.string({
        context: 'server',
        access: 'public',
        optional: true,
      }),
      BING_SITE_VERIFICATION: envField.string({
        context: 'server',
        access: 'public',
        optional: true,
      }),

      // Customer mail delivery (Resend). RESEND_FROM_EMAIL and CONTACT_TO_EMAIL
      // are values, not credentials, but they stay server-side so they are
      // never inlined into a browser bundle.
      RESEND_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      RESEND_FROM_EMAIL: envField.string({ context: 'server', access: 'secret', optional: true }),
      CONTACT_TO_EMAIL: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Override for the Resend API endpoint (tests/staging against a mock).
      RESEND_API_URL: envField.string({ context: 'server', access: 'secret', optional: true }),

      // Meta Conversions API (runtime secrets). Missing values leave
      // /api/meta-conversion answering 503 — the pixel keeps working alone.
      META_CAPI_ACCESS_TOKEN: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      META_TEST_EVENT_CODE: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),

      // Build-time public values, read through astro:env/client by
      // src/config/analytics.config.ts and the GoogleMap component. The
      // Cloudflare build loads the wrangler `vars` block into the build env.
      PUBLIC_GA_MEASUREMENT_ID: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
      PUBLIC_GOOGLE_ADS_ID: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
      PUBLIC_GOOGLE_ADS_CONVERSION_LABEL: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
      PUBLIC_META_PIXEL_ID: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
      PUBLIC_GOOGLE_MAPS_API_KEY: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
        default: '',
      }),
      // Consent gating is off for this site (India-only audience; see
      // AGENTS.md "Measurement"). The flag exists so the ported consent
      // library degrades to always-allowed instead of gating the map/GA.
      PUBLIC_CONSENT_ENABLED: envField.boolean({
        context: 'client',
        access: 'public',
        optional: true,
        default: false,
      }),
      // Formspree form id shared by the contact, enquiry-dialog and newsletter
      // forms. Public by design (it appears in the form markup); required so a
      // deploy that lost the var fails the build instead of posting leads to a
      // throwaway form.
      PUBLIC_FORMSPREE_FORM_ID: envField.string({ context: 'client', access: 'public' }),
      PUBLIC_PRIVACY_POLICY_URL: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
        default: '/privacy-policy/',
      }),
    },
  },

  // The Cloudflare Workers adapter. Astro 5+ defaults to `output: 'static'`,
  // so every page here is prerendered and served from the asset server; the
  // adapter is what makes the on-demand routes (the lead/measurement API
  // endpoints) possible later, by setting `prerender = false` on those files.
  // `prerenderEnvironment: 'node'` is required by the routes that build images
  // at prerender time (OG PNGs run satori + sharp, which need Node APIs).
  adapter: cloudflare({ imageService: 'compile', prerenderEnvironment: 'node' }),

  // `/projects/` has no listing page — it points straight at the flagship
  // project (see the comment in src/navigation.ts). Static output emits this
  // as a meta-refresh HTML file served by the asset server.
  redirects: {
    '/projects': '/projects/tranquill-city',
  },

  output: 'static',

  // Nothing here stores session state. Left on, the adapter provisions a
  // Cloudflare KV namespace and binds it to every deploy for nothing.
  session: false,

  // Prefetch links as they enter the viewport for snappier navigations
  // (works together with <ClientRouter />, which enables prefetch by default).
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },

  // Native Fonts API: self-hosts, subsets and preloads each family, and emits
  // metric-adjusted fallbacks. Injected via <Font /> in Layout.astro and
  // consumed through the `--font-*` CSS variables in CustomStyles.astro.
  //
  // Fraunces is the display face and carries an optical-size (`opsz`) axis that
  // this API cannot express — the face renders at its default optical size
  // rather than tightening at display sizes. Revisit if the display cut ever
  // reads wrong at hero scale.
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Manrope',
      cssVariable: '--font-manrope',
      weights: ['200 800'],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['sans-serif'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'Fraunces',
      cssVariable: '--font-fraunces',
      weights: ['100 900'],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['serif'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'JetBrains Mono',
      cssVariable: '--font-jetbrains-mono',
      weights: ['100 800'],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['monospace'],
    },
  ],

  integrations: [
    sitemap(),
    mdx(),

    ...whenExternalScripts(() =>
      partytown({
        config: { forward: ['dataLayer.push'] },
      })
    ),

    compress({
      // csso off on purpose: its parser doesn't understand the media range
      // syntax Tailwind v4 emits for breakpoints (`@media (width>=48rem)`) and
      // silently drops every one of those blocks — the site then renders as if
      // all `md:`/`lg:` classes were missing. lightningcss parses it correctly.
      CSS: { csso: false, lightningcss: { minify: true } },
      HTML: {
        'html-minifier-terser': {
          removeAttributeQuotes: false,
        },
      },
      Image: false,
      JavaScript: true,
      SVG: false,
      Logger: 1,
    }),

    astrowind({
      config: './src/config.yaml',
    }),
  ],

  image: {
    // Astro's default Sharp service handles local images. Every component in
    // this repo renders local assets through astro:assets (`Picture` /
    // `getImage`); there is no remote-CDN image path left, so no `domains`
    // allow-list is needed.
    responsiveStyles: true,
  },

  markdown: {
    processor: unified({
      remarkPlugins: [readingTimeRemarkPlugin],
      rehypePlugins: [responsiveTablesRehypePlugin],
    }),
    shikiConfig: {
      // Code blocks follow the site theme; see the `.astro-code` rules in
      // src/styles/global.css.
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '~': path.resolve(__dirname, './src'),
      },
    },
  },
});
