import { describe, expect, it } from 'vitest';

import { composeEnquiryFields, enquirySubject } from './leads';

/**
 * The `subject` field is the Formspree notification subject and the payload the
 * only record of a lead, so a wrong subject loses the team's triage signal and a
 * dropped field loses the campaign context silently.
 */
describe('enquiry subject', () => {
  it('labels the request types the team triages apart', () => {
    expect(enquirySubject({ name: 'Asha', requestType: 'site_visit' })).toBe(
      'Site visit request: Asha'
    );
    expect(enquirySubject({ name: 'Asha', requestType: 'brochure' })).toBe(
      'Brochure request: Asha'
    );
  });

  it('falls back to the enquiry line for a plain or unknown request type', () => {
    expect(enquirySubject({ name: 'Asha', requestType: 'enquiry' })).toBe('New enquiry from Asha');
    expect(enquirySubject({ name: 'Asha', requestType: '' })).toBe('New enquiry from Asha');
  });

  it('names the website when the visitor left the name empty', () => {
    expect(enquirySubject({ name: '', requestType: 'enquiry' })).toBe(
      'New enquiry from the website'
    );
  });

  it('carries the visit date in the site-visit subject, formatted in UTC', () => {
    expect(enquirySubject({ name: 'Asha', requestType: 'site_visit', visitDate: '2026-03-07' })).toBe(
      'Site visit request: Asha — visiting Sat, 7 Mar, 2026'
    );
  });
});

describe('enquiry payload', () => {
  const base = { eventId: 'evt-1', page: '/projects/', subject: 'Brochure request: Asha' };

  it('stamps the shared fields over the form payload', () => {
    const formData = new FormData();
    formData.set('name', 'Asha');
    formData.set('subject', 'New website enquiry');

    const composed = composeEnquiryFields(formData, base);

    expect(composed.get('name')).toBe('Asha');
    expect(composed.get('event_id')).toBe('evt-1');
    expect(composed.get('page')).toBe('/projects/');
    expect(composed.get('subject')).toBe('Brochure request: Asha');
  });

  it('carries only the context values this visit has', () => {
    const composed = composeEnquiryFields(new FormData(), {
      ...base,
      context: { landing_page: '/', utm_source: 'google', fbclid: '' },
    });

    expect(composed.get('landing_page')).toBe('/');
    expect(composed.get('utm_source')).toBe('google');
    expect(composed.has('fbclid')).toBe(false); // empty value: never stored blank
    expect(composed.has('gclid')).toBe(false); // absent key: never added
  });
});
