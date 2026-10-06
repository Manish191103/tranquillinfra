import type { APIContext } from 'astro';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../pages/api/customer-mail';
import { deliverLeadMail } from './mail';
import { isRateLimited } from './rate-limit';
vi.mock('./mail', () => ({ deliverLeadMail: vi.fn(), EmailDeliveryError: class extends Error {} }));
vi.mock('./rate-limit', () => ({ isRateLimited: vi.fn() }));

async function post(fields: Record<string, string>) {
  const request = new Request('https://example.test/api/customer-mail/', {
    method: 'POST',
    body: new URLSearchParams(fields),
  });
  const result = await POST({ request, clientAddress: '127.0.0.1' } as APIContext);
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
      expect.objectContaining({ eventId: 'event-1234' })
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
});
