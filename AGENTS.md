# Tranquill Infra — Agent Instructions

## Project Overview

The Tranquill Infra marketing site, built on **Astro v7** and **Tailwind CSS
v4**. Every page is prerendered and served from Cloudflare Workers. The
component architecture is the one shared with the sibling repo
`../tranquillinfra.com/` (the .com redesign is this architecture's source of
truth); the AstroWind template layer this repo originally shipped has been
removed.

**Stack:** Astro v7 | Tailwind CSS v4 | TypeScript | cva-style component
variants | Cloudflare Workers

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
  styles/global.css          # Tailwind v4 entry: tokens, base, utilities, prose
  styles/tokens/             # primitives / semantic / colors / typography / spacing
  assets/brand/              # Logo files consumed by site.config.ts
  components/
    layout/       # SiteHeader, SiteFooter, AnnouncementBar, MobileContactBar, ImageHero
    home/         # Hero, ScrollBuildStory, ProofBelt, InvestmentBelt, NextSteps…
    about/        # AboutHero, ApproachStrip, MissionVision, ProcessSection, ValuesSection…
    contact/      # ContactHero
    projects/     # ProjectHero/Stats/Story/Plan/Amenities/Location/Testimonials/Enquiry
    patterns/     # Reusable surfaces: ContactForm, EnquiryDialog, FaqSection, Prose…
    seo/          # SEO.astro (head), JsonLd, Breadcrumbs
    ui/           # form/{Button,Input,Select,Textarea} navigation/{Header,Footer}
                  # overlay/{Accordion,Carousel,Dialog} data-display/{GoogleMap,Pagination}
                  # marketing/{Logo,Marquee} primitives/Icon
    common/       # Analytics.astro — the GA4 tag loader (only survivor of the old layer)
    Favicons.astro
  layouts/          # BaseLayout.astro (HTML shell), PageLayout.astro (chrome + dialog)
  pages/            # File-based routing: index, blog/, projects/, about-us/, contact-us…
  content/          # blog/ pages/ projects/ — Markdown content collections
  content.config.ts # Collection schemas (Astro Content Layer, glob loaders)
  config/           # site/project/nav/analytics/consent/contact/about .config.ts
  lib/              # analytics, leads, mail, meta-pixel, meta-conversions, enquiry-cta,
                    # http, rate-limit, schema, canonical, consent, enquiry-popup, cn…
  contact.ts        # NAP facts (phone, WhatsApp, address, approval numbers)
  config.yaml       # Read by the vendored integration; drives Analytics.astro + mail.ts
  middleware.ts     # Security headers for the on-demand API routes
  types.d.ts        # MetaData types (vendored config builder validates config.yaml)
vendor/integration/ # Vendored AstroWind config loader (astrowind:config virtual module)
```

### Path Aliases

Use `~/` to import from `src/`:

```astro
import Button from '~/components/ui/form/Button/Button.astro';
import siteConfig from '~/config/site.config';
```

### Two configuration homes (deliberate, transitional)

- `src/config/*.config.ts` — the typed modules every component reads (site
  identity, NAP, project statics, nav, analytics ids, consent). This is the
  layer copied from .com.
- `src/config.yaml` — still read by the vendored integration; it drives the
  sitemap/robots behaviour and the GA4 property id that
  `components/common/Analytics.astro` renders. `mail.ts` reads `SITE` from it.

Consolidating these is a named follow-up, not silent drift: when touching
config, prefer the TS modules, and never copy a value from one home into the
other without checking both.

## Tailwind CSS v4

Configuration is CSS-first in `src/styles/global.css` + `src/styles/tokens/`:

- **Token chain:** `tokens/primitives.css` (raw scales) →
  `tokens/semantic.css` (brand meanings, contrast annotations) →
  `tokens/colors.css` imports both → `global.css` `@theme` maps them into
  Tailwind namespaces (`bg-background`, `text-foreground-muted`, `bg-primary`, …).
- **Fonts:** the `--site-font-*` stacks lead with the Astro Fonts API
  variables (`--font-manrope`, `--font-fraunces`, `--font-jetbrains-mono`).
- **Base/utilities/components layers** live in `global.css` (grain texture,
  prose styles, `.astro-code` theme, display type scale, keyframes).

The Vite plugin `@tailwindcss/vite` is configured in `astro.config.ts`.

### Class Merging

Components use `cn()` from `~/lib/cn` (clsx + tailwind-merge) and cva variants
(`*.variants.ts` next to each primitive).

## Content Collections

Defined in `src/content.config.ts` using Astro's Content Layer API with
`glob()` loaders: `blog` (`src/content/blog/`), `pages`
(`src/content/pages/`), `projects` (`src/content/projects/`). The projects
schema is strict and carries an `image()` helper (frontmatter image paths
become `ImageMetadata`).

Post frontmatter: `title` (required, ≤100), `description` (required, ≤200),
`publishedAt`, `updatedAt`, `author`, `image`, `imageAlt`, `category`, `tags`,
`faq`, `sources`, `draft`, `featured`.

## Component Patterns

- Components live under their domain folder; primitives under `ui/<category>/
  <Name>/` with a sibling `<name>.variants.ts` (cva).
- Props are declared per component (interface `Props`); shared page metadata
  flows through `PageLayout` props (`title`, `description`, `image`,
  `article`, `noindex`, `lcpPreload`, …), not a `~/types` widget contract.
- Use `class:list` for conditional classes, `cn()` when merging overrides,
  named slots for composition.
- Icons: `~/components/ui/primitives/Icon/Icon.astro` (inline Lucide/Simple
  Icons SVGs). No `astro-icon` dependency.
- Images: `astro:assets` directly (`Picture`, `getImage`); no wrapper component.

## Measurement

`components/common/Analytics.astro` renders the Google Analytics 4 tag from
`analytics.vendors.googleAnalytics.id` in `src/config.yaml` — the only place
the property id lives. Null removes the tag; any value loads it on every page,
with no consent gate. That is deliberate: the site's audience is India-only,
where analytics cookies are not gated on prior consent. Add a gate here before
changing that, not in the config.

`~/lib/analytics.ts` pushes GA4/Ads events into that tag (it deliberately does
not load a second one), `~/lib/meta-pixel.ts` is the client leg of the Meta
pixel and `~/lib/meta-conversions.ts` its server leg (`/api/meta-conversion`).
The consent library (`~/lib/consent.ts`) is ported and its env flag
(`PUBLIC_CONSENT_ENABLED`) defaults to **false** so nothing gates on it; if a
consent banner is ever added, flip that flag — do not gate silently in the
components.

The tag runs on the main thread. `@astrojs/partytown` is the opt-in to move it
into a worker: set `const hasExternalScripts = true` in `astro.config.ts`, which
also switches the tag's `type` to `text/partytown`.

## Content Security Policy

The policy lives in `public/_headers`, applied by the Cloudflare asset server to
every prerendered response, and is mirrored by hand in `src/middleware.ts` for
the responses the Worker renders — Cloudflare does not apply `_headers` to
those. Astro's own CSP support is off: it is incompatible with the
`<ClientRouter />` view transitions this site ships. There is deliberately no
`script-src`/`style-src` (inline GA bootstrap + view-transition runtime); when
adding components that talk to new hosts, extend `connect-src` in BOTH copies.

## Verification Checklist

After changes, always verify:

1. `pnpm validate` succeeds (ESLint, astro check, tests, build)
2. Visual check in a browser, at a mobile width: homepage, blog list, blog post
3. Structured data describes the site it is on — anything added to a
   `WebSite` / `RealEstateAgent` block must be true for this site
4. If config changed: check BOTH config homes (`src/config/*.config.ts` and
   `src/config.yaml`) for a stale copy of the same value
