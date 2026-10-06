import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const requiredHosts = [
  'https://www.googleadservices.com',
  'https://googleads.g.doubleclick.net',
  'https://pagead2.googlesyndication.com',
  'https://www.google.com',
  'https://www.google.co.in',
  'https://ad.doubleclick.net',
];

describe('measurement CSP', () => {
  it('keeps static and worker connection policies identical and permits Ads beacons', () => {
    const policies = ['../../public/_headers', '../middleware.ts'].map((path) => {
      const source = readFileSync(new URL(path, import.meta.url), 'utf8');
      return source
        .match(/connect-src ([^;]+);/)![1]
        .split(/\s+/)
        .sort();
    });
    expect(policies[0]).toEqual(policies[1]);
    for (const host of requiredHosts) expect(policies[0]).toContain(host);
  });
});
