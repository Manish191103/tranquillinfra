import type {
  WebSite,
  Organization,
  BlogPosting,
  BreadcrumbList,
  BusinessFunction,
  Certification,
  FAQPage,
  GatedResidenceCommunity,
  Graph,
  ItemList,
  ItemListOrderType,
  Place,
  PostalAddress,
  PropertyValue,
  RealEstateAgent,
  RealEstateListing,
  VideoObject,
  WebPage,
  WithContext,
} from 'schema-dts';
import projectConfig from '~/config/project.config';
import siteConfig from '~/config/site.config';
import { openingHoursSpecifications } from './opening-hours';

/**
 * The published office NAP as a PostalAddress. One object referenced by the
 * sitewide RealEstateAgent node, so the structured data and the printed footer
 * block cannot state different offices — search engines reconcile them by these
 * exact values.
 */
const officeAddress: PostalAddress | undefined = siteConfig.address
  ? {
      '@type': 'PostalAddress',
      streetAddress: siteConfig.address.street,
      addressLocality: siteConfig.address.city,
      addressRegion: siteConfig.address.state,
      postalCode: siteConfig.address.zip,
      addressCountry: siteConfig.address.country,
    }
  : undefined;

/**
 * Stable node id for the business entity. Every page that mentions the
 * developer — the sitewide agent node, the project listing's `publisher` and
 * `seller` — cross-references this one string, so a page can hold two views of
 * the entity without two definitions of it.
 */
const AGENT_ID = `${siteConfig.url}/#agent`;

/**
 * The structured-data logo as an absolute URL.
 *
 * `Organization.logo` and the article `publisher` node must be crawlable
 * absolute URLs, and the path itself is declared once in `site.config.ts`: a
 * renamed or moved file used to leave three markup sites pointing at a 404
 * instead of failing.
 */
const LOGO_URL = new URL(siteConfig.schemaLogo, siteConfig.url).toString();

/**
 * The transaction an Offer describes: a sale, not a lease or a rental. The
 * GoodRelations URL is the value the vocabulary requires, but schema-dts types
 * `businessFunction` as the `BusinessFunction` enumeration, which cannot carry
 * it — so the narrowing happens once here rather than at each use.
 */
const SELL = 'https://purl.org/goodrelations/v1#Sell' as unknown as BusinessFunction;

/** `125.42-250.84 sq.m (150-300 sq.yd)` → the metre range, for typed values. */
const PLOT_SIZE_RANGE = /^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*sq\.m/i;

/**
 * The numeric plot-size range out of the published display string, so the
 * structured data reads its numbers from the same string the copy is written
 * from. Throws on anything unreadable: `plotSizes` is approved config, and a
 * typo should fail the build rather than publish a wrong measurement.
 */
function plotSizeRangeSqM(plotSizes: string): { min: number; max: number } {
  const match = PLOT_SIZE_RANGE.exec(plotSizes);
  if (!match) {
    throw new Error(
      `Unreadable plot size range in "${plotSizes}" (expected e.g. "125.42-250.84 sq.m")`
    );
  }
  return { min: Number(match[1]), max: Number(match[2]) };
}

/**
 * The office on a map, as a *search* URL over the published office NAP — the
 * same form `GoogleMap.astro` falls back to when no API key is present.
 *
 * Deliberately not a pin. The registered office has no surveyed coordinate
 * anywhere in this repo, and the one published point is the layout pin 36 km
 * away in Miyapur; an address search resolves to the right building where a
 * fabricated pin would send a buyer to the wrong one.
 */
function officeMapUrl(): string | undefined {
  const office = siteConfig.office;
  if (!office) return undefined;
  const query = [office.street, office.locality, office.region, office.postalCode, office.country]
    .filter(Boolean)
    .join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * The statutory approval references as `identifier` entries, read from
 * `projectConfig.approvals` so a corrected number reaches the markup in the same
 * commit as the page copy rather than as a third hand-typed copy.
 *
 * `propertyID` is the short authority label the facts table itself uses, and
 * the value is the number exactly as published — a buyer types the pair into the
 * authority's own search box.
 */
function approvalIdentifiers(): PropertyValue[] {
  const { rera, hmda } = projectConfig.approvals;
  return [
    { '@type': 'PropertyValue', propertyID: 'RERA', value: rera.number },
    { '@type': 'PropertyValue', propertyID: 'HMDA', value: hmda.number },
  ];
}

/**
 * `Certification` with `certifiedBy`. schema.org declares the field ("the
 * certification agent") but schema-dts has not regenerated it, so it is
 * declared here rather than dropped: naming the authority that issued the
 * registration is the whole point of the node for a buyer checking a number.
 * Same pattern as `LayoutAddress` below.
 */
type RegistrationCertification = Certification & { certifiedBy?: Organization };

/**
 * The RERA registration as a certification, with the portal where the published
 * number can be checked independently.
 *
 * The HMDA number is a layout permission and stays an `identifier` — it is not
 * a registration, and calling it one would misdescribe it. The authority's name
 * is the one the site's own copy uses
 * (`src/content/blog/verify-plot-hyderabad.md`).
 */
function reraCertification(): RegistrationCertification {
  const { rera } = projectConfig.approvals;
  return {
    '@type': 'Certification',
    certifiedBy: {
      '@type': 'GovernmentOrganization',
      name: 'Telangana Real Estate Regulatory Authority',
    },
    identifier: rera.number,
    url: rera.verify,
  };
}

/**
 * What this listing is, in the one field a model reading only the graph reads
 * before it summarises the page. The wording follows the project's own copy
 * (`tranquill-city.md`, the opening paragraph and the "Can I build a house
 * immediately?" answer): an approved layout, no published completion date, and
 * renders rather than photographs. It is a disclosure, not marketing — the page
 * deliberately refuses a possession date, so the markup must not imply one.
 */
const LISTING_DISAMBIGUATION =
  'An approved layout of villa plots sold as plots rather than as completed homes. No possession, handover or development-completion date is published on this site, and the site imagery is renders of the planned layout rather than photographs of completed construction.';

/**
 * Create WebSite schema for homepage
 */
export function createWebsiteSchema(): WithContext<WebSite> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
  };
}

/**
 * The corridor this business sells into, as schema.org `areaServed` entries.
 * Keyed on the published administrative identity so copy, listing and entity
 * data cannot name three different places.
 */
function servedArea(): Place[] {
  const { village, mandal, district } = projectConfig.locality;
  return [
    { '@type': 'Place', name: `${village} village, ${mandal} mandal, ${district} district` },
    { '@type': 'Place', name: 'Patancheru' },
    { '@type': 'Place', name: 'Hyderabad' },
  ];
}

/**
 * Create RealEstateAgent schema — the site's local-business entity, and the one
 * node every page carries. The published office NAP, the opening hours in
 * schema.org syntax, the served corridor, the statutory registrations the
 * developer entity holds, and the map a visitor can open.
 *
 * It absorbs everything the unreachable `Organization` node used to carry
 * (`legalName`, `contactPoint`, `hasMap`, `areaServed`): `RealEstateAgent` is a
 * subtype of `Organization`, so a second node for the same company was two
 * definitions of one entity rather than extra information.
 *
 * Emitted sitewide by `SEO.astro`: a buyer searching Rudraram or Patancheru
 * must find the same agent on the homepage and the project page as on the
 * about and contact pages that carried it before.
 */
export function createRealEstateAgentSchema(): WithContext<RealEstateAgent> {
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    '@id': AGENT_ID,
    name: siteConfig.name,
    // The registered entity name and the short form the pages print. Without
    // these the same company is three different strings to an answer engine,
    // and the name a buyer's lawyer checks is the registered one.
    legalName: siteConfig.legalName,
    alternateName: siteConfig.alternateName,
    url: siteConfig.url,
    logo: LOGO_URL,
    // E.164, not the display string: `+91 95503 62288` is written for a human
    // reading a contact block and is neither a valid `telephone` value nor a
    // number a dialler can use.
    telephone: siteConfig.phoneE164,
    email: siteConfig.email,
    address: officeAddress,
    contactPoint: siteConfig.phoneE164
      ? {
          '@type': 'ContactPoint',
          telephone: siteConfig.phoneE164,
          // A plot is bought, not supported: this is a sales line, not the
          // "customer service" the old Organization node declared.
          contactType: 'sales',
          // ISO 3166-2 subdivision code for the published state, so a caller
          // outside Telangana can see where the number is answered. It is a
          // literal because `site.config.ts` publishes the state name, not a
          // code; a second state served would add it here.
          areaServed: 'IN-TG',
          // Only the language this site actually publishes. Telugu is a
          // reasonable expectation for a Hyderabad land developer, but nothing
          // on the site or in `site.config.ts` states the team answers in it,
          // and a language the business has not claimed is a service claim we
          // would be inventing. Add `'te'` when the business confirms it — and
          // put the list in `site.config.ts` rather than here, so the node, the
          // footer and any future translation switch share one value.
          availableLanguage: ['en'],
        }
      : undefined,
    openingHoursSpecification: siteConfig.openingHours
      ? openingHoursSpecifications(siteConfig.openingHours)
      : undefined,
    sameAs: siteConfig.socialLinks,
    areaServed: servedArea(),
    // The office, resolved by its published address rather than by a pin.
    hasMap: officeMapUrl(),
    // The registration and the layout permission are held by the developer
    // entity, so they belong on the entity as well as on the project.
    identifier: approvalIdentifiers(),
    // No `geo`, deliberately. The registered office has no surveyed coordinate
    // anywhere in this repo; this node used to pair the Miyapur office address
    // with `projectConfig.coordinates`, the Rudraram layout pin 36 km away,
    // which asserted one business in two places. Publishing no point is honest;
    // publishing an unrelated one is not. The surveyed layout coordinate
    // belongs on the project `Place` node, which declares it correctly, and
    // schema.org does not require `geo` on a RealEstateAgent.
  };
}

/**
 * The one name this site gives the company in structured data.
 *
 * The article's `author` and its `publisher` read it, so a post can never be
 * published under a different name from the company that published it — the
 * three-strings defect. `name` is the trading name the pages print, with the
 * registered name and the short byline beside it on the entity node below, so
 * an answer engine holding any of the three can match them.
 *
 * The content frontmatter still hardcodes `author: Tranquill Infra` on all six
 * posts. This constant deliberately ignores that value (the visible byline is
 * editorial; the structured data names the entity), but whoever next edits that
 * frontmatter should set `author` to `siteConfig.name` so the byline a reader
 * sees and the name in the graph are the same string.
 */
const COMPANY_NAME = siteConfig.name;

/** The company as the article `publisher` node. */
const COMPANY: Organization = {
  '@type': 'Organization',
  name: COMPANY_NAME,
  legalName: siteConfig.legalName,
  alternateName: siteConfig.alternateName,
  url: siteConfig.url,
  logo: {
    '@type': 'ImageObject',
    url: LOGO_URL,
  },
};

/**
 * Create BlogPosting schema for blog posts
 *
 * Emitted as a two-node graph: the `WebPage` at the post's own URL and the
 * article hanging off it as `<url>#article`. `mainEntityOfPage` has to point at
 * a node that exists, and a single-node object left that `@id` dangling —
 * nothing on the page defined it. Both nodes share the document URL because
 * the article *is* this page.
 *
 * `section` and `wordCount` come from the post itself; an article node that
 * declares neither is treated as an unclassified page by the article-rich
 * result surfaces the archive competes in.
 */
export function createBlogPostSchema(post: {
  title: string;
  description: string;
  url: string;
  image: string;
  datePublished: Date;
  dateModified?: Date;
  author: { name: string; url?: string };
  /** The collection the post is filed under, e.g. `Location` */
  section: string;
  /** Word count of the rendered article body */
  wordCount: number;
}): Graph {
  // The article is written in English and sold in India; the HTML lang and
  // the RSS feed carry the same signal.
  const IN_LANGUAGE = 'en-IN';

  const page: WebPage = {
    '@type': 'WebPage',
    '@id': post.url,
    url: post.url,
    name: post.title,
    description: post.description,
    inLanguage: IN_LANGUAGE,
  };

  const article: BlogPosting = {
    '@type': 'BlogPosting',
    '@id': `${post.url}#article`,
    headline: post.title,
    description: post.description,
    url: post.url,
    image: post.image,
    datePublished: post.datePublished.toISOString(),
    dateModified: post.dateModified?.toISOString() || post.datePublished.toISOString(),
    articleSection: post.section,
    wordCount: post.wordCount,
    inLanguage: IN_LANGUAGE,
    // The byline is the company (see content frontmatter `author`), so the
    // node is an Organization — a Person here would be a phantom author. The
    // name comes from `COMPANY_NAME`, shared with the publisher below, so the
    // byline and the publisher cannot disagree; see that constant for the
    // frontmatter alignment note.
    author: {
      '@type': 'Organization',
      name: COMPANY_NAME,
      url: post.author.url ?? `${siteConfig.url}/about-us/`,
    },
    publisher: COMPANY,
    mainEntityOfPage: { '@id': post.url },
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [page, article],
  };
}

/**
 * Create BreadcrumbList schema
 */
export function createBreadcrumbSchema(
  items: Array<{ name: string; url?: string }>
): WithContext<BreadcrumbList> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      // The last crumb is the current page: schema.org wants it without `item`,
      // which also avoids two levels pointing at one URL on the project page.
      ...(item.url ? { item: item.url } : {}),
    })),
  };
}

/**
 * Create FAQPage schema
 *
 * Kept for machine understanding, not for a rich result. Google restricted FAQ
 * rich results to authoritative government and health sites in August 2023 and
 * then withdrew the FAQ rich result for all publishers, so this markup buys
 * nothing in the SERP. It is still worth publishing: the answers on this site
 * are the disclosure a land buyer's lawyer asks for, and answer engines do
 * consume `mainEntity` question/answer pairs when they summarise a page.
 *
 * The policy constraint that comes with the type is the reason the answers read
 * the way they do: `FAQPage` must never be used for promotional copy. The
 * project and company answers are disclosure-first and must stay that way —
 * they answer "how do I verify this" and "what is not published", not "why you
 * should buy".
 */
export function createFAQSchema(
  faqs: Array<{ question: string; answer: string }>
): WithContext<FAQPage> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/** schema.org's own order values, so the literal appears once. */
const ITEM_LIST_ORDER = {
  ascending: 'https://schema.org/ItemListOrderAscending',
  descending: 'https://schema.org/ItemListOrderDescending',
  unordered: 'https://schema.org/ItemListUnordered',
} as const satisfies Record<string, ItemListOrderType>;

/**
 * The order the list is actually emitted in, read off the items rather than
 * asserted.
 *
 * The listing used to declare `ItemListOrderDescending` as a constant, and that
 * was false whenever the featured post led the rendered page. This reports what
 * it is handed, which after the sort below is the order the `itemListElement`
 * positions follow — so the declared order and the list cannot disagree. A list
 * with no dates to compare claims no order.
 */
function itemListOrderFor(items: Array<{ date?: Date }>): ItemListOrderType {
  const times: number[] = [];
  for (const item of items) {
    if (!item.date) return ITEM_LIST_ORDER.unordered;
    times.push(item.date.getTime());
  }
  if (times.length < 2) return ITEM_LIST_ORDER.unordered;
  const isDescending = times.every((time, index) => index === 0 || time <= times[index - 1]);
  if (isDescending) return ITEM_LIST_ORDER.descending;
  const isAscending = times.every((time, index) => index === 0 || time >= times[index - 1]);
  if (isAscending) return ITEM_LIST_ORDER.ascending;
  return ITEM_LIST_ORDER.unordered;
}

/**
 * Newest first, as a total order so the emitted list is deterministic.
 *
 * Undated items sink to the tail in their input order rather than being dropped
 * or floated. `itemListOrderFor` claims no order for a list it cannot date
 * anyway, so where an undated item lands changes nothing a consumer reads.
 */
function byNewestFirst(a: { date?: Date }, b: { date?: Date }): number {
  if (!a.date) return b.date ? 1 : 0;
  if (!b.date) return -1;
  return b.date.getTime() - a.date.getTime();
}

/**
 * ItemList for the Insights archive: every post in the page's window, emitted
 * in true date order (newest first), with 1-based positions as schema.org
 * requires.
 *
 * The page promotes its `featured` post to the top of the *rendered* list —
 * a full-width promo card for a post that is not the newest. That used to be
 * copied into the markup too, which put position 1 and position 5 in the
 * reverse of their dates and drove `itemListOrder` to `ItemListUnordered`,
 * throwing away a signal the collection genuinely has. The schema describes the
 * collection and the template describes the layout, so the sort happens here
 * and the featured card is a presentation choice the markup does not inherit.
 *
 * Sorting rather than dropping the order claim is the point: a list of articles
 * ordered newest-first is a real ranking signal to a consumer reading only the
 * graph, and an honest `Unordered` says nothing at all.
 */
export function createItemListSchema(
  items: Array<{ name: string; url: string; date?: Date }>,
  name: string
): WithContext<ItemList> {
  const ordered = [...items].sort(byNewestFirst);
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: ordered.length,
    itemListOrder: itemListOrderFor(ordered),
    itemListElement: ordered.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

/**
 * `PostalAddress` with `addressDistrict`. schema.org added the district level
 * to the postal address vocabulary after schema-dts last regenerated its
 * types, so the field is declared here rather than dropped: the district is
 * part of this project's published identity, and a buyer searching "Sangareddy"
 * is a buyer this page should answer.
 */
type LayoutAddress = PostalAddress & { addressDistrict?: string };

/**
 * Project listing graph for a marketed project page: the RealEstateListing,
 * the Offer it is sold under, the Place it sits on and the listing agent,
 * cross-referenced by `@id` so the nodes entity-match without string
 * comparison.
 *
 * The entry price is published (`projectConfig.price`), so the listing carries
 * a real `Offer` — an unsaleable-by-omission listing ranks for the informational
 * queries a buyer types and converts none of the commercial ones. The published
 * statics (price, availability, locality, coordinates, plot sizes, site area,
 * approvals) are read from `projectConfig`, never restated here.
 */
export function createProjectSchema(project: {
  name: string;
  description: string;
  url: string;
  /** Advertised amenity names, as published in the content entry */
  amenities: string[];
  /** Total site area, as published in the project's facts table */
  siteArea: { sqM: number; acre: number };
  /** First publication of the listing, not the last copy review */
  datePosted?: Date;
  /** Last review of the copy this listing describes */
  dateModified?: Date;
}): Graph {
  const listingId = `${project.url}#listing`;
  const placeId = `${project.url}#place`;
  const { village, mandal, district } = projectConfig.locality;
  const { price, availability } = projectConfig;
  // The area arrives from the page rather than being read here, so the graph
  // describes the entry the page rendered; every other published static is
  // config and is read at the point of use.
  const { siteArea } = project;

  const place: GatedResidenceCommunity = {
    // A gated community, which is how the page describes it in every section.
    // `GatedResidenceCommunity` ⊑ `Residence` ⊑ `Place`, so it is a more
    // specific `Place` and nothing else on the node has to change. It is not a
    // `SingleFamilyResidence` (a built house) and not an `Accommodation`
    // (lodging) — this is land sold as plots.
    '@type': 'GatedResidenceCommunity',
    '@id': placeId,
    name: project.name,
    description: project.description,
    url: project.url,
    // The one surveyed point this site publishes, and the only place it is
    // declared: the layout, not the office.
    geo: {
      '@type': 'GeoCoordinates',
      latitude: projectConfig.coordinates.latitude,
      longitude: projectConfig.coordinates.longitude,
    },
    address: <LayoutAddress>{
      '@type': 'PostalAddress',
      // No street address for the layout is published anywhere in this repo,
      // so the node carries the administrative levels a local query actually
      // names — village, mandal, district — rather than a fabricated street.
      addressLocality: village,
      addressDistrict: district,
      // `project.config.ts` publishes the project only as far as the district,
      // so the state and country come from the registered office. They are read
      // rather than typed so a project outside Telangana cannot inherit
      // Telangana from a string literal — though publishing one then needs the
      // state added to `project.config.ts` first.
      addressRegion: siteConfig.office?.region,
      addressCountry: siteConfig.office?.country,
    },
    // schema.org has no "registered with" field on a Place, and the RERA number
    // is the project's registration, so the portal that holds it is named here.
    additionalType: projectConfig.approvals.rera.verify,
    // The numbers a buyer's lawyer asks for first, machine-readable at last.
    identifier: approvalIdentifiers(),
    hasCertification: reraCertification(),
    // schema.org has no field for a revenue village's mandal, and the layout's
    // identity is exactly that three-level chain, so it is stated explicitly
    // alongside the postal levels a local query might name.
    additionalProperty: [
      {
        '@type': 'PropertyValue',
        name: 'Revenue village',
        value: `${village} village, ${mandal} mandal, ${district} district`,
      },
      // Plots of land carry no room semantics, so the advertised size range
      // goes on the Place as a typed measurement rather than a floorSize. The
      // numbers are read out of the one published size string, so they cannot
      // drift from the copy the buyer reads.
      {
        '@type': 'PropertyValue',
        name: 'Plot size range',
        value: projectConfig.plotSizes,
        minValue: plotSizeRangeSqM(projectConfig.plotSizes).min,
        maxValue: plotSizeRangeSqM(projectConfig.plotSizes).max,
        unitCode: 'MTK',
        unitText: 'square metre',
      },
      // The whole layout, not a plot: one area, so the typed range collapses to
      // the same figure on both ends. The acre value is in the string because
      // that is the unit the page's facts table leads with.
      {
        '@type': 'PropertyValue',
        name: 'Total site area',
        value: `${siteArea.sqM.toLocaleString('en-IN')} sq.m (${siteArea.acre} acre)`,
        minValue: siteArea.sqM,
        maxValue: siteArea.sqM,
        unitCode: 'MTK',
        unitText: 'square metre',
      },
      {
        '@type': 'PropertyValue',
        name: 'Saleable plots',
        value: `${availability.saleable} saleable of ${availability.total}`,
        description: `${availability.mortgageHeld} parcels are held against HMDA Mortgage conditions and are not for sale.`,
      },
      // What the site will not publish, stated as structured data so a summary
      // of the graph cannot quietly imply otherwise: the stage is an approved
      // layout, and the imagery is renders. Wording follows the project copy
      // (`tranquill-city.md`, the opening paragraph and the build-today answer).
      {
        '@type': 'PropertyValue',
        name: 'Current development stage',
        value:
          'Approved layout. No possession, handover or development-completion date is published on this site.',
        description:
          'What this project has published today is an approved layout — HMDA layout permission and RERA registration, with the planned internal roads, parks and services shown on the reference plan. The gallery images are renders of the planned layout rather than photographs of completed construction. Ask the team to confirm the current site stage, the work completed and the handover position in writing before you commit.',
      },
    ],
    // The advertised features, so the listing describes the product a buyer is
    // actually comparing rather than an empty shell.
    //
    // The value is a sentence, not `true`. The page hedges every one of these —
    // "Confirm the latest scope and availability" — and a boolean reads as a
    // flat claim that a 24/7 security detail, a drainage network and a jogging
    // track exist as built, which is the one thing this markup must not do. A
    // model summarising the graph will quote whatever is here.
    amenityFeature: project.amenities.map((name) => ({
      '@type': 'LocationFeatureSpecification' as const,
      name,
      value:
        'Advertised scope for a planned layout. Confirm the latest scope and availability with the team.',
    })),
  };

  const listing: RealEstateListing = {
    '@type': 'RealEstateListing',
    '@id': listingId,
    name: project.name,
    description: project.description,
    disambiguatingDescription: LISTING_DISAMBIGUATION,
    url: project.url,
    // When the listing first appeared, not when its copy was last reviewed: a
    // wording fix must not re-date the listing and make a five-year-old
    // project look new.
    datePosted: project.datePosted?.toISOString(),
    dateModified: project.dateModified?.toISOString() ?? project.datePosted?.toISOString(),
    about: { '@id': placeId },
    contentLocation: { '@id': placeId },
    // The published developer behind the listing (emitted sitewide as
    // RealEstateAgent).
    publisher: { '@id': AGENT_ID },
    offers: {
      '@type': 'Offer',
      price: price.from,
      priceCurrency: 'INR',
      // Without this the price reads as a rate: an extractor quotes ₹48 lakh
      // "per square metre" for land that is priced per plot, which is the one
      // number on this page a buyer must not misread.
      eligibleQuantity: {
        '@type': 'QuantitativeValue',
        value: 1,
        unitText: 'plot',
      },
      // The saleable count is a real bound, but scarcity framing is not a fact
      // and RERA norms discourage it in plotted sales. `InStock` says the same
      // thing about availability without the pressure.
      availability: 'https://schema.org/InStock',
      businessFunction: SELL,
      priceSpecification: {
        '@type': 'PriceSpecification',
        price: price.from,
        priceCurrency: 'INR',
      },
      inventoryLevel: {
        '@type': 'QuantitativeValue',
        value: availability.saleable,
        unitText: `plots saleable of ${availability.total}`,
      },
      seller: { '@id': AGENT_ID },
    },
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [listing, place],
  };
}

/** ISO-8601 duration from a `m:ss` / `mm:ss` runtime label. */
function isoDuration(clock: string): string | undefined {
  const match = clock.trim().match(/^(\d+):(\d{2})$/);
  if (!match) return undefined;
  const [, minutes, seconds] = match;
  return `PT${Number(minutes)}M${Number(seconds)}S`;
}

/**
 * VideoObject for a clip rendered on the page — the buyer testimonial videos.
 * `contentUrl`/`thumbnailUrl` must be absolute.
 *
 * There is deliberately no `embedUrl`. schema.org wants a player URL there, and
 * these are self-hosted `.mp4` files: pointing `embedUrl` at the file claims a
 * player the site does not have, and Google requires a real embed target. Add
 * it only alongside an actual player surface.
 *
 * `uploadDate` is omitted rather than guessed. A clip's real date is the day the
 * signed release was filed, and without that record the field is not knowable —
 * an `updatedAt` fallback silently re-dated every clip on the page whenever the
 * project copy was edited.
 */
export function createVideoSchema(video: {
  name: string;
  description: string;
  contentUrl: string;
  thumbnailUrl: string;
  uploadDate?: Date;
  durationClock?: string;
}): WithContext<VideoObject> {
  const duration = video.durationClock ? isoDuration(video.durationClock) : undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.name,
    description: video.description,
    contentUrl: video.contentUrl,
    thumbnailUrl: video.thumbnailUrl,
    uploadDate: video.uploadDate?.toISOString(),
    duration,
  };
}
