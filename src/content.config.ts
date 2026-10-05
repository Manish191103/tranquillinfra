import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

// Blog collection with the Content Layer API
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().max(100),
      description: z.string().max(200),
      /**
       * First publication date. `updatedAt` is a different fact: it means "this
       * copy was last reviewed". Conflating the two makes every copy edit look
       * like a republish, which pushes `datePublished` (and the listing and
       * video dates derived from it) forward forever and erases the record of
       * when a post was actually first made public.
       */
      publishedAt: z.coerce.date(),
      updatedAt: z.coerce.date().optional(),
      author: z.string().default('Team'),
      image: image().optional(),
      imageAlt: z.string().optional(),
      category: z.string().default('Insights'),
      tags: z.array(z.string()).default([]),
      /** Reviewed answers published with the article and emitted as FAQPage */
      faq: z.array(z.object({ question: z.string(), answer: z.string() })).default([]),
      /** External references cited by the article */
      sources: z
        .array(z.object({ label: z.string(), url: z.url({ protocol: /^https?$/ }) }))
        .default([]),
      draft: z.boolean().default(false),
      featured: z.boolean().default(false),
    }),
});

// Pages collection for Markdown-backed static pages
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    /**
     * The page's single H1, rendered by the hero. It lives here rather than as
     * the body's first heading so the hero and the document cannot each render
     * it — one H1 per page, and one place to edit it.
     */
    heroTitle: z.string().optional(),
    /**
     * The one-paragraph lede a hero shows. A page body can run to several
     * paragraphs, which is right for indexing and wrong above the fold: a
     * mobile hero has roughly 600px before the image and the primary action
     * fall off the screen. The hero takes this; the body stays in the page.
     */
    heroIntro: z.string().optional(),
    // Content freshness is a ranking input and the sitemap reads these dates
    // straight off the frontmatter, so both are declared here.
    publishedAt: z.coerce.date().optional(),
    updatedAt: z.coerce.date().optional(),
    draft: z.boolean().default(false),
  }),
});

// Projects collection: the marketed development pages. Editorial content only —
// the published statics (project type, plot sizes, approval references) live in
// `src/config/project.config.ts` so every surface renders the same values.
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      displayTitle: z.string(),
      projectType: z.string(),
      location: z.string(),
      intro: z.string(),
      layout: z.string(),
      verificationNote: z.string(),
      hero: z.object({
        image: image(),
        alt: z.string(),
        caption: z.string(),
        /**
         * Muted looping background clip over the still; the still should be the
         * clip's frame 0 so the cut into playback is invisible. Optional — the
         * hero stays still-only without it.
         */
        video: z
          .object({
            /** Self-hosted; served from the Worker's static assets */
            src: z.string().startsWith('/media/projects/'),
            mobileSrc: z.string().startsWith('/media/projects/').optional(),
          })
          .optional(),
      }),
      plan: z.object({
        eyebrow: z.string(),
        title: z.string(),
        intro: z.string(),
        image: image(),
        alt: z.string(),
        caption: z.string(),
        note: z.string(),
      }),
      story: z.object({
        eyebrow: z.string(),
        title: z.string(),
        intro: z.string(),
        note: z.string(),
        images: z.array(z.object({ image: image(), alt: z.string(), caption: z.string() })),
      }),
      amenities: z.object({
        eyebrow: z.string(),
        title: z.string(),
        intro: z.string(),
        note: z.string(),
        groups: z.array(
          z.object({
            title: z.string(),
            items: z.array(
              z.object({ name: z.string(), description: z.string(), icon: z.string() })
            ),
          })
        ),
      }),
      locationSection: z.object({
        eyebrow: z.string(),
        title: z.string(),
        intro: z.string(),
        note: z.string(),
        groups: z.array(z.object({ title: z.string(), landmarks: z.array(z.string()) })),
      }),
      facts: z.object({
        eyebrow: z.string(),
        title: z.string(),
        intro: z.string(),
      }),
      faq: z.object({
        eyebrow: z.string(),
        title: z.string(),
        intro: z.string(),
        items: z.array(z.object({ question: z.string(), answer: z.string() })),
      }),
      enquiry: z.object({
        eyebrow: z.string(),
        title: z.string(),
        intro: z.string(),
      }),
      /**
       * Buyer testimonials. Only `id` and the media are required — the clips
       * ship viewable first; the name, context, quote and consent fields are
       * rendered when the team supplies the consented copy. `consentRecordedAt`
       * records that a signed release for website use is on file — the release
       * itself is stored by the team, never in this repo.
       *
       * Every consented-copy field is optional and must stay that way: `name`,
       * `context`, `quote`, `consentRef` and `consentRecordedAt` on the item,
       * and `captions` and `transcript` on its `video`. A clip without a written
       * consent record is still a real buyer, and requiring the record would
       * push the team towards publishing nothing rather than publishing
       * accurately.
       */
      testimonials: z
        .object({
          eyebrow: z.string(),
          title: z.string(),
          intro: z.string(),
          /** Disclosure rendered under the rail; keep the "individual accounts" line */
          note: z.string(),
          items: z
            .array(
              z.object({
                /** Stable key: media file prefix and the consent-register key */
                id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
                /** Name exactly as consented; initials or first name are fine */
                name: z.string().optional(),
                /** One line, no promises: who they are, what they bought */
                context: z.string().optional(),
                /** Short quote for the card and the dialog; ≤ 240 characters */
                quote: z.string().max(240).optional(),
                /** Date the signed release was filed */
                consentRecordedAt: z.coerce.date().optional(),
                /** Reference in the team's release register, e.g. TC-CONSENT-2026-014 */
                consentRef: z.string().optional(),
                photo: z.object({ image: image(), alt: z.string() }).optional(),
                video: z
                  .object({
                    /** Self-hosted; served from the Worker's static assets */
                    src: z.string().startsWith('/media/testimonials/'),
                    poster: image(),
                    posterAlt: z.string(),
                    /** Runtime label shown on the card, e.g. `0:52` */
                    duration: z.string(),
                    orientation: z.enum(['portrait', 'landscape']).default('portrait'),
                    /** WebVTT tracks; the first entry is the default track */
                    captions: z
                      .array(
                        z.object({
                          src: z.string().startsWith('/media/testimonials/'),
                          lang: z.string(),
                          label: z.string(),
                        })
                      )
                      .default([]),
                    /** Full transcript, plain text; rendered in the dialog */
                    transcript: z.string().optional(),
                  })
                  .optional(),
              })
            )
            .default([]),
        })
        .optional(),
      /** Rendered as an anchor href — http(s) only, so `javascript:` cannot slip in */
      directionsUrl: z.url({ protocol: /^https?$/ }),
      /**
       * Layout pin. Duplicates `project.config.ts` `coordinates`, which every
       * other surface reads; the published point belongs in the project config
       * alone.
       */
      coordinates: z.object({ latitude: z.number(), longitude: z.number() }),
      /**
       * First publication of the project page, distinct from `updatedAt`
       * ("this copy was last reviewed"). `datePosted` and the clip `uploadDate`
       * values must read this, not `updatedAt` — otherwise a layout copy edit
       * re-dates the listing and every video on the page.
       */
      publishedAt: z.coerce.date().optional(),
      updatedAt: z.coerce.date().optional(),
    }),
});

export const collections = {
  blog,
  pages,
  projects,
};
