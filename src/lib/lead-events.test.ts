import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackLead } from './analytics';
import { metaTrack } from './meta-pixel';
vi.mock('~/config/analytics.config', () => ({
  analyticsConfig: { gaId: 'G-test', adsId: 'AW-test', adsConversionLabel: 'label' },
}));
vi.mock('./meta-pixel', () => ({
  metaTrack: vi.fn(),
  initMetaPixel: vi.fn(),
  trackPixelPageView: vi.fn(),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe('lead destinations', () => {
  it.each(['contact', 'newsletter'] as const)('routes %s to its intended destinations', (kind) => {
    const gtag = vi.fn();
    vi.stubGlobal('window', { gtag, location: { href: 'https://example.test/new/' } });
    vi.stubGlobal('document', { title: 'New page' });
    trackLead(kind, 'submission-1', {
      page_location: 'https://example.test/submitted/',
      page_title: 'Submitted',
    });
    const gaEvent = kind === 'contact' ? 'generate_lead' : 'newsletter_signup';
    expect(gtag).toHaveBeenCalledWith(
      'event',
      gaEvent,
      expect.objectContaining({
        send_to: 'G-test',
        event_id: 'submission-1',
        page_location: 'https://example.test/submitted/',
        page_title: 'Submitted',
      })
    );
    expect(gtag).toHaveBeenCalledTimes(kind === 'contact' ? 2 : 1);
    if (kind === 'contact')
      expect(gtag).toHaveBeenCalledWith('event', 'conversion', {
        send_to: 'AW-test/label',
        transaction_id: 'submission-1',
      });
    expect(metaTrack).toHaveBeenCalledWith(
      kind === 'contact' ? 'Lead' : 'NewsletterSignup',
      expect.any(Object),
      'submission-1'
    );
  });
  it('sends enhanced identifiers only on the accepted Ads conversion', () => {
    const gtag = vi.fn();
    vi.stubGlobal('window', { gtag, location: { href: 'https://example.test/' } });
    vi.stubGlobal('document', { title: 'Contact' });
    trackLead(
      'contact',
      'accepted-1',
      {},
      {
        email: ' Buyer@Example.com ',
        phone: '9876543210',
      }
    );
    expect(gtag.mock.calls.slice(1)).toEqual([
      ['set', 'user_data', { email: 'buyer@example.com', phone_number: '+919876543210' }],
      ['event', 'conversion', { send_to: 'AW-test/label', transaction_id: 'accepted-1' }],
      ['set', 'user_data', null],
    ]);
    const gaParameters = gtag.mock.calls[0][2];
    expect(gaParameters).not.toHaveProperty('user_data');
    gtag.mockClear();
    trackLead('newsletter', 'signup-1', {}, { email: 'buyer@example.com' });
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag.mock.calls[0][2]).not.toHaveProperty('user_data');
  });

  it('clears enhanced identifiers even if the conversion dispatcher throws', () => {
    const gtag = vi.fn((command, name) => {
      if (command === 'event' && name === 'conversion') throw new Error('Tag unavailable');
    });
    vi.stubGlobal('window', { gtag, location: { href: 'https://example.test/' } });
    vi.stubGlobal('document', { title: 'Contact' });

    expect(() => trackLead('contact', 'accepted-2', {}, { email: 'buyer@example.com' })).toThrow(
      'Tag unavailable'
    );
    expect(gtag.mock.calls.at(-1)).toEqual(['set', 'user_data', null]);
  });
});
