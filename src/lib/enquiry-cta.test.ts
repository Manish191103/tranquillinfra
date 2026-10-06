import { describe, expect, it } from 'vitest';
import { enquiryCtaTarget } from './enquiry-cta';

describe('enquiryCtaTarget', () => {
  it('scrolls to the enquiry card (intent buttons + form) on a project detail page, with no dialog', () => {
    expect(enquiryCtaTarget('/projects/tranquill-city/')).toEqual({
      href: '/projects/tranquill-city/#project-brochure',
    });
  });

  it('normalises the trailing slash before matching the slug', () => {
    expect(enquiryCtaTarget('/projects/some-future-project')).toEqual({
      href: '/projects/some-future-project/#project-brochure',
    });
  });

  it('scrolls to the inline form on the contact page', () => {
    expect(enquiryCtaTarget('/contact-us/')).toEqual({ href: '/contact-us/#contact-form' });
  });

  it('opens the enquiry dialog everywhere else, including the redirecting /projects/ root', () => {
    expect(enquiryCtaTarget('/blog/verify-plot-hyderabad/')).toEqual({
      href: '/contact-us/',
      dialog: 'enquiry-dialog',
    });
    expect(enquiryCtaTarget('/projects/')).toEqual({
      href: '/contact-us/',
      dialog: 'enquiry-dialog',
    });
  });
});
