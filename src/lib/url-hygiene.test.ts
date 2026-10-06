import { afterEach, describe, expect, it, vi } from 'vitest';
import { stripTrackingParams } from './url-hygiene';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

function browserHistory(href = 'https://example.test/?gclid=click-1&utm_source=google#details') {
  let location = new URL(href);
  let measuredUrl = location.href;
  const pageViews: string[] = [];
  class BrowserHistory {
    state: unknown = { index: 0, scrollX: 0, scrollY: 0 };
    replaceState(_state: unknown, _unused: string, _url?: string | URL | null): void {}
  }
  const native = vi.fn(function (
    this: BrowserHistory,
    state: unknown,
    _unused: string,
    url?: string | URL | null
  ) {
    const next = url == null ? location : new URL(url, location);
    if (next.origin !== location.origin)
      throw new DOMException('Cross-origin URL', 'SecurityError');
    this.state = state;
    location = next;
  });
  const observer = vi.fn(function (this: BrowserHistory, ...args: Parameters<typeof native>) {
    native.apply(this, args);
    if (measuredUrl !== location.href) {
      measuredUrl = location.href;
      pageViews.push(measuredUrl);
    }
  });
  BrowserHistory.prototype.replaceState = observer;
  const history = new BrowserHistory();
  vi.stubGlobal('window', {
    history,
    get location() {
      return location;
    },
  });
  const remove = vi.fn();
  const createElement = vi.fn(() => ({
    contentWindow: { history: { replaceState: native } },
    remove,
  }));
  vi.stubGlobal('document', {
    querySelector: () => ({ href: 'https://example.test/' }),
    createElement,
    documentElement: { append: vi.fn() },
  });
  return {
    history,
    observer,
    native,
    pageViews,
    createElement,
    remove,
    prototype: BrowserHistory.prototype,
  };
}

describe('history after tracking parameter cleanup', () => {
  it('preserves campaign, hash and history state without measuring cleanup or subsequent scrolling', async () => {
    const browser = browserHistory();
    const state = browser.history.state;
    const { cleanTrackingParamsFromAddressBar } = await import('./url-hygiene');
    cleanTrackingParamsFromAddressBar();
    expect(window.location.href).toBe('https://example.test/?utm_source=google#details');
    expect(browser.history.state).toBe(state);

    browser.history.replaceState({ index: 0, scrollY: 650 }, '');
    browser.history.replaceState({ index: 0, scrollY: 900 }, '', window.location.href);
    expect(browser.history.state).toEqual({ index: 0, scrollY: 900 });
    expect(browser.observer).not.toHaveBeenCalled();
    expect(browser.pageViews).toEqual([]);
    expect(browser.remove).toHaveBeenCalledOnce();
  });

  it('keeps real URL changes observable and does not wrap again on repeated cleanup', async () => {
    const browser = browserHistory();
    const { cleanTrackingParamsFromAddressBar } = await import('./url-hygiene');
    cleanTrackingParamsFromAddressBar();
    const guarded = browser.history.replaceState;
    cleanTrackingParamsFromAddressBar();
    expect(browser.history.replaceState).toBe(guarded);
    expect(browser.createElement).toHaveBeenCalledOnce();

    browser.history.replaceState({ index: 1 }, '', '/blog/');
    expect(browser.pageViews).toEqual(['https://example.test/blog/']);
    expect(browser.observer).toHaveBeenCalledOnce();
    browser.history.replaceState({ index: 1, scrollY: 300 }, '', '/blog/');
    expect(browser.observer).toHaveBeenCalledOnce();
  });

  it('forwards real navigation to an observer installed after cleanup', async () => {
    const browser = browserHistory();
    browser.prototype.replaceState = browser.native;
    const { cleanTrackingParamsFromAddressBar } = await import('./url-hygiene');
    cleanTrackingParamsFromAddressBar();
    browser.prototype.replaceState = browser.observer;
    browser.history.replaceState({ index: 0, scrollY: 400 }, '');
    expect(browser.observer).not.toHaveBeenCalled();
    browser.history.replaceState({ index: 1 }, '', '/contact-us/');
    expect(browser.pageViews).toEqual(['https://example.test/contact-us/']);
  });

  it('preserves native rejection of cross-origin URLs without changing state', async () => {
    const browser = browserHistory();
    const { cleanTrackingParamsFromAddressBar } = await import('./url-hygiene');
    cleanTrackingParamsFromAddressBar();
    const state = browser.history.state;
    expect(() => browser.history.replaceState({}, '', 'https://other.test/')).toThrow(
      'Cross-origin URL'
    );
    expect(browser.history.state).toBe(state);
  });
});

describe('stripTrackingParams', () => {
  it('removes the Google linker decoration and the paid-media click ids', () => {
    expect(
      stripTrackingParams(
        '?_gl=1*hsjjx1*abc&_ga=MTAyNzA2OTQ0Mi4xNzkwNDkwNDc0&_ga_SK7K0WHJPK=czE3OTA0&gclid=Cj0KCQ&wbraid=W1&gbraid=G1'
      )
    ).toBe('');
  });

  it('keeps campaign parameters in place', () => {
    // `fbclid` is stripped: it is on the shared click-id list, so an address bar
    // the visitor copies out of a Meta ad carries no ad identifier.
    expect(stripTrackingParams('?utm_source=google&gclid=x&utm_campaign=spring&fbclid=f')).toBe(
      '?utm_source=google&utm_campaign=spring'
    );
  });

  it('drops every occurrence of a tracking parameter', () => {
    expect(stripTrackingParams('?_gl=a&_gl=b&note=keep')).toBe('?note=keep');
  });

  it('returns an empty search when nothing remains', () => {
    expect(stripTrackingParams('?gclid=x')).toBe('');
  });

  it('leaves a clean query byte-for-byte', () => {
    expect(stripTrackingParams('?q=a%20b&note=gclid')).toBe('?q=a%20b&note=gclid');
  });

  it('keeps parameters that only look like tracking ids', () => {
    expect(stripTrackingParams('?gclid_extra=1&_g=1&_gauntlet=1')).toBe(
      '?gclid_extra=1&_g=1&_gauntlet=1'
    );
  });

  it('handles an empty search', () => {
    expect(stripTrackingParams('')).toBe('');
  });
});
