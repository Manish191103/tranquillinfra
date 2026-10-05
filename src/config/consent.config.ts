import type { ConsentConfig } from '~/lib/consent';

const consentConfig: ConsentConfig = {
  /** Bump to force re-consent when categories change */
  version: 1,

  /** localStorage key for stored preferences */
  storageKey: 'tranquill-consent',

  categories: {
    necessary: {
      label: 'Necessary',
      description:
        'Essential cookies required for the website to function. These cannot be disabled.',
      required: true,
      defaultEnabled: true,
      gcmTypes: ['security_storage'],
    },
    analytics: {
      label: 'Analytics',
      description:
        'Measure how the site is used — pages visited and actions taken — so we can improve it. Google Analytics 4 may set analytics cookies, and measurement is pseudonymous rather than anonymous.',
      required: false,
      defaultEnabled: false,
      gcmTypes: ['analytics_storage'],
    },
    marketing: {
      label: 'Marketing',
      description:
        'Used to deliver relevant ads and track ad campaign performance across websites.',
      required: false,
      defaultEnabled: false,
      gcmTypes: ['ad_storage', 'ad_user_data', 'ad_personalization'],
    },
    preferences: {
      label: 'Preferences',
      description: 'Allow non-essential site features to remember choices you make.',
      required: false,
      defaultEnabled: false,
      gcmTypes: ['functionality_storage', 'personalization_storage'],
    },
    /**
     * The embedded Google Map. It gets its own category on purpose: the map's
     * "Load Map" button records this grant, and a map click must unlock the map
     * — not the ad/analytics measurement the marketing category gates. No
     * Google Consent Mode signals attach to it (GCM governs Google tags, and
     * the embed is not one), so granting it changes nothing else.
     */
    map: {
      label: 'Maps',
      description: 'Allow embedded maps to load. Google may set its own cookies when a map runs.',
      required: false,
      defaultEnabled: false,
      gcmTypes: [],
    },
  },

  ui: {
    heading: 'Cookie Preferences',
    description:
      'We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic.',
    acceptAll: 'Accept All',
    declineAll: 'Decline All',
    customize: 'Customize',
    savePreferences: 'Save Preferences',
    settingsHeading: 'Privacy Settings',
    alwaysOnLabel: 'Always on',
    privacyPolicyLabel: 'Privacy Policy',
  },

  /** Milliseconds before banner slides in */
  showDelay: 500,
};

export default consentConfig;
