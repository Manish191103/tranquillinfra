/**
 * Project highlights — the brochure, set as data.
 *
 * Every figure here is read from one of the two client documents and cross-
 * checked against the other:
 *
 *   - "Tranquill City Brochure final.pdf" (8 pages, client-supplied 2026-10)
 *   - "Drawing - Mamidipally Scrutiny Plan.pdf" — the HMDA draft layout
 *     scrutiny report for Sy. No. 411/PART, Mamidipally village, Kandi
 *     mandal, Sangareddy district (Application ID
 *     00a9b2f5-0e54-4e39-a161-cda1b32dd702, generated 2026-02-10)
 *
 * Where the two disagree the scrutiny plan wins, because it is the statutory
 * drawing: the brochure's "5 Acre" tile is printed here as the plan's
 * 19,410 sq.m (4.8 acre). The brochure's return and appreciation lines
 * ("Land value grows", "1 lakh+ employees", "Long-term value creations") have
 * no source and stay out, for the reasons recorded in docs/claims-register.md.
 * Drive-time phrasing ("Smooth drive to …") is restated as route language.
 */
import projectConfig from './project.config';

export interface HighlightFigure {
  value: string;
  unit?: string;
  label: string;
  detail: string;
}

export interface LandUseShare {
  label: string;
  sqM: number;
  percent: number;
  /** CSS colour for the bar segment and its key swatch */
  tone: string;
}

export interface LayoutFeature {
  name: string;
  detail: string;
  icon: string;
}

export interface ConnectivityItem {
  label: string;
  /** Internal guide that covers the landmark — the SEO link for the item */
  href?: string;
  /** Straight-line distance from the site pin (same figures as the project entry) */
  distanceKm?: number;
  /** Drive time in minutes; when set, `distanceKm` is the road distance */
  driveMin?: number;
  /** Icon name from the shared Icon set */
  icon: string;
}

export interface ConnectivityGroup {
  /** Map category: the location map lights up the pins and roads tagged with it */
  id: 'roads' | 'work' | 'learn';
  title: string;
  icon: string;
  items: ConnectivityItem[];
}

const CORRIDOR_GUIDE = '/blog/rudraram-patancheru-corridor/';

/** Headline figures for the at-a-glance grid. */
export const highlightFigures: HighlightFigure[] = [
  {
    value: String(projectConfig.siteArea.acre),
    unit: 'acres',
    label: 'Layout area',
    detail: '19,410 sq.m net layout area on the HMDA scrutiny plan',
  },
  {
    value: String(projectConfig.availability.total),
    unit: 'plots',
    label: 'Numbered parcels',
    detail: `${projectConfig.availability.saleable} saleable, ${projectConfig.availability.mortgageHeld} held under HMDA Mortgage`,
  },
  {
    value: '150–300',
    unit: 'sq.yd',
    label: 'Plot sizes',
    detail: '125.42–250.84 sq.m villa plots',
  },
  {
    value: "40' & 33'",
    label: 'CC internal roads',
    detail: '40 ft and 33 ft wide cement-concrete roads',
  },
  {
    value: '2',
    unit: 'parks',
    label: 'Open space',
    detail: '1,040.50 sq.yd and 762.49 sq.yd park areas',
  },
  {
    value: '588.54',
    unit: 'sq.yd',
    label: 'Social infrastructure',
    detail: 'Reserved social-infrastructure area inside the layout',
  },
];

/**
 * The scrutiny plan's area statement (sq.m, % of the 19,410 sq.m net layout).
 * Percentages are the plan's own, not recomputed.
 */
export const landUse: LandUseShare[] = [
  { label: 'Plotted area', sqM: 12947.33, percent: 66.7, tone: 'var(--color-primary)' },
  { label: 'Roads', sqM: 4122.35, percent: 21.24, tone: 'var(--color-accent)' },
  { label: 'Parks / open space', sqM: 1507.49, percent: 7.77, tone: '#5f9a5b' },
  { label: 'Social infrastructure', sqM: 492.08, percent: 2.54, tone: '#8fb3a0' },
  { label: 'Buffer', sqM: 214.78, percent: 1.11, tone: '#c9b79a' },
  { label: 'Utility', sqM: 125.94, percent: 0.65, tone: '#9a8f80' },
];

/** The brochure's "Layout Features" page, tile for tile, in its order. */
export const layoutFeatures: LayoutFeature[] = [
  {
    name: '4.8-acre semi-gated community',
    detail: '19,410 sq.m layout behind a compound wall',
    icon: 'fence',
  },
  {
    name: 'Premium modern villa plots',
    detail: '150–300 sq.yd plots for independent homes',
    icon: 'layout',
  },
  { name: 'Elegant entrance arch', detail: 'A landmark arrival at the gate', icon: 'door-open' },
  { name: "40' & 33' CC roads", detail: 'Cement-concrete internal roads', icon: 'route' },
  {
    name: 'Compound wall with 24/7 security',
    detail: 'Boundary wall and round-the-clock security',
    icon: 'shield-check',
  },
  { name: 'Underground drainage', detail: 'Concealed drainage network', icon: 'waves' },
  {
    name: 'Water connection',
    detail: 'Water connection points across the layout',
    icon: 'droplets',
  },
  { name: 'Avenue plantation', detail: 'Tree-lined internal avenues', icon: 'trees' },
  { name: "Children's play area", detail: 'A dedicated play zone', icon: 'baby' },
  {
    name: 'Jogging track & sit-out',
    detail: 'Cycle and jogging track with seating',
    icon: 'footprints',
  },
];

/** Brochure page 2: the corridor the city has already grown along, and the next one. */
export const corridor = {
  established: ['Kukatpally', 'Nizampet', 'Miyapur'],
  next: ['Patancheru', 'Rudraram', 'Sangareddy'],
};

/** Brochure page 3, "A connected future", with each landmark linked to the guide that covers it. */
export const connectivity: ConnectivityGroup[] = [
  {
    id: 'roads',
    title: 'Excellent connectivity',
    icon: 'route',
    items: [
      { label: 'Close to Mumbai Highway (NH-65)', href: CORRIDOR_GUIDE, icon: 'road' },
      { label: 'Easy access to the Outer Ring Road (ORR)', href: CORRIDOR_GUIDE, icon: 'route' },
      { label: 'Route to Miyapur & Lingampally', href: CORRIDOR_GUIDE, icon: 'train' },
      {
        label: 'Connectivity to Gachibowli & Financial District',
        href: CORRIDOR_GUIDE,
        icon: 'skyscraper',
      },
      {
        label: 'Near the proposed Regional Ring Road (RRR)',
        href: CORRIDOR_GUIDE,
        icon: 'map',
      },
    ],
  },
  {
    id: 'work',
    title: 'Employment & industrial hubs',
    icon: 'layers',
    items: [
      { label: 'BHEL Township, Ramachandrapuram', href: CORRIDOR_GUIDE, icon: 'factory' },
      {
        label: 'ICRISAT, Patancheru Industrial Area & BDL Township',
        href: CORRIDOR_GUIDE,
        distanceKm: 16,
        icon: 'plant',
      },
      { label: 'Toshiba Transmission & Distribution', href: CORRIDOR_GUIDE, icon: 'zap' },
      { label: 'Isnapur & Kazipally industrial zones', href: CORRIDOR_GUIDE, icon: 'factory' },
      { label: 'Pashamylaram Industrial Estate', href: CORRIDOR_GUIDE, icon: 'briefcase' },
    ],
  },
  {
    id: 'learn',
    title: 'Education & social infrastructure',
    icon: 'book',
    items: [
      {
        label: 'IIT Hyderabad, Kandi',
        href: CORRIDOR_GUIDE,
        distanceKm: 6.3,
        driveMin: 12,
        icon: 'school',
      },
      {
        label: 'Engineering, medical & degree colleges belt',
        href: CORRIDOR_GUIDE,
        icon: 'certificate',
      },
      {
        label: 'GITAM University, Rudraram',
        href: CORRIDOR_GUIDE,
        distanceKm: 4.5,
        icon: 'school',
      },
      { label: 'International & CBSE schools around Ameenpur & Beeramguda', icon: 'building-bank' },
      { label: 'Super-specialty hospitals in Patancheru & Sangareddy', icon: 'hospital' },
    ],
  },
];

/** Road frontage as drawn on the scrutiny plan and the brochure layout page. */
export const roadFrontage = [
  'Existing 18 m road along the east boundary',
  'Proposed 90 m RRR alignment beyond it',
  "Existing 40' road along the north boundary",
];
