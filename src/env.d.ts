// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference types="vite/client" />
/// <reference types="../vendor/integration/types.d.ts" />

declare module 'cloudflare:workers' {
  /** Worker bindings from `wrangler.jsonc` plus values set with `wrangler secret put`. */
  export const env: Record<string, unknown>;
}
