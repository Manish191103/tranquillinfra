import { describe, expect, it } from 'vitest';
import { stripTrackingParams } from './url-hygiene';

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
