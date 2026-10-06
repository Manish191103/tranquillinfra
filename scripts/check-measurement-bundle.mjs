/**
 * Production artifact check: fail the build unless every measurement id
 * configured for the site is present in the built client bundle.
 *
 * Why: Astro inlines `import.meta.env.*` at build time and every measurement
 * var is optional, so a build that lost its env deploys a Worker that measures
 * nothing and looks healthy (the 2026-10-01 deploy of the sibling repo
 * shipped exactly that: runtime vars present, ids absent from every asset).
 * `astro.config.ts` injects the public ids from `wrangler.jsonc` into the
 * build env — this check is the second layer: it asserts the ids the build
 * saw actually landed in the artifacts.
 *
 * Id source: public build env, falling back to wrangler.jsonc:
 * - GA4, `wrangler.jsonc` `PUBLIC_GA_MEASUREMENT_ID` — surfaced in the
 *   prerendered HTML as `<script id="ga-init" data-id="…">` (the GA4
 *   tag renders through `Analytics.astro`, not through a client bundle).
 * - Google Ads id — checked in the bootstrap’s data-ads-id attribute.
 * - Google Ads label and Meta pixel id — inlined into the client bundle
 *   (`src/lib/analytics.ts`, `src/lib/meta-pixel.ts`), read from the build
 *   env that `astro.config.ts` fills from `wrangler.jsonc`/process env.
 *
 * Intentionally measurement-disabled builds are supported: opt out by
 * exporting `MEASUREMENT_DISABLED_BUILD=1` for the build. That is THE opt-out;
 * an empty env is not one — silent omission stays a failure.
 *
 * Usage: `node scripts/check-measurement-bundle.mjs [distDir]`
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const DIST = resolve(process.argv[2] ?? 'dist/client');

if (process.env.MEASUREMENT_DISABLED_BUILD === '1') {
  console.log('[measurement-check] skipped — MEASUREMENT_DISABLED_BUILD=1');
  process.exit(0);
}

/** Comments + wrangler's tolerated trailing commas → strict JSON. */
function elideComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,(?=\s*[\]}])/g, '');
}

/**
 * Every `.js` and `.html` file under `dir`, nested.
 */
function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) yield* walk(path);
    else if (['.js', '.html'].includes(path.slice(path.lastIndexOf('.')))) yield path;
  }
}

/** `NAME → value` pairs the artifacts must carry. Env wins; wrangler.jsonc fallback. */
function envOrWrangler(envName) {
  if (process.env[envName]) return process.env[envName];
  try {
    const wrangler = JSON.parse(elideComments(readFileSync(join(ROOT, 'wrangler.jsonc'), 'utf8')));
    return wrangler.vars?.[envName];
  } catch {
    return undefined;
  }
}

const ga4Id = envOrWrangler('PUBLIC_GA_MEASUREMENT_ID');
const adsId = envOrWrangler('PUBLIC_GOOGLE_ADS_ID');
const adsLabel = envOrWrangler('PUBLIC_GOOGLE_ADS_CONVERSION_LABEL');
const pixelId = envOrWrangler('PUBLIC_META_PIXEL_ID');

const corpus = [...walk(DIST)].map((path) => readFileSync(path, 'latin1'));

const expectations = [
  ['GA4 tag', ga4Id],
  ['Google Ads id', adsId],
  ['Google Ads label', adsLabel],
  ['Meta pixel id', pixelId],
];

const configured = expectations.filter(([, id]) => Boolean(id));

if (configured.length === 0) {
  console.error(
    '[measurement-check] FAILED — no measurement ids configured anywhere.\n' +
      'Every id is optional, so astro build succeeds without them — but the\n' +
      'deployed site then measures nothing. Set the ids in wrangler.jsonc (or\n' +
      '.env) and rebuild. To ship measurement deliberately off, set\n' +
      'MEASUREMENT_DISABLED_BUILD=1.'
  );
  process.exit(1);
}

if (corpus.length === 0) {
  console.error(
    `[measurement-check] FAILED — no .js/.html assets under ${DIST}. Was astro build run?`
  );
  process.exit(1);
}

const bootstrapHas = (attribute, id) =>
  corpus.some((text) => {
    const bootstrap = /<script\b[^>]*\bid=["']ga-init["'][^>]*>/.exec(text)?.[0];
    return bootstrap?.includes(`${attribute}="${id}"`);
  });
const missing = configured.filter(([name, id]) => {
  if (name === 'GA4 tag') return !bootstrapHas('data-id', id);
  if (name === 'Google Ads id') return !bootstrapHas('data-ads-id', id);
  return !corpus.some((text) => text.includes(id));
});

if (missing.length > 0) {
  console.error(
    '[measurement-check] FAILED — the built artifacts are missing configured ids:\n' +
      Array.from(missing, ([name]) => `  - ${name}`).join('\n') +
      `\nScanned ${corpus.length} assets under ${DIST}. Restore the build env and rebuild.`
  );
  process.exit(1);
}

const live = configured.filter(([, id]) => corpus.some((text) => text.includes(id)));
console.log(
  `[measurement-check] ok — ${corpus.length} assets, live ids: ${live.map(([name]) => name).join(', ')}`
);
