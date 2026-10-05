/**
 * Shared metadata types.
 *
 * Everything the site's own components need is declared next to the
 * component; this module survives only because the vendored config builder
 * (`vendor/integration/utils/configBuilder.ts`) types its `metadata` shape
 * against it, and `src/config.yaml` is validated through that shape at build
 * time.
 */
import type { HTMLAttributes } from 'astro/types';

export interface MetaData {
  title?: string;
  ignoreTitleTemplate?: boolean;

  canonical?: string;

  robots?: MetaDataRobots;

  description?: string;

  openGraph?: MetaDataOpenGraph;
  twitter?: MetaDataTwitter;
}

export interface MetaDataRobots {
  index?: boolean;
  follow?: boolean;
}

export interface MetaDataImage {
  url: string;
  width?: number;
  height?: number;
}

export interface MetaDataOpenGraph {
  url?: string;
  siteName?: string;
  images?: Array<MetaDataImage>;
  locale?: string;
  type?: string;
  /** Open Graph `article:*` properties, used when `type` is `article`. */
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    expirationTime?: string;
    authors?: Array<string>;
    section?: string;
    tags?: Array<string>;
  };
}

export interface MetaDataTwitter {
  handle?: string;
  site?: string;
  cardType?: string;
}

/** `HTMLAttributes` re-export kept for any ambient augmentation. */
export type { HTMLAttributes };
