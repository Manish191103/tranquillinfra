import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const metadataDefinition = () =>
  z
    .object({
      title: z.string().optional(),
      ignoreTitleTemplate: z.boolean().optional(),

      canonical: z.url().optional(),

      robots: z
        .object({
          index: z.boolean().optional(),
          follow: z.boolean().optional(),
        })
        .optional(),

      description: z.string().optional(),

      openGraph: z
        .object({
          url: z.string().optional(),
          siteName: z.string().optional(),
          images: z
            .array(
              z.object({
                url: z.string(),
                width: z.number().optional(),
                height: z.number().optional(),
              })
            )
            .optional(),
          locale: z.string().optional(),
          type: z.string().optional(),
        })
        .optional(),

      twitter: z
        .object({
          handle: z.string().optional(),
          site: z.string().optional(),
          cardType: z.string().optional(),
        })
        .optional(),
    })
    .optional();

const postCollection = defineCollection({
  loader: glob({ pattern: ['*.md', '*.mdx'], base: 'src/data/post' }),
  schema: z.object({
    publishDate: z.date().optional(),
    updateDate: z.date().optional(),
    draft: z.boolean().optional(),

    title: z.string(),
    excerpt: z.string().optional(),
    image: z.string().optional(),
    /** Alternative text for the cover image. Leave empty for decorative stock photos. */
    imageAlt: z.string().optional(),

    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    author: z.string().optional(),

    featured: z.boolean().optional(),

    /** Buyer-education questions — rendered as an FAQ section and FAQPage JSON-LD. */
    faq: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),

    /** External reference links rendered as a Sources list on the post page. */
    sources: z.array(z.object({ label: z.string(), url: z.string() })).optional(),

    metadata: metadataDefinition(),
  }),
});

/**
 * About-page section blocks. The About entry carries the copy for its ported
 * section widgets in frontmatter; the page composes the widgets and the
 * presentation stays in them. Every field is optional, so a plain prose page
 * (`privacy-policy`) stays valid without them.
 */
const aboutNumberedItem = z.object({ number: z.string(), title: z.string(), body: z.string() });
const aboutIconItem = z.object({ icon: z.string(), title: z.string(), body: z.string() });

const pageCollection = defineCollection({
  loader: glob({ pattern: ['*.md', '*.mdx'], base: 'src/data/page' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    heroTitle: z.string().optional(),
    heroIntro: z.string().optional(),
    publishedAt: z.date().optional(),
    updatedAt: z.date().optional(),
    draft: z.boolean().optional(),
    metadata: metadataDefinition(),

    /** Three governing promises, each numbered. */
    approach: z
      .object({
        eyebrow: z.string(),
        title: z.string(),
        items: z.array(aboutNumberedItem),
      })
      .optional(),

    /** Mission and vision statements; `featured` marks the primary statement. */
    missionVision: z
      .object({
        eyebrow: z.string(),
        title: z.string(),
        intro: z.string(),
        cards: z.array(
          z.object({
            label: z.string(),
            title: z.string(),
            body: z.string(),
            featured: z.boolean().optional(),
          })
        ),
      })
      .optional(),

    /** The enquiry path, plus the verification-guide card beside it. */
    process: z
      .object({
        eyebrow: z.string(),
        title: z.string(),
        intro: z.string(),
        steps: z.array(aboutNumberedItem),
        guide: z.object({
          eyebrow: z.string(),
          title: z.string(),
          body: z.string(),
          href: z.string(),
          label: z.string(),
        }),
      })
      .optional(),

    /** The standards behind the work, with the infrastructure render feature. */
    values: z
      .object({
        eyebrow: z.string(),
        title: z.string(),
        intro: z.string(),
        imageAlt: z.string(),
        feature: z.object({ eyebrow: z.string(), title: z.string(), body: z.string() }),
        items: z.array(aboutIconItem),
      })
      .optional(),

    /** Four expectations set on the inverted surface. */
    difference: z
      .object({ eyebrow: z.string(), title: z.string(), items: z.array(aboutIconItem) })
      .optional(),
  }),
});

const projectSchema = z.object({
  title: z.string(),
  displayTitle: z.string().optional(),
  description: z.string(),
  projectType: z.string().optional(),
  location: z.string().optional(),
  intro: z.string().optional(),
  layout: z.string().optional(),
  verificationNote: z.string().optional(),
  hero: z
    .object({
      image: z.string(),
      alt: z.string(),
      caption: z.string().optional(),
      video: z
        .object({
          src: z.string(),
          mobileSrc: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  plan: z.record(z.string(), z.unknown()).optional(),
  story: z.record(z.string(), z.unknown()).optional(),
  amenities: z.record(z.string(), z.unknown()).optional(),
  locationSection: z.record(z.string(), z.unknown()).optional(),
  facts: z.unknown().optional(),
  faq: z
    .object({ items: z.array(z.object({ question: z.string(), answer: z.string() })) })
    .optional(),
  enquiry: z.record(z.string(), z.unknown()).optional(),
  testimonials: z.record(z.string(), z.unknown()).optional(),
  directionsUrl: z.string().optional(),
  coordinates: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
  publishedAt: z.date().optional(),
  updatedAt: z.date().optional(),
  draft: z.boolean().optional(),
  metadata: metadataDefinition(),
});

const projectCollection = defineCollection({
  loader: glob({ pattern: ['*.md', '*.mdx'], base: 'src/data/project' }),
  schema: projectSchema,
});

export const collections = {
  post: postCollection,
  page: pageCollection,
  project: projectCollection,
};
