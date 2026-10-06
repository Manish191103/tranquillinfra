# Tranquill Infra

The Tranquill Infra marketing site — built on [AstroWind](https://github.com/arthelokyo/astrowind)
with **Astro 7** and **Tailwind CSS v4**, prerendered and served from
**Cloudflare Workers**.

Upstream is MIT-licensed and © onWidget; see [LICENSE.md](./LICENSE.md). The
theme's own vendored integration lives in `vendor/` and is not ours to edit.

## Commands

| Command         | Purpose                                     |
| --------------- | ------------------------------------------- |
| `pnpm dev`      | Start dev server at localhost:4321          |
| `pnpm build`    | Production build to `./dist/`               |
| `pnpm preview`  | Preview the production build locally        |
| `pnpm check`    | astro check + ESLint + Prettier             |
| `pnpm lint`     | ESLint only                                 |
| `pnpm test`     | Vitest                                      |
| `pnpm fix`      | Auto-fix ESLint + Prettier                  |
| `pnpm validate` | The full gate: lint, typecheck, test, build |
| `pnpm deploy`   | Build, then `wrangler deploy`               |

Node >= 22.22.3. pnpm is the package manager; `package-lock.json` is ignored.

## Where things live

```
src/
  config.yaml          # Site config (name, URLs, SEO defaults, blog, analytics, theme)
  navigation.ts        # Header and footer menus
  content.config.ts    # Content-collection schema
  data/post/           # Blog posts (.md, .mdx)
  assets/styles/       # tailwind.css (theme + utilities) and shadcn.css (token bridge)
  components/
    widgets/           # Page sections: Hero, Features, Bento, Pricing, FAQs, Gallery…
    common/            # Image, Metadata, Analytics, StructuredData, Intersect
    ui/                # Button, Form, Headline, WidgetWrapper
    blog/              # SinglePost, List, ListItem, Pagination
    CustomStyles.astro # Brand palette and font variables
  layouts/             # Layout, PageLayout, LandingLayout, MarkdownLayout
  pages/               # File-based routing
  utils/               # blog, images, permalinks, frontmatter helpers
vendor/integration/    # AstroWind's config loader (vendored upstream, do not edit)
```

Import from `src/` with the `~/` alias. Read site config through the
`astrowind:config` virtual module:

```ts
import { SITE, METADATA } from 'astrowind:config';
```

## Three things to know before you edit

1. **One palette, three layers.** Brand values live as `--aw-*` in
   `src/components/CustomStyles.astro`, become Tailwind tokens in
   `tailwind.css`, and are re-exported under shadcn names in `shadcn.css`. No
   component writes a literal colour.
2. **Dark mode is off** (`ui.theme: 'light:only'`). The `dark:` classes on the
   theme's widgets compile to nothing useful until an inverted palette exists;
   strip them from anything you port rather than carrying dead CSS.
3. **Trailing slashes are on** (`SITE.trailingSlash` in `src/config.yaml`).
   The sitemap, feeds, canonicals and the config loader all read that one value.

## Deployment

`wrangler.jsonc` holds the Worker name, the public configuration as code, and
the log settings. Secrets (`RESEND_API_KEY`, `META_CAPI_ACCESS_TOKEN`,
`META_TEST_EVENT_CODE`) are Worker secrets — `wrangler secret put <NAME>` — and
are never listed in the config. Local secret overrides go in `.dev.vars`, which
beats `wrangler.jsonc`.

Security headers ship in `public/_headers` for prerendered responses and are
mirrored in `src/middleware.ts` for responses the Worker renders.

Deployment is automatic: **Cloudflare Workers Builds is connected to this
repository** and builds + deploys the Worker on every push to `main`. It is
config-as-code — `wrangler.jsonc` is the single deploy source of truth (the
build reads its `vars` through the Astro adapter; nothing is duplicated in the
dashboard). The build itself runs only `pnpm install && pnpm build`; it does
not run the checks, so run `pnpm validate` locally before pushing, the way CI
normally would. There is no GitHub Actions pipeline — Actions cannot start on
this repository's account (billing lock; every run, including a scratch
workflow, failed at startup, 2026-10-06), so Workers Builds deploys every push
instead.

## Agent instructions

[AGENTS.md](./AGENTS.md) documents the architecture in more depth.
