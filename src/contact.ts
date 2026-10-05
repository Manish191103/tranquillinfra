/**
 * Contact and approval facts for the site chrome.
 *
 * The one place the phone number, the WhatsApp deep link, the NAP lines and
 * the statutory approval numbers live. The header, footer, mobile contact
 * bar, announcement bar, enquiry dialog and structured data all read these —
 * a value typed anywhere else is a second copy waiting to drift.
 *
 * The RERA and HMDA numbers are statutory: they also appear in the prose of
 * `src/content/projects/tranquill-city.md` (the FAQ answers quote them in
 * sentences that cannot interpolate a module value). When a number changes,
 * update both — the prose quote is verified content, not a duplicate source.
 */

export const contact = {
  /** Trading name (config.yaml `site.name` carries the same value). */
  name: 'Tranquill Infra Projects',
  email: 'info@tranquillinfra.com',
  /** Display form, for a human reading it in a contact block. */
  phone: '+91 95503 62288',
  /** E.164, digits only after the +, for `tel:` links and structured data. */
  phoneE164: '+919550362288',
  /**
   * WhatsApp click-to-chat. The prefilled text saves a typing step and tells
   * the team which project the message is about.
   */
  whatsapp:
    'https://wa.me/919550362288?text=' +
    encodeURIComponent(
      'Hi Tranquill Infra, I would like to know more about Tranquill City — plot availability, pricing and the documents.'
    ),
  /** The brand's single social channel. */
  instagram: 'https://www.instagram.com/tranquill_infraprojects/',

  /** Statutory approvals, quoted verbatim from the approval letters. */
  approvals: {
    rera: { number: 'REA01100108192', label: 'RERA' },
    hmda: { number: '2103/HMDA/SWDL/2026', label: 'HMDA' },
  },

  /** Advertised plot range, as the announcement bar and page copy print it. */
  plotSizes: '150–300 sq.yd. villa plots',

  /**
   * Homepage facts (HomeHero slice). The measured plot dimensions, the parcel
   * counts and the entry price as the project page publishes them — the
   * homepage's proof belt and published-details plate read these so the numbers
   * cannot drift from the announcement bar or the project copy. Update with
   * approved values only: these are advertised plot dimensions and statutory
   * references.
   */
  details: {
    /** Advertised plot dimensions, kept in en-dash style with the site's copy. */
    plotSizes: '125.42–250.84 sq.m (150–300 sq.yd)',
    /** Project type as published. */
    projectType: 'Premium villa plots',
    /** Every parcel in the layout (saleable and mortgage parcels together). */
    totalParcels: 82,
    /** Parcels held against HMDA Mortgage conditions; not for sale. */
    mortgageHeldParcels: 4,
    /** Entry price per plot, in rupees (₹50 lakh); rendered per-plot, not per unit area. */
    priceDisplay: 'From ₹50 lakh per plot',
    /**
     * Where a buyer can independently check each approval. Per-number deep
     * links are not known: neither authority publishes a stable public
     * permalink for a single layout permission or registration, so these point
     * at the search surfaces that accept the numbers. Do not construct one by
     * pattern — a guessed query string is a dead link in a trust claim.
     */
    verify: {
      rera: 'https://rera.telangana.gov.in/',
      hmda: 'https://masterplan.hmda.gov.in/planning/LO.aspx',
    },
  },

  /** Registered office NAP, one line per entry (footer block). */
  office: {
    lines: [
      'Tranquill Infra Projects LLP',
      'Flat No. 405, Jaya Bharathi Kalpana Apartments,',
      'Nandini Nagar, Miyapur, Hyderabad — 500049',
      'Telangana, India',
    ],
  },

  /** Project site address, one line per entry (footer block). */
  project: {
    lines: ['Tranquill City, Rudraram', 'Near Patancheru, Hyderabad'],
  },

  /** Business hours, one line per entry. */
  hours: [
    'Monday: 9:00 AM to 6:00 PM',
    'Tuesday: Closed',
    'Wednesday to Sunday: 9:00 AM to 6:00 PM',
  ],
} as const;
