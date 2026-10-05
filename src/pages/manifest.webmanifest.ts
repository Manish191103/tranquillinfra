import type { APIRoute } from 'astro';
import siteConfig from '~/config/site.config';

export const GET: APIRoute = () => {
  const { name, description, branding } = siteConfig;

  const manifest = {
    name,
    short_name: name,
    description,
    start_url: '/',
    display: 'standalone',
    background_color: branding.colors.backgroundColor,
    theme_color: branding.colors.themeColor,
    // Both icons derive from the square brand mark (`public/favicon.png` is the
    // frame-filling export, `public/icon-512.png` insets the mark for the
    // maskable safe zone). The wordmark is 715×148 and therefore not a valid
    // app icon — regenerate these from the mark source, not the logo lockup.
    icons: [
      {
        src: branding.favicon.path,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      'Content-Type': 'application/manifest+json',
    },
  });
};
