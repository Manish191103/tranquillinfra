# Tranquill Infra — Agent Instructions

## Project Overview

The Tranquill Infra marketing site, built on **AstroWind** (a free, open-source
Astro template) with **Astro v7** and **Tailwind CSS v4**. Every page is
prerendered and served from Cloudflare Workers.

**Stack:** Astro v7 | Tailwind CSS v4 | TypeScript | AstroWind widgets | Cloudflare Workers

The theme layer is AstroWind's: page sections live in `src/components/widgets/`,
site configuration in `src/config.yaml` (read through the `astrowind:config`
virtual module), and the brand palette in `src/components/CustomStyles.astro`.
Everything below describes how this site uses that layer.

## Skills

Before implementing a project-specific task (adding a page, adding a blog post,
changing the header, deployment…), check `.agents/skills/` for an existing
skill and follow it.

## Quick Reference

| Command         | Purpose                                         |
| --------------- | ----------------------------------------------- |
| `pnpm dev`      | Start dev server at localhost:4321              |
| `pnpm build`    | Production build to `./dist/`                   |
| `pnpm preview`  | Preview the production build locally            |
| `pnpm check`    | Run astro check + ESLint + Prettier             |
| `pnpm lint`     | ESLint only                                     |
| `pnpm test`     | Vitest unit tests (`src/**/*.test.ts`)          |
| `pnpm fix`      | Auto-fix ESLint + Prettier issues               |
| `pnpm validate` | Lint, typecheck, test and build — the full gate |
| `pnpm deploy`   | Build, then `wrangler deploy`                   |

**Node.js requirement:** >= 22.22.3 (pnpm)

## Architecture

### Directory Structure

```
src/
  assets/styles/tailwind.css   # Tailwind v4 config (themes, utilities, plugins)
  components/
    common/        # Shared: Image, Metadata, Analytics, ToggleTheme
    ui/            # Primitives: Button, Form, Headline, Timeline, WidgetWrapper
    widgets/       # Page sections: Hero, Features, Bento, Pricing, Comparison, FAQs, Team, Gallery…
    blog/          # Blog: SinglePost, List, Pagination, Tags
    CustomStyles.astro  # CSS variables for colors and fonts
  content.config.ts    # Content Collections schema (Astro 5+ location)
  data/post/           # Blog posts (.md, .mdx)
  layouts/             # Layout.astro, PageLayout.astro, MarkdownLayout.astro
  pages/               # File-based routing
  utils/               # blog.ts, images.ts, permalinks.ts, frontmatter.ts
  config.yaml          # Site configuration (loaded as virtual module)
  navigation.ts        # Navigation structure
  types.d.ts           # TypeScript type definitions
vendor/integration/    # Custom Astro integration for config loading
```

### Path Aliases

Use `~/` to import from `src/`:

```typescript
import Image from '~/components/common/Image.astro';
import { SITE } from 'astrowind:config';
```

### Configuration System

Site config lives in `src/config.yaml` and is loaded as a Vite virtual module `astrowind:config` by the custom integration in `vendor/integration/`. Exports: `SITE`, `I18N`, `METADATA`, `APP_BLOG`, `UI`, `ANALYTICS`.

## Tailwind CSS v4

Configuration is CSS-first in `src/assets/styles/tailwind.css`:

- **Theme tokens:** `@theme { --color-primary: var(--aw-color-primary); ... }`
- **Custom utilities:** `@utility bg-page { ... }`
- **Dark mode:** Class-based via `@variant dark (&:where(.dark, .dark *))`
- **Plugins:** `@plugin "@tailwindcss/typography"`
- **Custom variant:** `@custom-variant intersect (&:not([no-intersect]))`

CSS variables for colors/fonts are defined in `src/components/CustomStyles.astro` with light/dark theme variants.

The Vite plugin `@tailwindcss/vite` is configured in `astro.config.ts` (not as an Astro integration).

### Class Merging

Components use `twMerge` from `tailwind-merge` v3 for conditional class composition.

## Content Collections

Defined in `src/content.config.ts` using Astro's Content Layer API with `glob()` loader. Posts are in `src/data/post/` as `.md` or `.mdx` files.

Post frontmatter: `title` (required), `publishDate`, `updateDate`, `draft`, `excerpt`, `image`, `category`, `tags`, `author`, `metadata`.

## Component Patterns

- Props extend interfaces from `~/types`
- Use `class:list` for conditional classes
- Use `twMerge()` when accepting className overrides
- Use named slots for layout composition
- Widget components accept standardized props (see `~/types`)

## Image Handling

`src/components/common/Image.astro` supports:

- Local images via `astro:assets` (optimized by Sharp)
- Remote images via Unpic CDN
- Allowed domains (for providers Unpic can't detect, processed by Sharp): `cdn.pixabay.com`

Hero images use `loading="eager"` and `fetchpriority="high"`.

## Fonts

Fonts are handled by Astro's native **Fonts API**, configured in `astro.config.ts` under the `fonts` key (provider, family, `cssVariable`) and injected via the `<Font />` component in `src/layouts/Layout.astro`. Astro self-hosts, subsets, preloads, and generates metric-adjusted fallbacks. To change the typeface, edit the `fonts` entry and point `--aw-font-*` in `CustomStyles.astro` at the new `cssVariable`.

The brand pairs are Manrope (body, preloaded) with Fraunces (display) and
JetBrains Mono (code, figures), exposed as `--font-manrope`, `--font-fraunces`
and `--font-jetbrains-mono`.

## Colour

One palette, three layers, no literal colours in components:

1. `--aw-*` in `src/components/CustomStyles.astro` — the brand values (forest on
   sand, gold accent), each annotated with the primitive it came from and the
   contrast it measures.
2. Tailwind theme tokens in `src/assets/styles/tailwind.css` (`bg-primary`,
   `text-heading`, `text-muted`, `bg-page`, …).
3. shadcn names in `src/assets/styles/shadcn.css` (`bg-background`,
   `text-foreground`, `border-border`, …) so shadcn-style components added later
   inherit the same palette.

Dark mode is off (`ui.theme: 'light:only'` in `src/config.yaml`) because the
inverted palette has not been designed or contrast-checked for this brand.

## Measurement

`src/components/common/Analytics.astro` renders the Google Analytics 4 tag from
`analytics.vendors.googleAnalytics.id` in `src/config.yaml` — the only place the
property id lives. Null removes the tag; any value loads it on every page, with
no consent gate. That is deliberate: the site's audience is India-only, where
analytics cookies are not gated on prior consent. Add a gate here before
changing that, not in the config.

The tag runs on the main thread. `@astrojs/partytown` is the opt-in to move it
into a worker: set `const hasExternalScripts = true` in `astro.config.ts`, which
also switches the tag's `type` to `text/partytown`.

## Content Security Policy

The policy lives in `public/_headers`, applied by the Cloudflare asset server to
every prerendered response, and is mirrored by hand in `src/middleware.ts` for
the responses the Worker renders — Cloudflare does not apply `_headers` to
those. Astro's own CSP support is off: it is incompatible with the
`<ClientRouter />` view transitions this site ships.

## Verification Checklist

After changes, always verify:

1. `pnpm validate` succeeds (ESLint, astro check, tests, build)
2. Visual check in a browser, at a mobile width: homepage, blog list, blog post
3. Structured data describes the site it is on — anything added to a
   `WebSite` / `Organization` block must be true for this site
