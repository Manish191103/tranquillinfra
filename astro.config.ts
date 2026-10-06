import path from 'path';
import { readFileSync, readdirSync } from 'fs';
import { appendFile, readFile } from 'node:fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';

import { defineConfig, envField, fontProviders } from 'astro/config';

import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
import compress from 'astro-compress';
import type { AstroIntegration } from 'astro';

import { responsiveTablesRehypePlugin } from './src/utils/frontmatter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// !! Measurement ids and other public vars inline into the client bundle at
// !! BUILD time (`import.meta.env`), but wrangler.jsonc `vars` are only
// !! RUNTIME worker env — the 2026-10-01 production deploy of the sibling
// !! repo shipped a build that measured nothing for exactly this reason.
// !! So the build reads the public values out of `wrangler.jsonc` itself and
// !! injects them into the build env here, unless the caller already set a
// !! var (env wins). The artifact check (`scripts/check-measurement-bundle.mjs`,
// !! run by `pnpm build`) fails the build instead of deploying an unmeasured
// !! bundle when a var is lost anyway.
function injectWranglerVars(): void {
  if (process.env.MEASUREMENT_DISABLED_BUILD === '1') return;
  const text = readFileSync(`${__dirname}/wrangler.jsonc`, 'utf8');
  // Comments + wrangler's tolerated trailing commas → strict JSON.
  const json = JSON.parse(
    text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/,(?=\s*[\]}])/g, '')
  );
  for (const [key, value] of Object.entries(json.vars ?? {})) {
    if (key.startsWith('PUBLIC_') && process.env[key] === undefined && typeof value === 'string') {
      process.env[key] = value;
    }
  }
}

injectWranglerVars();

/**
 * lastmod per pathname, filled by the sitemap serialiser: `astro:content`
 * cannot load in the config context, so frontmatter dates are read off disk —
 * the same dates the content layer serves to the pages.
 */
const sitemapLastmod: Record<string, string> = {};

/**
 * A date exported from a TS config module (`contact.config.ts` `reviewedAt`),
 * scraped off disk: the config cannot be imported here because it reaches
 * `astro:env/server`, a build-time-only virtual module. Unreadable or
 * malformed values drop the `lastmod` for that one path.
 */
function configDate(file: string, name: string): string | undefined {
  const source = readFileSync(file, 'utf8');
  const literal = source
    .match(new RegExp(`^export const ${name}\\s*(?::[^=]+)?=\\s*['"]([^'"]+)['"]`, 'm'))?.[1];
  if (!literal) return undefined;
  const date = new Date(literal);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

function frontmatterDates(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const dates: string[] = [];
  for (const field of ['publishedAt', 'updatedAt']) {
    const value = frontmatter.match(new RegExp(`^${field}:\\s*([^#\\n]+)`, 'm'))?.[1]?.trim();
    if (!value) continue;
    const date = new Date(value.replace(/^['"]|['"]$/g, ''));
    if (!Number.isNaN(date.getTime())) dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

function fillSitemapLastmod(): void {
  const add = (path: string, file: string): void => {
    const lastmod = frontmatterDates(file).sort().at(-1);
    if (lastmod) sitemapLastmod[path] = lastmod;
  };

  const contentDir = join(process.cwd(), 'src', 'content');
  for (const file of readdirSync(join(contentDir, 'pages'))) {
    const id = file.replace(/\.md$/, '');
    add(id === 'home' ? '/' : `/${id}/`, join(contentDir, 'pages', file));
  }
  const posts = readdirSync(join(contentDir, 'blog'));
  for (const file of posts) {
    add(`/blog/${file.replace(/\.md$/, '')}/`, join(contentDir, 'blog', file));
  }
  // The archive's lastmod is the newest post; `/contact-us/` keeps its date in
  // `contact.config.ts` (`reviewedAt`) — frontmatter wins over the config
  // fallback when the page ever gains a content entry.
  const newestPost = posts
    .flatMap((file) => frontmatterDates(join(contentDir, 'blog', file)))
    .sort()
    .at(-1);
  if (newestPost) sitemapLastmod['/blog/'] = newestPost;
  const contactReviewedAt = configDate(
    join(process.cwd(), 'src', 'config', 'contact.config.ts'),
    'reviewedAt'
  );
  if (contactReviewedAt && !sitemapLastmod['/contact-us/']) {
    sitemapLastmod['/contact-us/'] = contactReviewedAt;
  }
  for (const file of readdirSync(join(contentDir, 'projects'))) {
    add(`/projects/${file.replace(/\.md$/, '')}/`, join(contentDir, 'projects', file));
  }
}

let sitemapLastmodFilled = false;

/**
 * No-slash variants of every redirect source, appended to the adapter's
 * `dist/client/_redirects`. The site builds with `trailingSlash: 'always'`,
 * which makes Astro emit only the slash form of each source; directory URLs
 * self-normalize, but FILE URLs (`/sitemap.xml`, the brochure PDFs) would 404
 * with only the inert slash rule. Idempotent: a row is skipped when a line
 * already starts with the source + four-space separator.
 */
const LEGACY_REDIRECTS: Array<[source: string, target: string]> = [
  ['/projects', '/projects/tranquill-city/'],
  ['/careers', '/about-us/'],
  ['/application-form', '/contact-us/'],
  ['/campaigns', '/projects/tranquill-city/'],
  ['/campaigns/tranquill-city-premium-villa-plots', '/projects/tranquill-city/'],
  ['/campaigns/tranquill-city-plots-near-hyderabad', '/projects/tranquill-city/'],
  ['/brochure', '/brochure/tranquill-city-final.pdf'],
  ['/brochure/tranquill-city.pdf', '/brochure/tranquill-city-final.pdf'],
  ['/sitemap.xml', '/sitemap-index.xml'],
  ['/wp-content/uploads/2025/12/Tranquill-City-Broucher.pdf', '/brochure/tranquill-city-final.pdf'],
];

const redirectVariants: AstroIntegration = {
  name: 'tranquillinfra:redirect-variants',
  hooks: {
    'astro:build:done': async ({ dir, logger }) => {
      const redirectsFile = new URL('_redirects', dir);
      let existing: string;
      try {
        existing = await readFile(redirectsFile, 'utf8');
      } catch {
        logger.warn('`_redirects` not found in the build output — nothing to extend');
        return;
      }
      const lines = existing.split('\n');
      const missing = LEGACY_REDIRECTS.filter(
        ([source]) => !lines.some((line) => line.startsWith(`${source}    `))
      );
      if (missing.length === 0) return;
      // The adapter's file can end without a newline; joining onto it would
      // glue the first appended row into the last adapter row and corrupt both.
      const prefix = existing.endsWith('\n') ? '' : '\n';
      const rows = prefix + missing.map(([source, target]) => `${source}    ${target}    301\n`).join('');
      await appendFile(redirectsFile, rows);
      logger.info(`appended ${missing.length} no-slash redirect variant(s) to \`_redirects\``);
    },
  },
};

export default defineConfig({
  // Published URLs carry the trailing slash (canonicals, sitemap and RSS all
  // emit it); the setting only shapes dev/on-demand routing — static pages are
  // served as directories by the asset server regardless.
  trailingSlash: 'always',

  // The deployment origin. Wrangler vars reach this module as process.env
  // (see injectWranglerVars above), so CI builds resolve it from wrangler.jsonc.
  site: process.env.SITE_URL || 'https://www.tranquillinfra.com',

  // Type-safe environment. Runtime secrets are declared with access 'secret';
  // build-time public values (measurement ids, Formspree form id) are declared
  // as 'client' and inlined by the compiler — the Cloudflare build loads the
  // wrangler `vars` block into the build env. Optional secrets keep the
  // graceful degradation the site is designed around — a missing Resend key
  // makes /api/customer-mail answer an honest 502, a missing CAPI token leaves
  // the pixel working alone — instead of blocking the deploy the way
  // `secrets.required` would.
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
  //
  // The remaining entries are the legacy surface inherited from the previous
  // site (WordPress paths, the printed brochure link and the campaign
  // landing pages). They are 301s at the asset server; every target keeps
  // the site's trailing-slash form so no extra hop is added.
  redirects: {
    '/projects': '/projects/tranquill-city/',
    // The project page lives at its slugged URL. Keep this permanently: the
    // printed brochure and the published articles link here, and fragments
    // like #project-brochure survive the hop.
    '/careers': '/about-us/',
    '/application-form': '/contact-us/',
    '/campaigns/tranquill-city-premium-villa-plots': '/projects/tranquill-city/',
    '/campaigns/tranquill-city-plots-near-hyderabad': '/projects/tranquill-city/',
    // Legacy tree roots — the leaf URLs above redirected, these kept 404ing.
    // One entry each; Astro emits the slash and no-slash variants.
    '/campaigns': '/projects/tranquill-city/',
    '/brochure': '/brochure/tranquill-city-final.pdf',
    '/sitemap.xml': '/sitemap-index.xml',
    '/brochure/tranquill-city.pdf': '/brochure/tranquill-city-final.pdf',
    '/wp-content/uploads/2025/12/Tranquill-City-Broucher.pdf': '/brochure/tranquill-city-final.pdf',
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
    sitemap({
      // Content freshness is a ranking input; the collections carry the dates.
      serialize(item) {
        if (!sitemapLastmodFilled) {
          fillSitemapLastmod();
          sitemapLastmodFilled = true;
        }
        const lastmod = sitemapLastmod[new URL(item.url).pathname];
        return lastmod ? { ...item, lastmod } : item;
      },
    }),

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
      Logger: 0,
    }),

    redirectVariants,
  ],

  image: {
    // Astro's default Sharp service handles local images. Every component in
    // this repo renders local assets through astro:assets (`Picture` /
    // `getImage`); there is no remote-CDN image path left, so no `domains`
    // allow-list is needed.
    responsiveStyles: true,
  },

  markdown: {
    rehypePlugins: [responsiveTablesRehypePlugin],
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
