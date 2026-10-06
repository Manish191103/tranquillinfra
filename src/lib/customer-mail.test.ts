import type { APIContext } from 'astro';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../pages/api/customer-mail';
import { deliverLeadMail } from './mail';
import { isRateLimited } from './rate-limit';
import { scheduleLeadConversion } from './meta-conversions';
vi.mock('./meta-conversions', () => ({
  scheduleLeadConversion: vi.fn(),
  metaCookieValue: () => undefined,
}));
vi.mock('./mail', () => ({ deliverLeadMail: vi.fn(), EmailDeliveryError: class extends Error {} }));
vi.mock('./rate-limit', () => ({ isRateLimited: vi.fn() }));

async function post(fields: Record<string, string>, locals: unknown = {}) {
  const request = new Request('https://example.test/api/customer-mail/', {
    method: 'POST',
    body: new URLSearchParams(fields),
  });
  const result = await POST({ request, clientAddress: '127.0.0.1', locals } as APIContext);
  return { status: result.status, body: await result.json() };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isRateLimited).mockResolvedValue(false);
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
describe('sales acceptance response', () => {
  it.each([true, false])('accepts sales independently of confirmation=%s', async (confirmation) => {
    vi.mocked(deliverLeadMail).mockResolvedValue({ sales: true, confirmation });
    const result = await post({ email: 'asha@example.test', event_id: 'event-1234' });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ accepted: true, sent: true, confirmation });
    expect(deliverLeadMail).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'event-1234' }),
      expect.any(Function)
    );
  });
  it('does not accept failed sales even when confirmation succeeded', async () => {
    vi.mocked(deliverLeadMail).mockResolvedValue({ sales: false, confirmation: true });
    expect((await post({ email: 'asha@example.test' })).body).toMatchObject({
      accepted: false,
      sent: false,
    });
  });
  it('suppresses honeypots before quota and email', async () => {
    expect(await post({ email: 'asha@example.test', _gotcha: 'bot' })).toMatchObject({
      status: 200,
      body: { accepted: false, sent: true },
    });
    expect(deliverLeadMail).not.toHaveBeenCalled();
    expect(isRateLimited).not.toHaveBeenCalled();
  });
  it('rejects invalid fields and throttled requests without sending', async () => {
    expect((await post({ email: 'invalid' })).body.accepted).toBe(false);
    vi.mocked(isRateLimited).mockResolvedValue(true);
    expect(await post({ email: 'asha@example.test' })).toMatchObject({
      status: 429,
      body: { accepted: false },
    });
    expect(deliverLeadMail).not.toHaveBeenCalled();
  });
  it('does not accept exceptions such as missing provider credentials', async () => {
    vi.mocked(deliverLeadMail).mockRejectedValue(new Error('Missing credentials'));
    expect(await post({ email: 'asha@example.test' })).toMatchObject({
      status: 500,
      body: { accepted: false },
    });
  });
  it('preserves subject and attribution and derives a stable reference for retries', async () => {
    vi.mocked(deliverLeadMail).mockResolvedValue({ sales: true, confirmation: true });
    const fields = {
      email: 'asha@example.test',
      event_id: 'retry-event',
      submitted_at: new Date().toISOString(),
      enquiry_subject: '200 sq yd',
      subject: 'Enquiry — 200 sq yd',
      form_type: 'Contact',
      utm_campaign: 'plots',
      gclid: 'google-click',
      landing_page: '/?utm_campaign=plots',
    };
    const first = await post(fields);
    const second = await post(fields);
    expect(first.body.lead_id).toBe(second.body.lead_id);
    expect(deliverLeadMail).toHaveBeenCalledWith(
      expect.objectContaining({
        enquirySubject: '200 sq yd',
        subject: 'Enquiry — 200 sq yd',
        context: expect.objectContaining({ utm_campaign: 'plots', gclid: 'google-click' }),
      }),
      expect.any(Function)
    );
    expect((await post({ ...fields, enquiry_subject: '300 sq yd' })).body.lead_id).not.toBe(
      first.body.lead_id
    );
  });
  it('rejects expired and future submissions before email', async () => {
    for (const offset of [-24 * 60 * 60_000, 6 * 60_000]) {
      expect(
        (
          await post({
            email: 'asha@example.test',
            submitted_at: new Date(Date.now() + offset).toISOString(),
          })
        ).status
      ).toBe(400);
    }
    expect(deliverLeadMail).not.toHaveBeenCalled();
  });
  it('schedules server conversion only for accepted sales', async () => {
    const waitUntil = vi.fn();
    const locals = { cfContext: { waitUntil } };
    vi.mocked(deliverLeadMail).mockResolvedValueOnce({ sales: false, confirmation: false });
    await post({ email: 'asha@example.test', event_id: 'server-event' }, locals);
    expect(scheduleLeadConversion).not.toHaveBeenCalled();
    vi.mocked(deliverLeadMail).mockImplementationOnce(async (_lead, callback) => {
      callback?.();
      return { sales: true, confirmation: false };
    });
    await post({ email: 'asha@example.test', event_id: 'server-event' }, locals);
    expect(scheduleLeadConversion).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ eventId: 'server-event', eventName: 'Lead', leadType: 'contact' })
    );
  });
  it('keeps accepted sales successful when measurement scheduling fails', async () => {
    vi.mocked(deliverLeadMail).mockImplementation(async (_lead, callback) => {
      callback?.();
      return { sales: true, confirmation: true };
    });
    vi.mocked(scheduleLeadConversion).mockImplementationOnce(() => {
      throw new Error('Runtime unavailable');
    });
    expect(
      await post({ email: 'asha@example.test' }, { cfContext: { waitUntil: vi.fn() } })
    ).toMatchObject({ status: 200, body: { accepted: true } });
  });
  it('restricts the resolved conversion source to the request origin', async () => {
    vi.mocked(deliverLeadMail).mockImplementation(async (_lead, callback) => {
      callback?.();
      return { sales: true, confirmation: true };
    });
    await post(
      { email: 'asha@example.test', page: '/\\evil.example/' },
      { cfContext: { waitUntil: vi.fn() } }
    );
    expect(scheduleLeadConversion).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ eventSourceUrl: 'https://example.test/' })
    );
  });
  it('clamps tolerated future clock skew to server conversion time', async () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    vi.mocked(deliverLeadMail).mockImplementation(async (_lead, callback) => {
      callback?.();
      return { sales: true, confirmation: true };
    });
    const result = await post(
      { email: 'asha@example.test', submitted_at: new Date(now + 4 * 60_000).toISOString() },
      { cfContext: { waitUntil: vi.fn() } }
    );
    expect(result.status).toBe(200);
    expect(scheduleLeadConversion).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ eventTimeSeconds: Math.floor(now / 1000) })
    );
  });
});
