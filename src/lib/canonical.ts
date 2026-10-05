/**
 * Canonical URLs
 *
 * One normalisation for the whole site: trailing-slash form, resolved against
 * the site origin.
 *
 * The origin is a parameter rather than read from `site.config.ts`, which
 * imports the build-time-only `astro:env/server` and cannot be loaded into the
 * browser bundle — and `src/lib/url-hygiene.ts` needs this same rule client-side.
 * Callers pass `siteConfig.url`, which is the same `SITE_URL` the Astro config
 * sets, so there is still only one origin in the build.
 */

/** The trailing-slash form: a directory path ends in `/`, a file does not. */
export function canonicalPathname(pathname: string): string {
  const isFile = /\/[^/]+\.[a-z0-9]+$/i.test(pathname);
  return isFile || pathname.endsWith('/') ? pathname : `${pathname}/`;
}

export function canonicalUrl(pathname: string, origin: string | URL): string {
  return new URL(canonicalPathname(pathname), origin).toString();
}