import { CLICK_ID_KEYS } from './url-hygiene';

/** Attribution fields shared by the browser payload and sales notification. */
export const LEAD_CONTEXT_FIELDS = [
  'landing_page',
  'referrer',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  ...CLICK_ID_KEYS,
] as const;
