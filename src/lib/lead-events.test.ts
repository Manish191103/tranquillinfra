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
});
