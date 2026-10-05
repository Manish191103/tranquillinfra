import { describe, expect, it, vi } from 'vitest';

// The sender's module also carries the Graph API transport, which reads the
// Worker secrets through the `astro:env` virtual module; the vectors under
// test are pure, so the env surface is stubbed out.
vi.mock('astro:env/server', () => ({
  getSecret: () => undefined,
  META_CAPI_ACCESS_TOKEN: undefined,
  META_TEST_EVENT_CODE: undefined,
}));

import { buildFbc, normalizeIdentifiers, sha256Hex } from './meta-conversions';

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
