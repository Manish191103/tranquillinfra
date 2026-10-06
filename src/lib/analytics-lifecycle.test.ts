import { afterEach, describe, expect, it, vi } from 'vitest';

const stubs = vi.hoisted(() => ({
  config: {
    gaId: null as string | null,
    adsId: 'AW-test' as string | null,
    adsConversionLabel: 'label',
  },
  clean: vi.fn(),
  pageView: vi.fn(),
  initPixel: vi.fn(),
}));
vi.mock('~/config/analytics.config', () => ({ analyticsConfig: stubs.config }));
vi.mock('./url-hygiene', () => ({
  CLICK_ID_KEYS: ['gclid'],
  cleanTrackingParamsFromAddressBar: stubs.clean,
}));
vi.mock('./meta-pixel', () => ({
  initMetaPixel: stubs.initPixel,
  trackPixelPageView: stubs.pageView,
  metaTrack: vi.fn(),
}));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.resetModules();
  stubs.config.adsId = 'AW-test';
});

function browser(adsId = 'AW-test') {
  vi.useFakeTimers();
  const documentEvents = new EventTarget();
  vi.stubGlobal(
    'document',
    Object.assign(documentEvents, {
      readyState: 'complete',
      referrer: '',
      getElementById: () => ({ dataset: { id: '', adsId } }),
    })
  );
  vi.stubGlobal(
    'window',
    Object.assign(new EventTarget(), {
      location: {
        pathname: '/landing/',
        search: '?gclid=click-1',
        href: 'https://example.test/landing/?gclid=click-1',
      },
      requestIdleCallback: (callback: () => void) => callback(),
      setTimeout,
    })
  );
  vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: vi.fn() });
  vi.stubGlobal('performance', { getEntriesByType: () => [] });
  return documentEvents;
}

describe('measurement lifecycle', () => {
  it('preserves Ads-only attribution until the bounded cleanup timeout', async () => {
    browser();
    const analytics = await import('./analytics');
    analytics.initAnalytics();
    await vi.advanceTimersByTimeAsync(19500);
    expect(stubs.clean).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(stubs.clean).toHaveBeenCalledTimes(1);
    expect(analytics.collectLeadContext().gclid).toBe('click-1');
  });

  it('cleans immediately when no Google tag is configured', async () => {
    stubs.config.adsId = null;
    browser('');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const analytics = await import('./analytics');
    analytics.initAnalytics();
    expect(stubs.clean).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('leaves initial view to initialization and counts each completed swap once', async () => {
    const events = browser();
    const analytics = await import('./analytics');
    analytics.initAnalytics();
    analytics.initAnalytics();
    events.dispatchEvent(new Event('astro:page-load'));
    expect(stubs.pageView).not.toHaveBeenCalled();
    events.dispatchEvent(new Event('astro:after-swap'));
    events.dispatchEvent(new Event('astro:page-load'));
    events.dispatchEvent(new Event('astro:page-load'));
    expect(stubs.pageView).toHaveBeenCalledTimes(1);
  });
});
