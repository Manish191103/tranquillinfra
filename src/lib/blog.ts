import { getCollection, type CollectionEntry } from 'astro:content';

/**
 * Posts per page on the insights archive; the OG route mirrors this for /blog/N/ cards.
 *
 * 12, deliberately: the archive holds six published posts today, and a page size
 * of 6 put the next post's arrival one click from a second page. That pushed the
 * two oldest posts — including the `featured` flagship, the buyer-verification
 * guide, which is the post a buyer arrives for — onto `/blog/2/`, one hop from
 * nothing, and split the site's deepest-inlinked pages across two URLs. A page
 * size above the archive's current depth keeps every post on `/blog/` until the
 * archive genuinely outgrows one page.
 */
export const BLOG_PAGE_SIZE = 12;

/** Published posts, newest first. */
export async function getPublishedPosts(): Promise<CollectionEntry<'blog'>[]> {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());
}

/** Estimated reading time in whole minutes (~200 words per minute, minimum 1). */
export function getReadingMinutes(post: CollectionEntry<'blog'>): number {
  const words = post.body?.trim().split(/\s+/).filter(Boolean).length ?? 0;
  return Math.max(1, Math.round(words / 200));
}

/**
 * Other posts for the "More from Insights" rail, best match first: shared tags
 * and the same category score highest, then the newest of what is left — so a
 * small archive still links somewhere useful instead of hiding the rail.
 *
 * Measured limitation, no behavioural change: each of the six published posts
 * has its own category (Buying Guide, Approvals, Financing, Registration,
 * Location, Company), so the `+1` category term never scores a match and the
 * rail ranks on tags alone. The one-post categories make the archive's category
 * chips single-entry filters too. Fixing either means changing the taxonomy or
 * the categories, which is a content decision — until then, the newest-first
 * tiebreak is what the rail actually has.
 */
export function getRelatedPosts(
  posts: CollectionEntry<'blog'>[],
  current: CollectionEntry<'blog'>,
  limit = 2
): CollectionEntry<'blog'>[] {
  const score = (post: CollectionEntry<'blog'>) => {
    const sharedTags = post.data.tags.filter((tag) => current.data.tags.includes(tag)).length;
    return sharedTags * 2 + (post.data.category === current.data.category ? 1 : 0);
  };

  return posts
    .filter((post) => post.id !== current.id)
    .map((post) => ({ post, score: score(post) }))
    .sort(
      (a, b) =>
        b.score - a.score || b.post.data.publishedAt.getTime() - a.post.data.publishedAt.getTime()
    )
    .slice(0, limit)
    .map((entry) => entry.post);
}
