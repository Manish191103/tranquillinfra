import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('../components/common/Analytics.astro', import.meta.url),
  'utf8'
);
const bootstrap = source.match(/<script is:inline id="ga-init"[^>]*>([\s\S]*?)<\/script>/)![1];
describe('Google bootstrap', () => {
  it.each([
    ['G-test', 'AW-test'],
    ['G-test', ''],
    ['', 'AW-test'],
    ['', ''],
  ])('initializes configured destinations once: %s %s', (gaId, adsId) => {
    const window: { dataLayer?: IArguments[] } = {};
    const context = {
      window,
      document: { getElementById: () => ({ dataset: { id: gaId, adsId } }) },
    };
    runInNewContext(bootstrap, context);
    runInNewContext(bootstrap, context);
    const commands = (window.dataLayer ?? []).map((args) => Array.from(args));
    expect(commands.filter(([name]) => name === 'config').map(([, id]) => id)).toEqual(
      [gaId, adsId].filter(Boolean)
    );
    expect(commands.filter(([name]) => name === 'js')).toHaveLength(gaId || adsId ? 1 : 0);
  });
});
