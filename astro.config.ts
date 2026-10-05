import path from 'path';
import { fileURLToPath } from 'url';

import { defineConfig, envField, fontProviders } from 'astro/config';

import { unified } from '@astrojs/markdown-remark';

import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import partytown from '@astrojs/partytown';
import icon from 'astro-icon';
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
  // Type-safe environment. Only the runtime secrets are declared here: the
  // PUBLIC_* measurement/form values are read through `import.meta.env` (the
  // Cloudflare adapter loads the wrangler `vars` block into the build env), and
  // the GA4 property id lives in src/config.yaml. Optional secrets keep the
  // graceful degradation the site is designed around — a missing Resend key
  // makes /api/customer-mail answer an honest 502, a missing CAPI token leaves
  // the pixel working alone — instead of blocking the deploy the way
  // `secrets.required` would.
  env: {
    schema: {
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
    icon({
      // Local SVG icons (used as <Icon name="file-name" />) live next to the other assets.
      iconDir: 'src/assets/icons',
      include: {
        tabler: ['*'],
        'flat-color-icons': [
          'template',
          'gallery',
          'approval',
          'document',
          'advertising',
          'currency-exchange',
          'voice-presentation',
          'business-contact',
          'database',
        ],
      },
    }),

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
    // Astro's default Sharp service handles local images.
    //
    // Most remote CDN images (Unsplash, Cloudinary, Imgix…) are routed by
    // src/components/common/Image.astro through `unpic`, which rewrites the
    // URL with CDN-side query parameters and serves it straight from the
    // provider — Astro never downloads it, so they don't need to be listed.
    //
    // `domains` only matters for remote URLs that fall through to Astro's
    // native <Image /> (i.e. providers Unpic can't detect, like Pixabay).
    // Listed entries are authorized to be processed by Sharp.
    // Unsplash is listed so post covers can be rendered as real 1200×626 Open Graph images.
    domains: ['cdn.pixabay.com', 'images.unsplash.com'],

    // Emit responsive styles for the native <Image layout=…> used by
    // src/components/common/Image.astro (local images). Utility classes on
    // each usage still win, since these styles use low-specificity selectors.
    responsiveStyles: true,
  },

  markdown: {
    processor: unified({
      remarkPlugins: [readingTimeRemarkPlugin],
      rehypePlugins: [responsiveTablesRehypePlugin],
    }),
    shikiConfig: {
      // Code blocks follow the site theme; see the `.astro-code` rules in tailwind.css.
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
