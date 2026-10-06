# Enquiry measurement verification

A genuine enquiry counts only after Resend accepts the sales notification.
Formspree acceptance alone does not count. Visitor confirmation failure does
not invalidate the enquiry. Provider acceptance does not guarantee inbox delivery.

## Local verification

Run `pnpm validate` and `pnpm check:prettier`. The submission tests mock both
providers and assert sales acceptance, honeypot suppression, duplicate-submit
protection, captured page context and matching event IDs. Bootstrap tests cover
GA4-only, Ads-only, both, neither and repeated Astro page initialization.

Use mocked providers when checking the contact form and enquiry dialog in a
browser. Confirm failed sales notification retains inputs and reveals contact
fallbacks; accepted sales with failed confirmation offers the brochure link.
Do not send test leads to live providers or ad platforms during local QA.

## Google Ads read-only checklist

1. Open the Website conversion action “Submit lead form” and its event snippet.
   Compare its ID and label against `PUBLIC_GOOGLE_ADS_ID` and
   `PUBLIC_GOOGLE_ADS_CONVERSION_LABEL` in `wrangler.jsonc` (or the deployment’s
   public build overrides). The configured pair at this change is
   `AW-18447056516/as-bCLOjg4cdEIT9ntxE`.
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

No qualification or sale events are emitted. Newsletter signup remains a
separate event without a Google Ads lead conversion. Closing the page before
the sales acceptance response or blocking measurement scripts can lose browser
tracking; durable server-side measurement requires a separate implementation.
