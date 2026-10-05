/**
 * About-us page copy.
 *
 * The section blocks of `/about-us/`: editorial lines and item lists in one
 * place, so the page is layout-only. Values that are published site-wide (the
 * fact rows, the contact lines in the FAQ answers) are read from
 * `project.config.ts` / `site.config.ts` at module scope, never retyped.
 */
import siteConfig from './site.config';

interface NumberedItem {
  number: string;
  title: string;
  body: string;
}

interface IconItem {
  icon: string;
  title: string;
  body: string;
}

export const approachItems: NumberedItem[] = [
  {
    number: '01',
    title: 'Say what is known',
    body: 'Project information is published as it is reviewed, with current details shared on request.',
  },
  {
    number: '02',
    title: 'Make the next step clear',
    body: 'Start with the project story, ask for the documents, then visit the site where practical.',
  },
  {
    number: '03',
    title: 'Keep space to verify',
    body: 'Bring your own questions and advisers before making a decision about a plot.',
  },
];

export const missionVisionCards: Array<{
  label: string;
  title: string;
  body: string;
  featured?: boolean;
}> = [
  {
    label: 'Our mission',
    title: 'Plan places people can understand.',
    body: 'Develop thoughtfully planned residential communities with considered infrastructure, straightforward communication, and enough context for buyers to make informed choices.',
    featured: true,
  },
  {
    label: 'Our vision',
    title: 'Clear information. Better decisions.',
    body: 'We want buying a plot to feel simpler and more transparent: useful information before the sales conversation, thoughtfully planned communities, and the confidence to make an informed choice.',
  },
];

export const processSteps: NumberedItem[] = [
  {
    number: '01',
    title: 'Understand the plan',
    body: 'Review the project story, plot range, location context, and advertised features.',
  },
  {
    number: '02',
    title: 'Request the documents',
    body: 'Ask for the approval details, layout plan, title information, and current project details relevant to your decision.',
  },
  {
    number: '03',
    title: 'Verify for yourself',
    body: 'Visit where practical and involve your own legal or financial adviser before committing.',
  },
];

export const values: IconItem[] = [
  {
    icon: 'check-circle',
    title: 'Honesty',
    body: 'Clarity in every document and every interaction.',
  },
  {
    icon: 'star',
    title: 'Quality',
    body: 'Thoughtful development through structured planning and attention to detail.',
  },
  {
    icon: 'eye',
    title: 'Transparency',
    body: 'Clear communication and documentation you can rely on.',
  },
  {
    icon: 'users',
    title: 'Customer First',
    body: 'Every decision begins with understanding what our customers need.',
  },
];

export const differenceItems: IconItem[] = [
  {
    icon: 'shield',
    title: 'Transparent Process',
    body: 'Clear communication and honest documentation at every stage of your journey with us.',
  },
  {
    icon: 'map-pin',
    title: 'Premium Locations',
    body: 'Carefully selected sites in Hyderabad’s growth corridors with strong connectivity and everyday convenience.',
  },
  {
    icon: 'layout',
    title: 'Quality Infrastructure',
    body: 'Thoughtful planning with internal roads, parks, lighting, and round-the-clock security.',
  },
  {
    icon: 'users',
    title: 'Customer-First Approach',
    body: 'Every decision we make starts with understanding what you need from your plans.',
  },
];

/**
 * Company-level questions, answered from the published details on the page and
 * the project page — no new promises. The project page's FAQ covers the
 * plot-level questions; this one covers the developer.
 */
export const companyFaqs: Array<{ question: string; answer: string }> = [
  {
    question: 'Who is Tranquill Infra?',
    answer:
      'Tranquill Infra Projects Pvt. Ltd. is a Hyderabad-based real estate development company creating premium residential plot developments with a clear, customer-first approach. Its premium project is Tranquill City, a villa plot development in Rudraram near Patancheru.',
  },
  {
    question: 'Where is the office, and when can I visit?',
    answer:
      'The office is in Nandini Nagar, Miyapur, Hyderabad — open Monday and Wednesday to Sunday, 9:00 AM to 6:00 PM, and closed on Tuesday. Call ahead and the team will guide you in.',
  },
  {
    question: 'How does Tranquill Infra decide what to publish?',
    answer:
      'Project information is published as it is reviewed, and current details are shared on request. From the first conversation, the team focuses on the documents behind a decision: the approval letter, the layout plan and the title information relevant to the plot you are considering.',
  },
  {
    question: 'How do I start a conversation about a plot?',
    answer: `Call or message the team on WhatsApp at ${siteConfig.phone}, write to ${siteConfig.email}, or send an enquiry from the contact page. Ask for current availability, pricing, the plot you are comparing, or a site visit.`,
  },
  {
    question: 'Should I verify the project for myself?',
    answer:
      'Yes — that is the approach we encourage. Bring your own lawyer or financial adviser, ask for the approval letter, layout plan and title details, and confirm the published RERA and HMDA references on the official portals before you decide.',
  },
];
