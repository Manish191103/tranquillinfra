/**
 * Published project facts.
 *
 * The homepage proof belt and the project copy read their values from here so
 * the published numbers live in one place. Update with approved values only —
 * these are statutory references and advertised plot dimensions.
 */
interface ProjectConfig {
  /** Public project name */
  name: string;
  /** Short location line */
  location: string;
  /**
   * Advertised plot dimensions.
   *
   * En-dashes, not hyphens: this string is copied verbatim into the header's
   * announcement bar, five fact tables, the structured data and the LLM
   * reference, and the rest of the site's copy sets numeric ranges with an
   * en-dash. `plotSizeRangeSqM` in src/lib/schema.ts parses either.
   */
  plotSizes: string;
  /** Total plots as advertised publicly (saleable and mortgage parcels together) */
  totalPlots: string;
  /** Project type as published */
  projectType: string;
  /**
   * Advertised price. Plot pricing is per plot, not per unit area, so only the
   * entry price is published: a buyer self-selects a plot from the size bands
   * below and asks for that plot's price. Keep the two in step — the entry
   * price must belong to the smallest saleable band.
   */
  price: {
    /** Entry price per plot, in rupees (₹48 lakh). */
    from: number;
    /** Rendered entry price, e.g. `From ₹48 lakh per plot`. */
    display: string;
  };
  /**
   * Plot availability. `total` is every parcel in the layout; the HMDA Mortgage
   * parcels are held against HMDA conditions and are not saleable, so the
   * saleable count is what a buyer is actually shopping.
   */
  availability: {
    /** Every parcel in the layout. */
    total: number;
    /** Parcels held against HMDA Mortgage conditions and not for sale. */
    mortgageHeld: number;
    /** `total - mortgageHeld`; the number of plots a buyer can buy. */
    saleable: number;
  };
  /**
   * Administrative identity of the layout. Local search and listing surfaces key
   * on the registered name, so copy, schema and the map pin must agree.
   */
  locality: {
    village: string;
    mandal: string;
    district: string;
  };
  /** Map pin for the layout. */
  coordinates: { latitude: number; longitude: number };
  /**
   * Total site area as published. Typed rather than free text so the structured
   * data and any rate-per-area figure can read a number instead of parsing a
   * sentence: it is the denominator for a price-per-area sanity check, and
   * `availability.saleable` is the numerator. Keep it in step with the `Layout`
   * row of the published facts table, which carries the same figure in
   * `src/content/projects/tranquill-city.md`.
   */
  siteArea: {
    /** 19,410 sq.m. */
    sqM: number;
    /** 4.8 acre. */
    acre: number;
  };
  /**
   * Statutory approval references, each with the official portal where the
   * published number can be checked. The site tells visitors to verify these
   * numbers; keep the links working for exactly that purpose.
   *
   * Per-number deep links were wanted and are not known: neither authority
   * publishes a stable public permalink for a single layout permission or
   * registration, so `verify` points at the search surface that accepts the
   * number and `note` says what the visitor should look for. If the business
   * supplies working per-number URLs, put them here — do not construct one by
   * pattern, a guessed query string is a dead link in a trust claim.
   */
  approvals: {
    rera: {
      number: string;
      /** The authority's portal. Whether it resolves `number` is UNVERIFIED. */
      verify: string;
      /** What the site tells a visitor to do about `number` */
      note: string;
    };
    hmda: {
      number: string;
      /** The authority's own search surface for a layout permission number */
      verify: string;
      /** What to do on that page to check `number` */
      note: string;
    };
  };
}

export const projectConfig: ProjectConfig = {
  name: 'Tranquill City',
  location: 'Mamidipally, near Rudraram and Patancheru, Hyderabad',
  plotSizes: '125.42–250.84 sq.m (150–300 sq.yd)',
  totalPlots: '82',
  projectType: 'Premium villa plots',
  price: {
    from: 4800000,
    display: 'From ₹48 lakh per plot',
  },
  /**
   * 2026-10-14, client-confirmed: 12 parcels are held under HMDA Mortgage
   * conditions. The draft scrutiny plan corroborates the scale: plots 1-4
   * are the fee-installment mortgage (1,980.29 sq.m, 15.29%), and the plan
   * proposes two further NALA-conversion mortgage tranches — 762.19 (5.89%)
   * and 671.11 (5.18%) sq.m — which together point at roughly twelve held
   * parcels. The client confirmed the count; the exact held plot numbers
   * were not supplied, so no copy names plot numbers for the held parcels.
   * If the final approval letter's mortgage schedule differs, update this
   * and the count copy in one pass.
   */
  availability: {
    total: 82,
    mortgageHeld: 12,
    saleable: 70,
  },
  /**
   * The client-supplied HMDA scrutiny plan (Application ID
   * 00a9b2f5-0e54-4e39-a161-cda1b32dd702, report generated 2026-02-10) for
   * the draft residential open plotted layout in Sy. No. 411/PART names this
   * exact layout — its plot table matches parcel-for-parcel: 82 numbered
   * plots, 125.42 sq.m standard plots, 19,410 sq.m net layout area and the
   * 1,980.29 sq.m fee-installment mortgage on plots 1-4 — and it situates
   * the layout in Mamidipally village, Kandi mandal, Sangareddy district.
   * The plan's location-plan surroundings (Ismailkhanpet, "To Kandi",
   * Aparna Enterprises) corroborate the Kandi side, and the published pin
   * reverse-geocodes into Kandi mandal.
   *
   * `village` and `mandal` were corrected from 'Rudraram'/'Patancheru' on
   * 2026-10-14 on that document's authority. 'Rudraram' remains a marketing
   * anchor — the layout sits roughly 3 km from Rudraram village — but it is
   * not the revenue identity. Match the final approval letter if it ever
   * differs from the scrutiny plan.
   */
  locality: {
    village: 'Mamidipally',
    mandal: 'Kandi',
    district: 'Sangareddy',
  },
  coordinates: { latitude: 17.585611, longitude: 78.148361 },
  siteArea: { sqM: 19410, acre: 4.8 },
  approvals: {
    /**
     * 2026-10-14: the client's final Tranquill City brochure prints both
     * numbers on its cover (RERA REA01100108192, HMDA 2103/HMDA/SWDL/2026)
     * and the HMDA number on its layout plan — the business stands behind
     * them in print. The portal-resolution caveats below are unchanged;
     * the certificate remains the closing item for the RERA escalation.
     * ===================================================================
     * UNRESOLVED — ESCALATE BEFORE PUBLISHING ANY "VERIFY IT YOURSELF" COPY
     * ===================================================================
     *
     * On 2026-09-30 the RERA registration below was checked against the Telangana
     * RERA portal's own exact-match project search and returned **no record**,
     * with working positive controls proving the search itself functioned and
     * being current into mid-2026. Two further problems surfaced:
     *
     *   1. The `REA` prefix is a real Telangana RERA prefix. An earlier note
     *      here claimed it was not, on the grounds that every corroborated
     *      identifier began `P` or `A`; that was wrong. The Authority's own
     *      defaulters list publishes live REA-prefixed project registration
     *      numbers — REA02200025418 and REA02400083841 — read 2026-10-01. What
     *      remains unverified is whether *this* number resolves to a
     *      registered project, which is a different question from whether the
     *      prefix is well formed.
     *   1b. The public search at rerait.telangana.gov.in is captcha-gated and
     *      has no permalink resolving a single number, so "it did not resolve"
     *      on 2026-09-30 is weaker evidence than it looks: a query can fail at
     *      the captcha without any record being absent. The honest statement is
     *      that it could not be confirmed from the public search.
     *   2. A *different*, genuinely registered plotted development called
     *      "TRANQUIL CITY" exists in Ranga Reddy under another promoter
     *      (Samyuktha Developers). Anyone searching that project name lands on
     *      the wrong developer entirely.
     *
     * The number is left published because the business may hold a valid record
     * this check could not reach, and removing a published legal fact is not an
     * engineering decision. What has changed is the *instruction*: the site no
     * longer tells a visitor to search the portal expecting to find it, because
     * a buyer who does and finds nothing is left worse off than one who was
     * never sent there. The `note` now routes them to the team for the record.
     *
     * TO CLOSE THIS: obtain the registration certificate or the portal record
     * and correct `number` here, or withdraw it. Do not restore "search the
     * portal" copy until the number has been seen to resolve.
     * ===================================================================
     */
    rera: {
      number: 'REA01100108192',
      verify: 'https://rera.telangana.gov.in/',
      note: 'Ask the team for the registration record for this project, and check the number on it against the one published here.',
    },
    hmda: {
      number: '2103/HMDA/SWDL/2026',
      /**
       * The HMDA master plan portal's Layout Permission Report, which accepts
       * the year, file number, district, mandal and village of a layout
       * permission and returns the proceedings and the sanctioned plan. This
       * replaces the general HMDA FAQ page, which cannot resolve a permission
       * number at all.
       *
       * Also unverified, for the same reason: the Report's published dataset
       * stops at 2023, the token `SWDL` appears nowhere in it, and the search
       * form returned "No Records Found" for known-good input too — so the form
       * could not be exercised. The file-number format used here also does not
       * match the patterns in that dataset (`NNNNN/LO/PLG/HMDA/YYYY` and
       * friends). Same escalation applies: confirm against the approval letter.
       */
      verify: 'https://masterplan.hmda.gov.in/planning/LO.aspx',
      note: 'In the Layout Permission Report, search by year 2026 and by this file number, and match the village, mandal and district. If the record does not appear, ask the team for the sanction letter.',
    },
  },
};

export default projectConfig;

/**
 * A published fact row. The proof belt, the project stats belt and the facts
 * sections all render this shape.
 */
interface ProjectFactRow {
  label: string;
  value: string;
  href?: string;
}

const rera: ProjectFactRow = {
  label: 'RERA',
  value: projectConfig.approvals.rera.number,
  href: projectConfig.approvals.rera.verify,
};

const hmda: ProjectFactRow = {
  label: 'HMDA',
  value: projectConfig.approvals.hmda.number,
  href: projectConfig.approvals.hmda.verify,
};

/** The homepage proof belt: the figures a buyer checks first. */
export function projectProofPoints(): ProjectFactRow[] {
  return [
    { label: 'Plot sizes', value: projectConfig.plotSizes },
    { label: 'Plots available', value: `${projectConfig.availability.saleable} of ${projectConfig.availability.total}` },
    { label: 'Entry price', value: projectConfig.price.display },
    { label: 'Project type', value: projectConfig.projectType },
  ];
}

/** The project page stats belt: size range, count, and the approval references. */
export function projectStats(): ProjectFactRow[] {
  return [
    { label: 'Plot sizes', value: projectConfig.plotSizes },
    { label: 'Total plots', value: projectConfig.totalPlots },
    rera,
    hmda,
  ];
}

/**
 * The full published-facts table. The editorial rows (layout, price,
 * verification) arrive from the content entry so the values live where they are
 * reviewed; the statutory rows come from here.
 */
/**
 * The identity table the About page publishes: who is building it, what and
 * where it is, and the statutory references. `developer` arrives from
 * `site.config.ts` (the legal entity name).
 */
export function projectIdentityFacts(developer: string): ProjectFactRow[] {
  return [
    { label: 'Developer', value: developer },
    { label: 'Project', value: projectConfig.name },
    { label: 'Location', value: projectConfig.location },
    { label: 'Project type', value: projectConfig.projectType },
    { label: 'Plot sizes', value: projectConfig.plotSizes },
    { label: 'Total plots', value: projectConfig.totalPlots },
  ];
}

export function projectFacts(editorial: {
  location: string;
  layout: string;
  verificationNote: string;
}): ProjectFactRow[] {
  return [
    { label: 'Location', value: editorial.location },
    { label: 'Project type', value: projectConfig.projectType },
    { label: 'Plot sizes', value: projectConfig.plotSizes },
    { label: 'Layout', value: editorial.layout },
    { label: 'Price', value: projectConfig.price.display },
    { label: 'RERA', value: projectConfig.approvals.rera.number },
    { label: 'HMDA', value: projectConfig.approvals.hmda.number },
    { label: 'Verification', value: editorial.verificationNote },
  ];
}
