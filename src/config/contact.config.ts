/**
 * Contact-us page copy and place descriptors.
 *
 * The enquiry-steps copy and the two places a visitor may need to reach. The
 * place lines come from `site.config.ts` (the published NAP) and
 * `project.config.ts`, so no address is retyped here.
 */
import siteConfig from './site.config';
import projectConfig from './project.config';

/**
 * The day this page's copy was last reviewed, as an ISO `YYYY-MM-DD` string.
 *
 * It lives here rather than in `astro.config.mjs` because the sitemap reads it
 * as the `/contact-us/` `lastmod`, and a date is only true of the copy it sits
 * next to. Bump it in the same commit as any edit to the steps, the places, the
 * hours or the NAP below and the sitemap follows; a date typed into the config
 * would keep answering the same question while the page moved on underneath it,
 * which is worse than having no date at all.
 */
export const reviewedAt = '2026-09-30';

interface EnquiryStep {
  title: string;
  body: string;
}

/** What the team does with an enquiry — all of it already promised on this page. */
export const enquirySteps: EnquiryStep[] = [
  {
    title: 'We reply during business hours',
    body: 'Calls and messages are answered Monday and Wednesday to Sunday, 9:00 AM to 6:00 PM.',
  },
  {
    title: 'You get the details you asked for',
    body: 'Current availability, pricing and the documents for the plot you are comparing.',
  },
  {
    title: 'You choose the next step',
    body: 'A site visit, another call with your questions, or time to verify with your own adviser.',
  },
];

interface ContactPlace {
  id: string;
  title: string;
  lines: string[];
  mapQuery: string;
  mapLabel: string;
  directionsUrl: string;
  directionsLabel: string;
}

function directionsTo(query: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}

/** Map query for the office: the registered address, else the published lines. */
function officeMapQuery(): string {
  const address = siteConfig.address;
  return address
    ? [address.street, address.city, address.state, address.zip, address.country]
        .filter(Boolean)
        .join(', ')
    : (siteConfig.office?.lines.join(', ') ?? siteConfig.name);
}

/**
 * The two places a visitor may need to reach. The office keeps the registered
 * address; the project site is found by its published name and location, so no
 * coordinate is retyped here.
 */
export function contactPlaces(): ContactPlace[] {
  const officeLines = siteConfig.office?.lines ?? [];
  const projectLines = siteConfig.project?.lines ?? [];
  const addressQuery = officeMapQuery();
  const projectQuery = `${projectConfig.name}, ${projectConfig.location}`;

  const places: ContactPlace[] = [
    {
      id: 'office',
      title: 'Office · Miyapur, Hyderabad',
      lines: officeLines,
      mapQuery: addressQuery,
      mapLabel: 'Map showing the Tranquill Infra office in Nandini Nagar, Miyapur, Hyderabad',
      directionsUrl: directionsTo(addressQuery),
      directionsLabel: 'Directions to the office',
    },
    {
      id: 'project-site',
      title: 'Project site · Rudraram, near Patancheru',
      lines: projectLines,
      mapQuery: projectQuery,
      mapLabel:
        'Map showing the Tranquill City project site at Rudraram, near Patancheru, Hyderabad',
      directionsUrl: directionsTo(projectQuery),
      directionsLabel: 'Directions to the project site',
    },
  ];

  return places.filter((place) => place.lines.length > 0);
}
