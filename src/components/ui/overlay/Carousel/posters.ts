import { getImage } from 'astro:assets';
import type { ImageOutputFormat } from 'astro';
import type { CarouselSlide } from './carousel';

/**
 * LCP preload support for the carousel's leading slide.
 *
 * The leading slide is the page's LCP element, but its `<picture>` sits deep in
 * the body markup — the parser only discovers the request after the header and
 * hero copy stream past (measured: the poster fetch started ~600 ms after TTFB
 * even on a local server). `buildPosterPreload` produces the `<link
 * rel="preload">` payload so the fetch starts when the head parses instead.
 *
 * A preload only pays when the browser fetches the exact URL the `<picture>`
 * later selects. Astro hashes generated image URLs over `src`, `width`,
 * `height`, `format`, `quality`, `fit`, `position` and `background`
 * (DEFAULT_HASH_PROPS in astro's asset consts), so the transform below must
 * stay in lockstep with `leadingPosterPictureProps`, which Carousel.astro
 * spreads over the leading slide's `<Picture>`. Any divergence double-fetches
 * the poster.
 */

/** The exact `<Picture>` props Carousel.astro renders for the leading slide. */
export const leadingPosterPictureProps = {
  formats: ['avif', 'webp'],
  fallbackFormat: 'webp',
  layout: 'full-width',
  fit: 'cover',
  position: 'center',
} as {
  formats: ImageOutputFormat[];
  fallbackFormat: ImageOutputFormat;
  layout: 'full-width';
  fit: 'cover';
  position: 'center';
};

/** A `<link rel="preload" as="image">` payload for a responsive image. */
export type ImagePreload = {
  /** MIME type of the preloaded candidate set; browsers without support skip the hint. */
  type: string;
  srcset: string;
  sizes: string;
};

/**
 * Preload hint for the leading slide's AVIF candidate set. The `sizes` value is
 * the `100vw` the full-width layout hands the `<img>`, so source selection and
 * the preload resolve to the same candidate.
 */
export async function buildPosterPreload(slide: CarouselSlide): Promise<ImagePreload> {
  const { srcSet } = await getImage({
    src: slide.poster,
    format: 'avif',
    layout: leadingPosterPictureProps.layout,
    fit: leadingPosterPictureProps.fit,
    position: leadingPosterPictureProps.position,
  });

  return { type: 'image/avif', srcset: srcSet.attribute, sizes: '100vw' };
}
