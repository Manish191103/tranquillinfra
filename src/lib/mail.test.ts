import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('astro:env/server', () => ({
  SITE_URL: 'https://www.tranquillinfra.com',
  GOOGLE_SITE_VERIFICATION: undefined,
  BING_SITE_VERIFICATION: undefined,
  RESEND_API_KEY: 'test-key',
  RESEND_FROM_EMAIL: 'Test <hello@example.test>',
  CONTACT_TO_EMAIL: 'sales@example.test',
  RESEND_API_URL: 'https://mail.example.test/emails',
}));

import { deliverLeadMail, type LeadMail } from './mail';

const lead: LeadMail = {
  leadId: 'stable-reference',
  eventId: 'stable-event',
  to: 'asha@example.test',
  name: 'Asha',
  requestType: 'enquiry',
  submittedAt: '2026-10-06T04:00:00.000Z',
  subject: 'New enquiry — 200 sq yd',
  enquirySubject: '200 sq yd <plot>',
  formType: 'Contact enquiry',
  context: { utm_campaign: 'plots', gclid: 'click-id' },
};
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('lead mail transport', () => {
  it('keeps retry bodies and separate provider idempotency keys stable', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{"id":"email-id"}', { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    await deliverLeadMail(lead);
    await deliverLeadMail(lead);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(fetcher.mock.calls[0][1].headers['Idempotency-Key']).toBe('lead-sales/stable-reference');
    expect(fetcher.mock.calls[1][1].headers['Idempotency-Key']).toBe(
      'lead-customer/stable-reference'
    );
    expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[2][1].body);
    expect(fetcher.mock.calls[1][1].body).toBe(fetcher.mock.calls[3][1].body);
    const sales = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(sales.subject).toBe(lead.subject);
    expect(sales.text).toContain('200 sq yd <plot>');
    expect(sales.html).toContain('200 sq yd &lt;plot&gt;');
    expect(sales.text).toContain('utm_campaign: plots');
    expect(sales.text).toContain('gclid: click-id');
  });
  it.each(['enquiry', 'brochure'] as const)(
    'does not send a receipt or brochure after sales failure: %s',
    async (requestType) => {
      const fetcher = vi.fn().mockResolvedValue(new Response('provider failed', { status: 503 }));
      vi.stubGlobal('fetch', fetcher);
      const result = await deliverLeadMail({ ...lead, requestType });
      expect(fetcher).toHaveBeenCalledOnce();
      expect(result).toMatchObject({ sales: false, confirmation: false });
    }
  );
  it('skips only the visitor send on a lead without an email', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{"id":"email-id"}', { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    const result = await deliverLeadMail({ ...lead, to: '' });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ sales: true, confirmation: false });
    const sales = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(sales.text).toContain('Email: not provided');
    expect(sales.text).toContain('call or WhatsApp');
    expect(sales.reply_to).toBeUndefined();
  });
  it('keeps sales acceptance when visitor mail fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response('{}', { status: 200 }))
        .mockResolvedValueOnce(new Response('provider failed', { status: 503 }))
    );
    expect(await deliverLeadMail(lead)).toMatchObject({ sales: true, confirmation: false });
  });
  it('uses captured submission time for brochure copy on a later retry', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    vi.setSystemTime(new Date('2026-10-06T04:00:00Z'));
    await deliverLeadMail({ ...lead, requestType: 'brochure' });
    vi.setSystemTime(new Date('2026-10-07T04:00:00Z'));
    await deliverLeadMail({ ...lead, requestType: 'brochure' });
    expect(fetcher.mock.calls[1][1].body).toBe(fetcher.mock.calls[3][1].body);
  });
  it('schedules acceptance before waiting for the visitor send', async () => {
    let release!: (response: Response) => void;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            release = resolve;
          })
      );
    vi.stubGlobal('fetch', fetcher);
    const callback = vi.fn();
    const pending = deliverLeadMail(lead, callback);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(callback).toHaveBeenCalledOnce();
    release(new Response('{}', { status: 200 }));
    expect(await pending).toMatchObject({ sales: true, confirmation: true });
  });
  it('does not invalidate mail when its acceptance callback throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    expect(
      await deliverLeadMail(lead, () => {
        throw new Error('secret-bearing error');
      })
    ).toMatchObject({ sales: true, confirmation: true });
    expect(console.warn).toHaveBeenCalledWith(expect.not.stringContaining('secret-bearing'));
    vi.restoreAllMocks();
  });
});
