# Set Up Decap CMS

The site ships a Decap CMS admin at `/decapcms/` (`public/decapcms/index.html`
+ `config.yml`). The bundle is self-hosted — copied from the `decap-cms`
package into `public/decapcms/`, no CDN dependency. Authentication uses the
GitHub backend with PKCE, so no OAuth proxy server is needed on Cloudflare.

## Auth setup

1. Register a GitHub OAuth App (github.com/settings/developers): homepage
   `https://www.tranquillinfra.com`, callback URL
   `https://www.tranquillinfra.com/decapcms/`. PKCE needs only the client ID —
   no client secret.
2. Put the client ID in `public/decapcms/config.yml` under `backend.app_id`.
3. `backend.branch` is the branch CMS saves commit to — keep it on the branch
   the Cloudflare deploy builds.

## Collections

`config.yml` defines three collections mirroring the Zod schemas in
`src/content.config.ts`:

- **post** — `src/data/post`, create enabled, `/blog/<slug>/`.
- **page** — `src/data/page`, create enabled, rendered at `/<slug>/` by
  `src/pages/[...slug].astro`.
- **project** — `src/data/project`, rendered at `/projects/<slug>/` by
  `src/pages/projects/[...slug].astro`.

Add a field to both `config.yml` and the schema when extending content.

## Media

`media_folder: src/assets/images`, `public_folder: ~/assets/images` — uploads
are stored in `src/assets/images` and referenced as `~/assets/images/<file>`,
the form the AstroWind `findImage()` resolver optimises. Video files stay in
`public/media/` and their URLs are typed as plain strings.

## Notes

- Content is read at build time (see `content-at-build-time.md`): a save in
  the CMS commits to the repo, and the deploy of that branch publishes it.
- To refresh the bundle: copy `node_modules/decap-cms/dist/` (excluding
  `*.map`) into `public/decapcms/`. The minified bundle is excluded from ESLint
  (eslint.config.js) and `astro check` (tsconfig.json exclude).
- The admin page is `noindex` and loads no third-party origins, so the
  `public/_headers` CSP needs no exception for it.
- `src/navigation.ts` is TypeScript and not CMS-editable: new pages created in
  the CMS won't appear in the header nav until navigation is moved into data.
