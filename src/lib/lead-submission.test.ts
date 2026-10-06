import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindLeadForm } from './leads';
import { trackLead } from './analytics';
import { relayLeadConversion } from './meta-pixel';

vi.mock('./analytics', () => ({
  collectLeadContext: () => ({ utm_source: 'google', fbclid: 'click' }),
  firstTouchTimestampMs: () => 1234,
  LEAD_EVENTS: { contact: { meta: 'Lead' }, newsletter: { meta: 'NewsletterSignup' } },
  trackFormStart: vi.fn(),
  trackLead: vi.fn(),
}));
vi.mock('./meta-pixel', () => ({ relayLeadConversion: vi.fn() }));

const NativeFormData = globalThis.FormData;
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function surface(kind: 'contact' | 'newsletter' = 'contact', gotcha = '') {
  let submit: (event: { preventDefault: () => void }) => Promise<void>;
  const fields = {
    name: 'Asha',
    email: 'asha@example.test',
    phone: '9876543210',
    request_type: 'brochure',
    _gotcha: gotcha,
  };
  const form = {
    dataset: {},
    id: 'enquiry',
    action: 'https://formspree.io/f/test',
    fields,
    reset: vi.fn(),
    addEventListener: (name: string, listener: typeof submit) => {
      if (name === 'submit') submit = listener;
    },
  };
  const button = { disabled: false, textContent: 'Submit' };
  const message = { textContent: '', className: '', append: vi.fn() };
  const onSuccess = vi.fn();
  const onFailure = vi.fn();
  bindLeadForm({
    form: form as unknown as HTMLFormElement,
    button: button as HTMLButtonElement,
    message: message as unknown as HTMLElement,
    kind,
    composeSubject: () => 'Enquiry',
    onSuccess,
    onFailure,
  });
  return {
    form,
    button,
    message,
    onSuccess,
    onFailure,
    submit: () => submit({ preventDefault: vi.fn() }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('window', {
    location: { pathname: '/contact-us/', href: 'https://example.test/contact-us/' },
  });
  vi.stubGlobal('document', { title: 'Contact' });
  vi.stubGlobal(
    'FormData',
    class extends NativeFormData {
      constructor(form?: { fields: Record<string, string> }) {
        super();
        for (const [key, value] of Object.entries(form?.fields ?? {})) this.set(key, value);
      }
    }
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('submission acceptance', () => {
  it.each([true, false])(
    'counts sales acceptance with visitor confirmation=%s',
    async (confirmation) => {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(response({ ok: true }))
        .mockResolvedValueOnce(response({ accepted: true, sent: true, confirmation }));
      vi.stubGlobal('fetch', fetcher);
      const ui = surface();
      await ui.submit();
      expect(trackLead).toHaveBeenCalledTimes(1);
      expect(relayLeadConversion).toHaveBeenCalledTimes(1);
      const eventId = vi.mocked(trackLead).mock.calls[0][1];
      expect(relayLeadConversion).toHaveBeenCalledWith(
        expect.objectContaining({ eventId, eventSourceUrl: 'https://example.test/contact-us/' })
      );
      expect((fetcher.mock.calls[1][1].body as FormData).get('event_id')).toBe(eventId);
      expect(ui.onSuccess).toHaveBeenCalledOnce();
      expect(ui.form.reset).toHaveBeenCalledOnce();
      expect(ui.button.disabled).toBe(false);
    }
  );

  it.each([
    [{ sent: true }, 200],
    [{ accepted: true, sent: true }, 502],
    [{ accepted: false, sent: false, reason: 'sales_mail_failed' }, 502],
    [{ accepted: false, sent: false, reason: 'rate_limited' }, 429],
    [null, 200],
  ])('does not count unconfirmed sales acceptance %j', async (body, status) => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(response({ ok: true }))
        .mockResolvedValueOnce(response(body, status as number))
    );
    const ui = surface();
    await ui.submit();
    expect(trackLead).not.toHaveBeenCalled();
    expect(relayLeadConversion).not.toHaveBeenCalled();
    expect(ui.form.reset).not.toHaveBeenCalled();
    expect(ui.onSuccess).not.toHaveBeenCalled();
    expect(ui.onFailure).toHaveBeenCalledOnce();
    expect(ui.button.disabled).toBe(false);
  });

  it('uses sales acceptance when Formspree is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValueOnce(new Error('Offline'))
        .mockResolvedValueOnce(response({ accepted: true, sent: true, confirmation: true }))
    );
    const ui = surface();
    await ui.submit();
    expect(trackLead).toHaveBeenCalledOnce();
    expect(ui.message.textContent).toContain('brochure');
    expect(ui.message.append).toHaveBeenCalledWith(expect.stringContaining('form provider'));
  });

  it('retains inputs when both providers fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));
    const ui = surface();
    await ui.submit();
    expect(trackLead).not.toHaveBeenCalled();
    expect(ui.form.reset).not.toHaveBeenCalled();
    expect(ui.onFailure).toHaveBeenCalledOnce();
  });

  it('does not bypass a Formspree validation rejection', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(response({ errors: [{ message: 'Invalid email' }] }, 400));
    vi.stubGlobal('fetch', fetcher);
    const ui = surface();
    await ui.submit();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(trackLead).not.toHaveBeenCalled();
  });

  it('acknowledges honeypots without measurement or real success callbacks', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(response({ ok: true }))
        .mockResolvedValueOnce(response({ accepted: false, sent: true }))
    );
    const ui = surface('contact', 'bot');
    await ui.submit();
    expect(trackLead).not.toHaveBeenCalled();
    expect(relayLeadConversion).not.toHaveBeenCalled();
    expect(ui.onSuccess).not.toHaveBeenCalled();
    expect(ui.onFailure).not.toHaveBeenCalled();
  });

  it('blocks overlapping submits and captures the original page before waiting', async () => {
    let accept!: (value: Response) => void;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ ok: true }))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            accept = resolve;
          })
      );
    vi.stubGlobal('fetch', fetcher);
    const ui = surface();
    const pending = ui.submit();
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(trackLead).not.toHaveBeenCalled();
    await ui.submit();
    expect(fetcher).toHaveBeenCalledTimes(2);
    window.location.href = 'https://example.test/about-us/';
    accept(response({ accepted: true, sent: true, confirmation: true }));
    await pending;
    expect(trackLead).toHaveBeenCalledWith(
      'contact',
      expect.any(String),
      expect.objectContaining({
        page_location: 'https://example.test/contact-us/',
        request_type: 'brochure',
        form: 'enquiry',
      }),
      expect.any(Object)
    );
  });

  it('keeps newsletter acceptance on Formspree', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ ok: true }));
    vi.stubGlobal('fetch', fetcher);
    const ui = surface('newsletter');
    await ui.submit();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(trackLead).toHaveBeenCalledWith(
      'newsletter',
      expect.any(String),
      expect.any(Object),
      expect.any(Object)
    );
  });
});
