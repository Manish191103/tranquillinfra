import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, getEntry } from 'astro:content';
import { generateOGImage } from '~/lib/og';
import { BLOG_PAGE_SIZE } from '~/lib/blog';
import siteConfig from '~/config/site.config';

// Every path is enumerated by getStaticPaths and the output never varies per
// request, so the route prerenders to static PNGs in dist/client/og at build
// time. This keeps sharp + satori out of the deployed Worker bundle entirely.
export const prerender = true;

// Static pages that need an OG image. Descriptions come from the content
// entry each page renders (or the page's own copy) so the shared card matches
// the search snippet; `description` is only a fallback for pages without one.
//
// No 404 entry: the not-found page is `noindex` and has no URL of its own, so a
// generated card for it is a crawlable image with nothing to be a card for. It
// used to be listed here, and the page still pointed `og:image` at it.
const STATIC_PAGES: Array<{ slug: string; title: string; description: string; entry?: string }> = [
  { slug: 'index', title: siteConfig.name, description: siteConfig.description, entry: 'home' },
  { slug: 'about-us', title: 'About us', description: siteConfig.description, entry: 'about-us' },
  {
    slug: 'blog',
    title: 'Insights',
    description:
      'Guides on plot buying, approvals, registration and verification in Telangana, plus Tranquill City project updates.',
  },
  {
    slug: 'contact-us',
    title: 'Contact us',
    description:
      'Call, message or email the Tranquill Infra team — phone, WhatsApp, our Miyapur office address in Hyderabad, business hours and a contact form on this page.',
  },
  {
    slug: 'privacy-policy',
    title: 'Privacy policy',
    description: siteConfig.description,
    entry: 'privacy-policy',
  },
];

async function entryDescription(entry: string | undefined, fallback: string): Promise<string> {
  if (!entry) return fallback;
  const record = await getEntry('pages', entry);
  return record?.data.description ?? fallback;
}

export const getStaticPaths: GetStaticPaths = async () => {
  // Get all blog posts
  const blogPosts = await getCollection('blog', ({ data }) => {
    return import.meta.env.PROD ? data.draft !== true : true;
  });

  // Generate paths for blog posts
  const blogPaths = blogPosts.map((post) => ({
    params: { slug: `blog/${post.id}` },
    props: {
      title: post.data.title,
      description: post.data.description,
      type: 'article' as const,
    },
  }));

  // Generate paths for static pages
  const staticPaths = await Promise.all(
    STATIC_PAGES.map(async (page) => ({
      params: { slug: page.slug },
      props: {
        title: page.title,
        description: await entryDescription(page.entry, page.description),
        type: 'website' as const,
      },
    }))
  );

  // Project pages (/projects/<id>/) take their card from the same content
  // entry the page renders.
  const projectPaths = (await getCollection('projects')).map((project) => ({
    params: { slug: `projects/${project.id}` },
    props: {
      title: project.data.title,
      description: project.data.description,
      type: 'website' as const,
    },
  }));

  // Paginated archive pages (/blog/2/, …) derive their cards from the same page
  // size the archive uses, so a seventh post cannot leave og:image 404ing.
  const archivePages = Math.max(0, Math.ceil(blogPosts.length / BLOG_PAGE_SIZE) - 1);
  const pagePaths = Array.from({ length: archivePages }, (_, index) => {
    const page = index + 2;
    return {
      params: { slug: `blog/${page}` },
      props: {
        title: `Insights — page ${page}`,
        description:
          'Guides on plot buying, approvals, registration and verification in Telangana, plus Tranquill City project updates.',
        type: 'website' as const,
      },
    };
  });

  return [...staticPaths, ...blogPaths, ...projectPaths, ...pagePaths];
};

export const GET: APIRoute = async ({ props }) => {
  const { title, description, type } = props as {
    title: string;
    description?: string;
    type: 'website' | 'article';
  };

  const png = await generateOGImage({
    title,
    description,
    type,
  });

  // Convert Buffer to Uint8Array for Response compatibility
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
