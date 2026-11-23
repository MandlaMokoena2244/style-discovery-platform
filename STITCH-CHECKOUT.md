# Stitch Express test checkout

This branch targets **dev**, never main. Checkout is disabled by default.
No live payments, order fulfilment, storage, or email are implemented.

## Official references

- https://express.stitch.money/api/openapi.json (request/response fields)
- https://express.stitch.money/api-docs/quickstart (test credentials, JSON token request, 15-minute bearer token)
- https://express.stitch.money/api-docs/webhooks (Svix delivery and payment.paid payload)
- https://docs.svix.com/receiving/verifying-payloads/how-manual (raw bytes, HMAC-SHA256, base64, rotation)
- https://express.stitch.money/api-docs/redirect-urls (registered redirect_url parameter)

Reviewed 23 November 2026. This uses Express REST, not Enterprise GraphQL.

## Cloudflare Pages preview configuration

In project **fashforge**, configure these variables for **Preview only**:

| Variable | Value |
| --- | --- |
| CHECKOUT_ENABLED | true |
| STITCH_MODE | test |
| STITCH_CLIENT_ID | Express test client ID, starting with test- |
| STITCH_CLIENT_SECRET | Express test secret, starting with test-; encrypted secret |
| STITCH_WEBHOOK_SECRET | Signing secret returned when registering the test webhook; encrypted secret |
| STITCH_SITE_URL | Exact HTTPS preview origin, without a path or trailing slash |

Leave production checkout disabled and do not add live credentials. Browser code
never receives credentials. The API independently requires CHECKOUT_ENABLED=true,
STITCH_MODE=test and test-prefixed credentials. These guards cannot be bypassed by
changing the browser flag. A prefix mismatch fails closed; resolve any mismatch
against your account's official documentation, never weaken the guard for live keys.

Keep the static output directory at the repository root so Pages discovers
functions/api/*.js. No npm dependency or static-site build step is needed.
Local secrets belong in ignored .dev.vars; .dev.vars.example contains placeholders only.

## One-time Stitch registration

Use your test credentials with the documented POST /api/v1/token JSON fields
clientId, clientSecret and scope=client_paymentrequest. Keep the resulting
data.accessToken server-side. Do not paste credentials or tokens into GitHub.

Register the preview endpoint with POST /api/v1/webhook, JSON field url:

    https://<actual-preview-host>/api/stitch-webhook

Use the actual URL shown by Cloudflare for feature/stitch-checkout. Do not assume
the branch alias spelling. Store data.secret from the registration response as
STITCH_WEBHOOK_SECRET in that preview environment and redeploy.
Keep existing live webhook destinations unchanged. The webhook payload has no
test/live discriminator, so use a dedicated test endpoint and its signing secret.

Register this exact callback with POST /api/v1/redirect-urls, JSON field redirectUrl:

    https://<actual-preview-host>/checkout-success.html

STITCH_SITE_URL must match that origin. Express allows at most five registered
redirect URLs; register a stable preview alias where available. This handler
appends the documented redirect_url parameter to the returned payment link.

## Preview test steps

1. Set checkoutEnabled: true in site-config.js on the feature branch (or a
   disposable test branch based on it), leaving showOutfits: false. Deploy a
   Cloudflare preview, configure the variables above, and register its URLs.
   Restore checkoutEnabled: false before merging into dev.
2. Open a product, choose an available size, add it to the cart, and enter test
   name, email, SA mobile and address. Choose door-to-door or locker delivery.
   For locker delivery use the locker address; there is no locker lookup yet.
3. Confirm the total: products.json prices are rand amounts; the server converts
   to integer cents. Door delivery is R99, locker R70, free from R2,000.
4. Checkout redirects to the Express test payment link. Verify that Stitch shows
   test mode and use only test inputs from its official test guide:
   https://support.express.stitch.money/hc/en-us/articles/52813974171153-Completing-a-test-card-payment-in-an-Express-API-integration
5. Check Pages Function logs for a verified PAID event and a 200 webhook response.
   Verify missing/tampered signatures return 400 and timestamps outside five
   minutes fail. A browser redirect is never proof of payment.
6. Check empty carts, missing/invalid sizes, unavailable products, invalid SA
   contact details and quantities. API requests with forged prices must still
   charge catalogue prices; malformed/oversized JSON must fail.
7. Check both return pages at desktop/mobile widths. Both are noindex and retain
   the cart. With checkoutEnabled: false the original paused message returns.

Local checks:

    node --test test/stitch.test.mjs test/payfast.test.js
    node --check script.js
    npx wrangler@4 pages functions build --outdir ../cf-build

Verification in the implementation environment: Node tests and JavaScript syntax
checks run locally. The Cloudflare bundle command could not run because npx is
not installed, and browser preview timed out. Run the bundle check and visual
preview checks above before merging; no authenticated Stitch payment was attempted.

## TODOs and open questions

- Store validated cart lines, sizes, address and server totals against the
  generated merchant reference before creating a payment. Currently they are
  validated but not retained; the link receives name/email/phone and total only.
  This is a test integration, not a fulfilment system.
- The Express create-link schema does not accept a pre-collected address.
  Its delivery-detail POST only documents deliveryFee. Do not invent address
  fields. Confirm supported address submission with Stitch or add order storage.
  Shipping is included once in amount with collectDeliveryDetails=false.
- Express documents one redirect_url for links, not separate success/cancel
  URLs or a reliable cancellation status parameter. The neutral success return
  page links to checkout-cancelled.html. Automatic cancellation routing remains
  pending a documented contract; neither page infers payment status.
- Before order processing/email, persist and deduplicate svix-id, reconcile the
  payment with the stored reference/amount, and add idempotent checkout attempts.
  Webhook retries currently only repeat a status log. Network failure after link
  creation may leave an unused link; retries create another. Links expire in
  30 minutes. Do not use this flow for real orders.
- Add rate limiting at Cloudflare before any broader rollout and confirm locker
  selection requirements. There is no database, inventory reservation or email.
- An authenticated end-to-end test requires the account's test credentials and
  webhook/redirect registration. Automated tests mock Express; they do not prove
  account access or a successful hosted payment.
