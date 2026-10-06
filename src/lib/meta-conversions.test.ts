import { afterEach, describe, expect, it, vi } from 'vitest';

const secrets = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock('~/config/analytics.config', () => ({ analyticsConfig: { pixelId: 'test-pixel' } }));

// The sender's module also carries the Graph API transport, which reads the
// Worker secrets through the `astro:env` virtual module; the vectors under
// test are pure, so the env surface is stubbed out.
vi.mock('astro:env/server', () => ({
  getSecret: () => undefined,
  get META_CAPI_ACCESS_TOKEN() {
    return secrets.token;
  },
  META_TEST_EVENT_CODE: undefined,
}));

import {
  buildFbc,
  metaCookieValue,
  normalizeIdentifiers,
  scheduleLeadConversion,
  sendMetaConversion,
  sha256Hex,
} from './meta-conversions';

afterEach(() => {
  secrets.token = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * The hash vectors are Meta's own documented examples (customer-information
 * parameters): a wrong normalization degrades matching silently, so these are
 * the regression net.
 */
describe('meta identifiers', () => {
  it('normalizes and hashes Meta’s documented vectors', async () => {
    const ids = normalizeIdentifiers({
      email: '  John_Smith@gmail.com ',
      phone: '+1 (650) 555-1212',
      name: 'Mary',
    });

    expect(ids).toEqual({ em: 'john_smith@gmail.com', ph: '16505551212', fn: 'mary', ln: null });
    expect(await sha256Hex(ids.em as string)).toBe(
      '62a14e44f765419d10fea99367361a727c12365e2520f32218d505ed9aa0f62f'
    );
    expect(await sha256Hex(ids.ph as string)).toBe(
      'e323ec626319ca94ee8bff2e4c87cf613be6ea19919ed1364124e16807ab3176'
    );
    expect(await sha256Hex(ids.fn as string)).toBe(
      '6915771be1c5aa0c886870b6951b03d7eafc121fea0e80a5ea83beb7c449f4ec'
    );
  });

  it('drops values it cannot match on', () => {
    expect(normalizeIdentifiers({ email: '  ', phone: '12345', name: '123' })).toEqual({
      em: null,
      ph: null,
      fn: null,
      ln: null,
    });
  });

  it('splits a full name into first and last, letters only', () => {
    expect(normalizeIdentifiers({ name: 'Ravi Kumar Reddy' })).toMatchObject({
      fn: 'ravi',
      ln: 'reddy',
    });
    expect(normalizeIdentifiers({ name: 'Jean-Luc' })).toMatchObject({ fn: 'jeanluc', ln: null });
  });

  it('builds fbc in Meta’s documented format', () => {
    expect(buildFbc('AbCdEfGh', 1554763741205)).toBe('fb.1.1554763741205.AbCdEfGh');
  });
});

describe('accepted lead transport', () => {
  const input = {
    eventName: 'Lead' as const,
    eventId: 'submission-123',
    eventTimeSeconds: 1791280000,
    eventSourceUrl: 'https://example.test/contact/',
    leadType: 'contact',
    email: ' Asha@example.test ',
    phone: '9876543210',
    name: 'Asha Reddy',
    fbclid: 'click-123',
    fbclidAtMs: 1791270000000,
    clientIp: '192.0.2.1',
    userAgent: 'Test browser',
  };

  it.each(['9876543210', '09876543210', '98765 43210', '+91 9876543210', '919876543210'])(
    'matches Indian mobile representation %s',
    (phone) => {
      expect(normalizeIdentifiers({ phone }).ph).toBe('919876543210');
    }
  );

  it('reads only the requested cookie, preserving its full value', () => {
    expect(metaCookieValue('_fbp=browser; _fbc=click=123', '_fbc')).toBe('click=123');
    expect(metaCookieValue(null, '_fbp')).toBeUndefined();
  });

  it('completes other ten-digit national numbers consistently with the Google normalizer', () => {
    expect(normalizeIdentifiers({ phone: '4012345678' }).ph).toBe('914012345678');
  });

  it('sends hashed identifiers with stable event id/time and captured attribution', async () => {
    secrets.token = 'test-token';
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ events_received: 1 })));
    vi.stubGlobal('fetch', fetcher);
    expect(await sendMetaConversion(input)).toEqual({ accepted: true });
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.data[0]).toMatchObject({
      event_name: 'Lead',
      event_id: input.eventId,
      event_time: input.eventTimeSeconds,
    });
    expect(body.data[0].user_data).toMatchObject({
      em: [await sha256Hex('asha@example.test')],
      ph: [await sha256Hex('919876543210')],
      fbc: 'fb.1.1791270000000.click-123',
      client_ip_address: input.clientIp,
      client_user_agent: input.userAgent,
    });
    expect(fetcher.mock.calls[0][1].body).not.toContain('asha@example.test');
  });

  it('requires an acknowledged received event, not just an HTTP success', async () => {
    secrets.token = 'test-token';
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ events_received: 0 })))
    );
    expect(await sendMetaConversion(input)).toEqual({ accepted: false, reason: 'graph-200' });
  });

  it('schedules failures without rejecting or logging personal data or token-bearing errors', async () => {
    secrets.token = 'test-token';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('https://graph.test/?access_token=test-token'))
    );
    let task: Promise<unknown> | undefined;
    scheduleLeadConversion((promise) => {
      task = promise;
    }, input);
    await expect(task).resolves.toBeUndefined();
    const logs = JSON.stringify(warn.mock.calls);
    expect(logs).toContain('submission-123');
    expect(logs).not.toContain('test-token');
    expect(logs).not.toContain('asha@example.test');
  });

  it('stays inert without configuration', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(await sendMetaConversion(input)).toEqual({ accepted: false, reason: 'not-configured' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not invalidate a lead when background scheduling throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(() =>
      scheduleLeadConversion(() => {
        throw new Error('Scheduler unavailable');
      }, input)
    ).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('reason=scheduling-failed'));
    // Let the already-created, internally handled send promise settle.
    await Promise.resolve();
    await Promise.resolve();
  });
});
