# Enquiry measurement verification

A genuine enquiry counts only after Resend accepts the sales notification.
Formspree acceptance alone does not count. Visitor confirmation failure does
not invalidate the enquiry. Provider acceptance does not guarantee inbox delivery.

## Local verification

Run `pnpm validate` and `pnpm check:prettier`. The submission tests mock both
providers and assert sales acceptance, honeypot suppression, duplicate-submit
protection, captured page context and matching event IDs. Meta tests cover phone normalization, hashed payloads, captured attribution, acknowledgements and safe background failure logging. Bootstrap tests cover
GA4-only, Ads-only, both, neither and repeated Astro page initialization.

Use mocked providers when checking the contact form and enquiry dialog in a
browser. Confirm failed sales notification retains inputs and reveals contact
fallbacks; accepted sales with failed confirmation offers the brochure link.
Do not send test leads to live providers or ad platforms during local QA.

## Submission deadlines and retries

Formspree requests have an 8-second deadline, including response parsing. The
sales-mail request has a 25-second deadline; each Resend send is bounded at
10 seconds. Provider failures, quota errors and timeouts permit the sales-mail
fallback; named-field validation failures do not.

Unchanged retries in the same form reuse the submission event ID, captured
context and timestamp. A known accepted Formspree submission is not posted
again. Separate Resend idempotency keys protect sales and visitor mail for the
provider's 24-hour window. There is no automatic retry. Editing fields starts a
new submission, and reloading the page loses the in-memory retry state. A
Formspree request whose acceptance is unknown can still produce duplicates.
There is no durable lead store or reconciliation queue.

## Google Ads read-only checklist

1. Open the Website conversion action “Submit lead form V2” and its event snippet.
   Compare its ID and label against `PUBLIC_GOOGLE_ADS_ID` and
   `PUBLIC_GOOGLE_ADS_CONVERSION_LABEL` in `wrangler.jsonc` (or the deployment’s
   public build overrides). The configured pair at this change is
   `AW-18447056516/dJpWCPupxpMdEIT9ntxE`.
2. Verify its diagnostics and the deployed Google tag with Tag Assistant.
   Initial page load, opening a dialog and CTA clicks must not emit the direct
   conversion. A sales-accepted enquiry emits one direct conversion with the
   submission event ID as `transaction_id`.
3. Verify `generate_lead` arrives in GA4. Check that its GA4 import is not also
   an active primary Google Ads goal for the same enquiry. Record discrepancies
   for separate account cleanup; do not change account goals during this fix.
4. Check the configured enhanced-conversion setup against its diagnostics.
   A queued browser event alone does not establish successful Ads attribution.
5. Compare ordinary real enquiries with Worker `customer_mail` logs and sales
   email references after deployment. Do not generate synthetic ad clicks.

## Meta read-only checklist

1. Confirm the production Worker has `META_CAPI_ACCESS_TOKEN` configured and `META_TEST_EVENT_CODE` is absent during ordinary production measurement. Never expose secret values in logs.
2. Compare real accepted sales notifications with `meta_conversion` Worker log lines using the submission event ID. Missing configuration and rejected/network sends are logged without visitor identifiers.
3. Verify Events Manager receives browser and server Lead events with matching IDs and deduplicates them. Review matching quality and phone/email diagnostics.
4. Confirm newsletter signups are browser custom events only. The former public `/api/meta-conversion/` endpoint is removed; arbitrary requests must not create server conversions.

No qualification or sale events are emitted. Newsletter signup remains a separate browser event without a Google Ads lead conversion. Closing the page before the sales acceptance response or blocking measurement scripts can lose browser tracking. Accepted contact enquiries schedule Meta CAPI directly on the Worker with `cfContext.waitUntil`, independently of a second browser request. This is bounded background delivery, not a durable queue: outages and exhausted Worker execution can still lose a server event. There is no automatic retry or qualified-lead/sale upload.
