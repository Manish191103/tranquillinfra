import { afterEach, describe, expect, it, vi } from 'vitest';

const config = vi.hoisted(() => ({ pixelId: 'pixel-test' as string | null }));
vi.mock('~/config/analytics.config', () => ({ analyticsConfig: config }));

afterEach(() => {
  config.pixelId = 'pixel-test';
  vi.unstubAllGlobals();
  vi.resetModules();
});

function browser() {
  const appendChild = vi.fn();
  vi.stubGlobal('window', {});
  vi.stubGlobal('document', {
    createElement: () => ({}),
    head: { appendChild },
  });
  return appendChild;
}

describe('pixel initialization order', () => {
  it('queues init and first view before an early lead without waiting for download', async () => {
    const append = browser();
    const pixel = await import('./meta-pixel');
    pixel.metaTrack('Lead', { content_name: 'contact' }, 'accepted-1');
    pixel.initMetaPixel();
    expect(window.fbq?.queue).toEqual([
      ['init', 'pixel-test'],
      ['track', 'PageView'],
      ['track', 'Lead', { content_name: 'contact' }, { eventID: 'accepted-1' }],
    ]);
    expect(append).toHaveBeenCalledTimes(1);
    // A failed/blocked download leaves the ordered queue intact, never throws.
    expect(() => pixel.metaTrack('Lead', {}, 'accepted-2')).not.toThrow();
  });

  it('initializes once on early navigation and reports subsequent pages once', async () => {
    browser();
    const pixel = await import('./meta-pixel');
    pixel.trackPixelPageView();
    pixel.initMetaPixel();
    pixel.trackPixelPageView();
    expect(window.fbq?.queue).toEqual([
      ['init', 'pixel-test'],
      ['track', 'PageView'],
      ['track', 'PageView'],
    ]);
    const callMethod = vi.fn();
    window.fbq!.callMethod = callMethod;
    pixel.metaTrack('Lead', {}, 'accepted');
    expect(callMethod).toHaveBeenCalledWith('track', 'Lead', {}, { eventID: 'accepted' });
  });

  it('does nothing when no pixel is configured', async () => {
    config.pixelId = null;
    const append = browser();
    const pixel = await import('./meta-pixel');
    pixel.initMetaPixel();
    pixel.trackPixelPageView();
    pixel.metaTrack('Lead', {}, 'accepted');
    expect(append).not.toHaveBeenCalled();
    expect(window.fbq).toBeUndefined();
  });
  it('uses the custom-event command for newsletter signups', async () => {
    browser();
    const pixel = await import('./meta-pixel');
    pixel.metaTrack('NewsletterSignup', {}, 'signup-1');
    expect(window.fbq?.queue[2]).toEqual([
      'trackCustom',
      'NewsletterSignup',
      {},
      { eventID: 'signup-1' },
    ]);
  });

  it('does not throw into submission handling when script setup fails', async () => {
    browser();
    vi.stubGlobal('document', {
      createElement: () => {
        throw new Error('Unavailable');
      },
    });
    const pixel = await import('./meta-pixel');
    expect(() => pixel.metaTrack('Lead', {}, 'accepted')).not.toThrow();
    expect(window.__pixelReady).toBe(false);
    expect(window.fbq).toBeUndefined();
    const append = vi.fn();
    vi.stubGlobal('document', { createElement: () => ({}), head: { appendChild: append } });
    pixel.metaTrack('Lead', {}, 'accepted');
    expect(append).toHaveBeenCalledTimes(1);
    expect(window.fbq?.queue).toEqual([
      ['init', 'pixel-test'],
      ['track', 'PageView'],
      ['track', 'Lead', {}, { eventID: 'accepted' }],
    ]);
  });
});
