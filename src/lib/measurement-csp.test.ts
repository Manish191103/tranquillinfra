import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Every origin the browser measurement pipeline can call, checked against the
 * policy with real CSP host-part matching. A `*.` wildcard matches subdomains
 * only, so `https://analytics.google.com/g/collect` is NOT covered by
 * `https://*.analytics.google.com` even though it reads that way — it needs
 * its own entry (it had none until Tag Assistant caught the tag's collect
 * being refused, 2026-10-07).
 */
const endpoints = [
  'https://formspree.io/f/tranquill',
  'https://www.googletagmanager.com/gtag/js?id=G-TEST',
  'https://www.google-analytics.com/g/collect',
  'https://region1.google-analytics.com/g/collect',
  'https://analytics.google.com/g/collect',
  'https://www.facebook.com/tr/',
  'https://www.googleadservices.com/pagead/conversion/1',
  'https://googleads.g.doubleclick.net/pagead/viewthroughconversion/1',
  'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
  'https://www.google.com/ads/ga-audiences',
  'https://www.google.co.in/ads/ga-audiences',
  'https://ad.doubleclick.net/activity;src=1',
];

/** CSP host matching (CSP3 §6.6.2.6): `*.` covers subdomains, never the apex. */
function matchesEndpoint(entry: string, url: URL): boolean {
  if (entry === "'self'") return false;
  const source = new URL(entry);
  if (source.protocol !== url.protocol) return false;
  const pattern = source.host;
  if (pattern.startsWith('*.')) return url.host.endsWith(pattern.slice(1));
  return pattern === url.host;
}

describe('measurement CSP', () => {
  it('keeps both connection policies identical and permits every measurement endpoint', () => {
    const policies = ['../../public/_headers', '../middleware.ts'].map((path) => {
      const source = readFileSync(new URL(path, import.meta.url), 'utf8');
      return source
        .match(/connect-src ([^;]+);/)![1]
        .split(/\s+/)
        .sort();
    });
    expect(policies[0]).toEqual(policies[1]);

    for (const endpoint of endpoints) {
      const url = new URL(endpoint);
      const allowed = policies[0].some((entry) => matchesEndpoint(entry, url));
      expect(allowed, `${endpoint} is not allowed by connect-src`).toBe(true);
    }
  });
});
