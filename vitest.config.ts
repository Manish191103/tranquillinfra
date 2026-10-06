import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// The lib modules use the tsconfig `~/*` alias; vitest needs it mapped to run
// them outside Astro's bundler.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
  resolve: {
    alias: { '~': resolve(import.meta.dirname, 'src') },
  },
});
