# Stitch Express test checkout and orders

This branch targets **dev**, never main. The temporary enable commit 0d04294 has
been reverted: site-config.js defaults to checkoutEnabled:false. showOutfits stays
false. Preview can enable checkout through the public server flag described below.
All payment/order operations require STITCH_MODE=test and a test- client ID.
No live payments or physical fulfilment are enabled. Confirmation emails are real
emails labelled TEST; use addresses you control during preview testing.

## Cloudflare Pages Preview setup

Project: **fashforge**. Keep the repository root as the static output directory.
Pages discovers functions/api/*.js. Plain JSON imports support Wrangler 3.114.
No runtime npm dependency or static build step is required.

Create a dedicated **test KV namespace**, for example fashforge-orders-preview.
In the project's **Preview** environment, add a **KV namespace binding** named
**ORDERS**, select that namespace, and redeploy. Do not bind production data.
The namespace ID is not hardcoded in the repository. Missing ORDERS fails checkout
before creating a payment link. ORDERS is a binding, not a .dev.vars string.

Configure these variables in **Preview only**:

| Variable | Value |
| --- | --- |
| CHECKOUT_ENABLED | true |
| STITCH_MODE | test |
| STITCH_CLIENT_ID | Express test client ID, starting with test- |
| STITCH_CLIENT_SECRET | Encrypted opaque test client secret; no prefix required |
| STITCH_WEBHOOK_SECRET | Encrypted base64 test signing secret; optional whsec_ prefix |
| STITCH_SITE_URL | Exact HTTPS preview origin, without path/trailing slash |
| ORDER_NOTIFY_EMAIL | Owner's address for full test order details |
| ORDER_FROM_EMAIL | Sender address on a domain verified in Resend |
| RESEND_API_KEY | Encrypted Resend sending API key |

Leave production unchanged. Secrets never appear in browser JS or responses.
Local secrets belong in ignored .dev.vars; .dev.vars.example contains placeholders.

## Product buttons and public checkout flag

GET /api/site-config returns only {checkoutEnabled:boolean} with Cache-Control:no-store.
It returns true only when CHECKOUT_ENABLED=true, STITCH_MODE=test, a test-prefixed
client ID and a nonempty secret are configured. No keys or other environment values
are returned. /api/checkout still independently enforces its server-side guards.

The browser fetches this flag before rendering the catalogue and initializing the
cart. A valid server boolean overrides site-config.js (including server false over
a local true); missing/unreachable/invalid responses retain the local default false.
This keeps Preview enabled after reverting the temporary flag without changing
production. Set the variables in Preview only and redeploy after changes.

All current product/outfit detail URLs use product.html and catalogue-ui.js; no
standalone HTML product order button was found. When enabled, the primary button
is Add to cart with selected size/quantity validation and visible added feedback.
The existing cart count/drawer updates, and checkout posts only id/size/qty (not
browser prices). Order on WhatsApp is a smaller secondary link. When disabled,
WhatsApp is the main action, using the selected size/quantity and delivery choice.
Outfits remain hidden; the shared outfit handler maps pieces to sellable catalogue
product IDs instead of submitting unsupported outfit IDs. An unavailable/non-standalone
piece blocks that outfit checkout with an explanation.

## Stitch registration

Use POST /api/v1/token with clientId, clientSecret and scope=client_paymentrequest.
Keep data.accessToken server-side. Register the endpoint via POST /api/v1/webhook,
JSON field url:

    https://<actual-feature-preview-host>/api/stitch-webhook

Store returned data.secret as STITCH_WEBHOOK_SECRET. Preserve live webhook
destinations. Payloads have no test/live flag: use a dedicated test endpoint/secret.
The handler additionally re-fetches payment links using test client credentials.

Register this callback via POST /api/v1/redirect-urls, JSON field redirectUrl:

    https://<actual-feature-preview-host>/checkout-success.html

The link's redirect_url includes that callback with ?ref=<merchantReference>.
Express strips the callback query when matching registered URLs and also appends
reference/payment_id. The page accepts ref or the documented reference fallback;
it never trusts a browser-supplied payment_id/status as proof of payment.

## Storage and lifecycle

POST /api/checkout validates customer/cart and prices from products.json, creates
the test payment link, then awaits ORDERS.put(merchantReference). The redirect is
returned only after storage succeeds. Failed writes return an error without
exposing the payable link; an unused link may remain and expires in 30 minutes.

The record contains reference, mode:test, paymentLinkId, currency:ZAR, customer
name/email/normalized mobile, street/suburb/city/province/postalCode/country:ZA,
optional delivery note, deliveryMethod, items (id, catalogue name, size, qty,
unitPrice), subtotal, deliveryFee, total, status:pending and createdAt.
All stored/API monetary amounts are **integer ZAR cents**. Catalogue prices stay
in rands. Delivery is R99 door/R70 locker, free from R2,000. The address is stored
in KV, not sent as an undocumented Stitch field. Shipping is included once in
amount with collectDeliveryDetails:false.

The documented webhook lacks merchantReference. For LINK events the handler calls
GET /api/v1/payment-links/{linkId}, obtains the reference, and matches the stored
link ID, amount, returned paymentId and PAID status to the signed event. Missing
orders return 503 for retry, including KV propagation delays. Mismatches never
mark paid or send email. Other documented Express product types are acknowledged
without cart side effects.

Express documents only payment.paid webhooks. Failed/cancelled events are not
invented. Unpaid status checks query the link:

| Stitch link state | Order state |
| --- | --- |
| PENDING | pending |
| PAID before its signed webhook is processed | pending |
| CANCELLED | cancelled |
| EXPIRED | failed |
| Reconciled signed PAID webhook | paid |

A decline while the link remains PENDING is not a final failure. Paid markers
take precedence over stale cancellation/expiry writes.

## Deduplication and email

Additional KV records:

- paid:<reference>: paymentId/paidAt marker, preserving paid status
- event:<svix-id>: completed delivery receipt
- email:<reference>:owner and email:<reference>:customer: sent/skipped receipts

A paid order triggers two Resend POST https://api.resend.com/emails requests with
bearer auth: complete operational plain text to the owner (including catalogue SKU),
and a branded HTML + plain-text customer confirmation. Stable per-order/per-recipient Idempotency-Key headers protect
against concurrent deliveries while KV receipts are propagating.

The event receipt is saved only after both emails are sent or explicitly skipped.
Email/API/KV failures return non-2xx so Stitch retries; completed recipient receipts
prevent resending an owner email when only the customer email failed.
Missing RESEND_API_KEY skips/logs email without failing the webhook. Missing
sender/owner settings are also logged/skipped. Skipped messages are not backfilled
automatically after settings change.

KV is eventually consistent, with no atomic compare-and-set. Resend retains
idempotency keys for 24 hours. Automatic sends stop 23 hours after provider paidAt
(order creation is the fallback if absent), recording retry_window_expired for
manual review rather than risking a duplicate outside that retention window.
Do not change sender/recipient settings mid-retry: the body must remain identical
for a reused idempotency key. A strict exactly-once fulfilment transaction requires
a Durable Object or transactional database before any live rollout.

Records currently have no automatic expiry. Restrict access and clear the
dedicated namespace when test data is no longer needed. Do not remove receipts
while leaving orders available for replay.

## Customer page and status API

GET /api/order-status?ref=... returns only JSON {status,total}, Cache-Control:no-store,
and no customer/address/items. References are random UUID capabilities; protect
their URLs. The page uses no-referrer. A non-personal X-Order-Confirmation header
reports sent/skipped/pending so the page only says "We've emailed your confirmation"
after Resend accepts the customer email. Acceptance does not guarantee inbox delivery.

The page polls up to eight times over about 106 seconds (plus request time), then
offers a manual check. Pending keeps the cart, paid clears it, and failed/cancelled
keeps it with a retry link. Visiting checkout-cancelled.html does not cancel a
payment or clear the cart. Unpaid polls query Stitch; add Cloudflare rate limits
before broader use.

## Preview test checklist

1. Add ORDERS and the email variables, set CHECKOUT_ENABLED=true and STITCH_MODE=test
   with valid test credentials in Preview, then redeploy. Check /api/site-config
   returns only {"checkoutEnabled":true}; showOutfits remains false.
2. Add a sized product and use an email/address you control. Inspect the pending
   KV record before payment, including catalogue prices, sizes, address and notes.
3. Complete an Express test payment. Check paid status, one owner email with all
   details, one branded customer email, and the return page/cart update.
4. Replay the signed event in Stitch. Confirm no additional email. Simulate a
   transient Resend failure and confirm only unfinished sends retry.
5. Remove RESEND_API_KEY for a new test order: the webhook should still return 200,
   order stays paid, logs say skipped, and the page must not claim it sent email.
6. Test cancellation/expiry, invalid signatures and amount mismatch. PENDING card
   declines stay pending. Unknown references may return 404 during KV propagation.
7. Check desktop/mobile, only status/total in JSON, and cart preservation until paid.
8. Verify the repo default stays false and production has no enabling server flag.
   No additional preview-flag revert is needed.

Local checks (Node 24 for the test-only JSON loader):

    node --test test/stitch.test.mjs test/payfast.test.js
    node --check checkout-status.js
    node --check script.js
    npx wrangler@3.114.0 pages functions build --outdir ../cf-build

The project owner confirmed the previous checkout end-to-end. New order/email
tests use mocked KV, Stitch and Resend; the new Preview binding and real test
delivery still need verification.

## Official sources

- https://express.stitch.money/api/openapi.json
- https://express.stitch.money/api-docs/quickstart
- https://express.stitch.money/api-docs/webhooks
- https://express.stitch.money/api-docs/redirect-urls
- https://docs.svix.com/receiving/verifying-payloads/how-manual
- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/docs/dashboard/emails/idempotency-keys
- https://developers.cloudflare.com/kv/concepts/how-kv-works/
- https://developers.cloudflare.com/kv/api/write-key-value-pairs/

Before any live rollout: transactional concurrency control, checkout-attempt
idempotency, inventory reservation, retention policy, rate limits, locker lookup
and operational handling of emails beyond the retry window remain necessary.

## Branded customer confirmation

`lib/order-email.mjs` builds the customer HTML and equivalent plain text from stored
order values. Reply-To is hello@fashforge.co.za. Test orders have a [TEST] subject
and a black/gold no-dispatch banner; payment guards remain test-only. The email
uses table layout, inline styles, a mobile padding adjustment, escaped content,
Johannesburg dates, and the site's rand formatting. No VAT line or tracking button
is shown. Delivery notes remain owner-only.

Brand, image and internal SKU are looked up by item ID in bundled products.json
at send time. Stored names and prices remain authoritative; all-uppercase names
are title-cased only for customer display. Missing catalogue entries omit brand
and image without blocking delivery. Images use https://www.fashforge.co.za;
the view-order button uses STITCH_SITE_URL. SKU is included only for the owner.

notifyPaidOrder remains the only send path. Receipt keys, skip conditions,
idempotency keys and retry window are unchanged. Builders use no current time
or random values. Keep catalogue, sender, site URL and template deployment stable
during pending retries so Resend receives identical bodies for the same key.
The existing partial-failure test checks exact body equality.

The supplied brief contains design tokens but no actual mockup/screenshots were
available for comparison. Verify desktop/mobile rendering in real mail clients
and a fresh test-order delivery after deployment.
