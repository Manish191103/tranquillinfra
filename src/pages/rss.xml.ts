import type { APIContext } from 'astro';
import { getPublishedPosts } from '~/lib/blog';
import siteConfig from '~/config/site.config';

/**
 * Escapes XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Formats a date to RFC-822 format for RSS
 */
function formatRfc822Date(date: Date): string {
  return date.toUTCString();
}

export async function GET(context: APIContext) {
  const posts = await getPublishedPosts();

  const site = context.site?.toString() ?? siteConfig.url;
  const siteUrl = site.endsWith('/') ? site.slice(0, -1) : site;

  const items = posts
    .map((post) => {
      // Post ids carry the loader's locale prefix (`en/…`); routes do not.
      const link = `${siteUrl}/blog/${post.id.replace('en/', '')}/`;
      // `src/pages/og/[...slug].png.ts` enumerates its paths from the *raw*
      // `post.id`, so the enclosure has to match that, prefix and all.
      // No `length` attribute: RSS 2.0 makes it optional, and a byte count
      // written into this template would be measured against one build's card.
      // The card is content-hashed, so editing a title re-renders it under a new
      // URL while the number here stayed behind — a wrong length that no build
      // or test would flag. Measured sizes today run ~80–100 KB; a client that
      // wants the size fetches the URL and gets the truth.
      const ogImage = `${siteUrl}/og/blog/${post.id}.png`;
      const categories = post.data.tags
        .map((tag) => `<category>${escapeXml(tag)}</category>`)
        .join('\n        ');

      return `    <item>
      <title>${escapeXml(post.data.title)}</title>
      <link>${link}</link>
      <guid>${link}</guid>
      <description>${escapeXml(post.data.description)}</description>
      <pubDate>${formatRfc822Date(post.data.publishedAt)}</pubDate>
      <dc:creator>${escapeXml(post.data.author)}</dc:creator>
      ${categories}
      <enclosure url="${ogImage}" type="image/png"/>
    </item>`;
    })
    .join('\n');

  // `xmlns:dc` carries the byline, not `<author>`: RSS 2.0 defines `<author>` as
  // an email address, and the byline here is a display name. `siteConfig.email`
  // would satisfy the letter of the spec but would assert something untrue — one
  // shared inbox as the author of every individual article — and would discard
  // the per-post `author` frontmatter. `dc:creator` takes a name by definition.
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(siteConfig.name)}</title>
    <description>${escapeXml(siteConfig.description)}</description>
    <link>${siteUrl}</link>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    <language>en-in</language>
    <lastBuildDate>${formatRfc822Date(new Date())}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}
