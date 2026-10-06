import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const directories: string[] = [];
afterEach(() => {
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function verify(attributes: string) {
  const dir = mkdtempSync(join(tmpdir(), 'measurement-test-'));
  directories.push(dir);
  writeFileSync(join(dir, 'index.html'), `<script ${attributes} id="ga-init"></script>`);
  // IDs in arbitrary JavaScript must not substitute for destination configuration.
  writeFileSync(join(dir, 'events.js'), 'G-test AW-test ads-label pixel-test');
  return () =>
    execFileSync(process.execPath, ['scripts/check-measurement-bundle.mjs', dir], {
      env: {
        ...process.env,
        MEASUREMENT_DISABLED_BUILD: '0',
        PUBLIC_GA_MEASUREMENT_ID: 'G-test',
        PUBLIC_GOOGLE_ADS_ID: 'AW-test',
        PUBLIC_GOOGLE_ADS_CONVERSION_LABEL: 'ads-label',
        PUBLIC_META_PIXEL_ID: 'pixel-test',
      },
      stdio: 'pipe',
    }).toString();
}
describe('built measurement destinations', () => {
  it('accepts configured bootstrap attributes regardless of their order', () => {
    expect(verify('data-ads-id="AW-test" data-id="G-test"')()).toContain('[measurement-check] ok');
  });
  it.each(['data-ads-id="AW-test"', 'data-id="G-test"', 'data-id="G-stale" data-ads-id="AW-test"'])(
    'rejects absent or stale configured bootstrap destinations: %s',
    (attributes) => {
      expect(verify(attributes)).toThrow();
    }
  );
});
