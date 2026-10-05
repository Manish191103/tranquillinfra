import { describe, expect, it } from 'vitest';

import { normalizeAdsUserData } from './analytics';

/**
 * Enhanced conversions match on normalized identifiers and degrade silently
 * when the shape is wrong — these vectors pin Google's declared expectations
 * (trimmed/lowercased email, `+`-prefixed digits phone, lowercased names).
 */
describe('ads user data', () => {
  it('normalizes email and keeps only matchable identifiers', () => {
    expect(
      normalizeAdsUserData({ email: '  John_Smith@Gmail.com ', phone: '12345', name: '123' })
    ).toEqual({ email: 'john_smith@gmail.com', first_name: '123' });
  });

  it('completes national numbers to E.164 and keeps international ones', () => {
    expect(normalizeAdsUserData({ phone: '+1 (650) 555-1212' })).toEqual({
      phone_number: '+16505551212',
    });
    expect(normalizeAdsUserData({ phone: '+44 20 7946 0958' })).toEqual({
      phone_number: '+442079460958',
    });
    // The tag cannot infer a country code: 10-digit nationals complete to +91
    // (the site's only market), leading zeros and 91-prefixed forms included.
    expect(normalizeAdsUserData({ phone: '98765 43210' })).toEqual({
      phone_number: '+919876543210',
    });
    expect(normalizeAdsUserData({ phone: '098765 43210' })).toEqual({
      phone_number: '+919876543210',
    });
    expect(normalizeAdsUserData({ phone: '91 98765 43210' })).toEqual({
      phone_number: '+919876543210',
    });
    // Not plausibly E.164: dropped rather than sent blank.
    expect(normalizeAdsUserData({ phone: '12345' })).toEqual({});
    expect(normalizeAdsUserData({ phone: '123 4567' })).toEqual({});
  });

  it('splits a full name into first and last', () => {
    expect(normalizeAdsUserData({ name: 'Ravi Kumar Reddy' })).toEqual({
      first_name: 'ravi',
      last_name: 'reddy',
    });
    expect(normalizeAdsUserData({ name: 'Jean-Luc' })).toEqual({ first_name: 'jean-luc' });
  });

  it('omits every empty field rather than sending blanks', () => {
    expect(normalizeAdsUserData({})).toEqual({});
  });
});
