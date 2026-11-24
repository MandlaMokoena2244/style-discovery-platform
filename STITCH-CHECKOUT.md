# Stitch Express checkout and orders

This change branches from dev into feature/stitch-live. It supports test and live
payments selected only by server environment configuration. It does not change main,
merge branches, configure production, or deploy. site-config.js still defaults to
checkoutEnabled:false and showOutfits:false. PayFast is unchanged.

## Mode and configuration

STITCH_MODE must be exactly test or live. Missing/unknown modes fail closed with a
friendly 503. Client ID and secret must be nonempty strings. Test IDs must start
with test-; live IDs must not. Secrets are opaque and have no prefix requirement.
Both checkout and the public capability endpoint require CHECKOUT_ENABLED=true,
a valid mode/client pair, an HTTPS STITCH_SITE_URL origin, an ORDERS KV binding,
and a nonempty base64 STITCH_WEBHOOK_SECRET (optional whsec_ prefix).
The URL cannot contain credentials, a path beyond /, a query, or a fragment.
Live order operations also require all these services to be configured.

GET /api/site-config returns only checkoutEnabled and checkoutMode (test/live,
or null when disabled), with Cache-Control:no-store. The browser resolves it
before initializing product buttons and the cart. A valid server response overrides
the local flag. A failed or invalid request disables checkout even if the local flag was previously true. The public mode
only controls wording; no request-body or URL field can choose payment mode.

CHECKOUT_ENABLED gates new checkout creation only. Keep credentials, webhook secret
and ORDERS configured when pausing new sales: existing webhooks and status polling
must still finish. Never switch the mode or KV binding to pause payments.

## Cloudflare Pages environments

Project: fashforge. The repository root is the static output directory; Pages
loads functions/api/*.js. No runtime npm packages or build step are required.
JSON imports remain plain imports for Wrangler 3.114's native JSON bundling.

| Setting | Preview | Production |
| --- | --- | --- |
| CHECKOUT_ENABLED | true when testing | false while preparing; true for launch |
| STITCH_MODE | test | live |
| STITCH_CLIENT_ID | Express test- client ID | Express live ID, no test- prefix |
| STITCH_CLIENT_SECRET | encrypted test secret | encrypted live secret |
| STITCH_WEBHOOK_SECRET | test endpoint signing secret | live endpoint signing secret |
| STITCH_SITE_URL | exact HTTPS preview origin | https://www.fashforge.co.za |
| ORDERS KV binding | dedicated test namespace | fashforge-orders-live |
| ORDER_NOTIFY_EMAIL | owner's test address | owner's operational address |
| ORDER_FROM_EMAIL | Resend-verified sender | FashForge sender on verified domain |
| RESEND_API_KEY | encrypted sending key | encrypted production sending key |

Create the namespaces in Cloudflare and select them as bindings named ORDERS in
the appropriate Pages environment. Namespace IDs are not committed. ORDERS is not
a string environment variable. Keep test and live namespaces and credentials
separate. Browser JS never receives any key. .dev.vars.example contains placeholders;
real local credentials belong only in ignored .dev.vars.

## Express authentication and URLs

Reviewed 24 November 2026 against the Express quick start and OpenAPI specification.
The published server is https://express.stitch.money for Express REST; no separate
live host is documented. Both modes use the same POST /api/v1/token JSON contract:
clientId, clientSecret, scope=client_paymentrequest. data.accessToken is used as a
Bearer token for subsequent requests. Credentials select the environment; the
application does not send a mode field to Express. Token cache identity includes
mode, client ID and secret. No Enterprise/Connect or GraphQL endpoints are used.

Use live credentials only after Stitch has enabled your account for live payments.
Test completion alone does not establish live access. Confirm this in the Express
dashboard or with Stitch support before launch. Never copy credentials into a PR.

Register the live webhook using POST /api/v1/webhook with JSON field url:

    https://www.fashforge.co.za/api/stitch-webhook

Save data.secret as Production STITCH_WEBHOOK_SECRET. The receiver accepts the
base64 secret with or without whsec_. Register the preview URL separately using
test credentials. Do not assume test events are isolated by endpoint registration;
Express documents that payment events can be sent to all registered endpoints.
Keep each deployment bound to its own mode and namespace. Do not replace an
existing webhook destination without checking other integrations using it.

Register the live return URL via POST /api/v1/redirect-urls, field redirectUrl:

    https://www.fashforge.co.za/checkout-success.html

The link returned by POST /api/v1/payment-links receives the documented redirect_url
parameter, pointing to that URL with ?ref=<reference>. Register the preview callback
separately. Express matches registered callback paths without the query and allows
up to five registered redirect URLs. There is no separate cancel_url field here.
checkout-cancelled.html is a friendly optional exit page, not proof of cancellation.

## Order lifecycle and mode isolation

Cart inputs are product ID, size and quantity; prices come from products.json.
Catalogue prices are rand amounts, converted server-side to integer ZAR cents.
Door delivery is R99, Courier Guy locker R70, free from R2,000. Delivery is included
exactly once in the payment amount. Empty/invalid/sold-out carts and invalid SA
customer/address details fail before payment creation.

References use crypto.randomUUID(): FF-TEST-<uuid> in test and FF-<uuid> in live.
A pending KV record is written under that reference before exposing the payment
link. It contains mode, customer name/email/normalized mobile/full SA address/note,
delivery method, item ID/name/size/quantity/unit price, subtotal, delivery fee,
total, currency, payment link ID, status and timestamps. Money is integer cents.
If storage fails after link creation, an unused 30-minute link can exist upstream
but is not returned to the customer.

A verified payment.paid LINK webhook is reconciled with an authenticated
GET /api/v1/payment-links/{linkId} using this deployment's credentials. The signed
payload has no mode or merchantReference field. The looked-up reference must have
the current mode's prefix; the stored reference and stored order mode must agree.
The link ID, reference, payment ID and amounts must also match before any paid
marker, order update or email. A foreign-mode reference returns no order, even if
both namespaces were accidentally shared. A test event cannot choose live mode
through a payload field (and vice versa). Invalid signatures are rejected.

Only payment.paid is documented. Status polling reads negative outcomes from the
link: CANCELLED becomes cancelled, EXPIRED becomes failed, PENDING stays pending.
A declined attempt on a still-pending link is not a terminal order failure. PAID
is committed only after a verified webhook, never from the browser redirect.
Unrelated CONSENT/SUBSCRIPTION/TERMINAL events are acknowledged without fulfilment.

GET /api/order-status accepts either reference format but only returns orders for
the deployment's configured mode. It exposes status and total only, with no-store.
The non-personal X-Order-Confirmation header reports sent/skipped/pending. The
return page accepts both reference patterns, polls eight times over about 106
seconds, then offers manual checking. It clears the cart only once paid. It only
claims confirmation was emailed when Resend accepted it; acceptance is not proof
of inbox delivery. Return/cancellation copy is mode-neutral. The cart's test warning
and Checkout (test) label appear only when the server reports test mode.

## Email and deduplication

notifyPaidOrder remains the only send path. KV keys remain:
- paid:<reference>: monotonic payment marker
- event:<svix-id>: completed event receipt
- email:<reference>:owner and email:<reference>:customer: sent/skipped receipts

Live Resend Idempotency-Key values are order-paid/<reference>/<audience>;
test values remain test-order-paid/<reference>/<audience>.
A completed event receipt is written only after both recipient results are stored.
Partial failure retries only unfinished sends. Missing RESEND_API_KEY or missing
sender/owner address records a skip without failing the webhook. Other processing
errors return non-2xx for retry. Pausing checkout does not pause these sends.

The owner receives complete operational plain text, including delivery note and
catalogue SKU. Test owner emails retain [TEST] and TEST ORDER — no fulfilment;
live subjects are New paid order <reference> — R<total>, with no test warning.
Customer emails use branded HTML tables and equivalent plain text, Reply-To
hello@fashforge.co.za, Johannesburg dates and site-style rand formatting. Only test
orders have a [TEST] subject and no-dispatch banner. Live orders have neither.
Images use https://www.fashforge.co.za; the view-order URL uses STITCH_SITE_URL.
Brand/image/SKU are enriched by product ID from bundled products.json; missing
products fall back to stored names without blocking email. SKU and delivery note
remain owner-only. Customer/catalogue HTML strings are escaped.

KV is eventually consistent and cannot ensure an atomic exactly-once transaction.
Resend deduplicates stable keys for 24 hours. Automatic sends stop 23 hours after
provider paidAt (creation-time fallback); late ambiguous sends require manual
review. Keep templates, catalogue enrichment, sender and site URL stable during
pending retries so the body stays identical for a given key. Tests compare exact
retry payloads. Do not replay an old ambiguous send with a new key.

## Preview checks

1. Configure test Preview variables and its dedicated ORDERS namespace; redeploy.
2. Confirm /api/site-config returns enabled true and checkoutMode test. Choose a
   product size/quantity; check cart count/feedback. Purchases use Stitch only; WhatsApp links are for support.
3. Use test customer addresses you control. Confirm authoritative prices/delivery.
4. Complete only the documented Express test-card flow. Confirm a pending record
   becomes paid, one owner/customer email arrives, and the return page clears cart.
5. Replay the webhook, test a partial email failure, and check that retries do not
   duplicate completed sends. Missing Resend key should record skipped email.
6. Verify cancellation, invalid signatures, mode/prefix mismatch and forged amount
   cannot mark paid. Disable checkout and verify existing order processing remains.

## Manual production launch (not performed by this PR)

1. Review and merge through your normal release process separately. This task does
   not merge into dev or main or change Cloudflare deployments.
2. Confirm Stitch live access; create fashforge-orders-live and bind Production
   ORDERS. Set Production variables with CHECKOUT_ENABLED=false initially. Keep
   Preview test configuration separate and unchanged.
3. Register the live webhook and return URL above with live credentials. Save the
   returned signing secret directly into encrypted Production configuration.
4. Configure Resend's verified sender, production sending key and owner mailbox.
5. Manually deploy the reviewed release through the project's Production deployment
   workflow when authorized. Production currently follows main; do not assume
   merging this PR into dev publishes it. No main change is included in this task.
6. Set CHECKOUT_ENABLED=true for Production and redeploy manually when ready.
   Confirm /api/site-config reports live, the cart has no test warning, and the
   correct domain/callback is used. Perform an owner-approved small real payment,
   verify KV, signed webhook, both emails, and status page, and reconcile it in
   Stitch. This PR does not perform a real charge or change environment settings.
7. If pausing sales, set CHECKOUT_ENABLED=false and redeploy; preserve live mode,
   credentials and storage so in-flight paid orders can still complete.

## Validation and remaining operations

Run Node 24: node --test test/stitch.test.mjs test/payfast.test.js.
The test-only JSON loader mirrors Wrangler bundling; no import attributes are used.
Tests mock Stitch, KV and Resend and cover both configuration modes, generated
references, cross-mode rejection, live signed events, privacy, live/test emails,
exact retry bodies, checkout gating and frontend mode behavior. They do not prove
account live activation or real email delivery. The email mockup/screenshots were
not supplied; real mail-client visual QA remains a launch check.

No automatic KV retention policy, inventory reservation, checkout-attempt
idempotency, rate limits, locker lookup or operational retry dashboard exists.
Plan these and reconciliation/late-email recovery before broader live rollout.
KV propagation can delay the return page; failed email retries must be monitored.

## Official references

- https://express.stitch.money/api/openapi.json
- https://express.stitch.money/api-docs/quickstart
- https://express.stitch.money/api-docs/webhooks
- https://express.stitch.money/api-docs/redirect-urls
- https://support.express.stitch.money/hc/en-us/articles/52635905708305-Getting-started-with-the-Stitch-Express-API
- https://support.express.stitch.money/hc/en-us/articles/52813974171153-Completing-a-test-card-payment-in-an-Express-API-integration
- https://docs.svix.com/receiving/verifying-payloads/how-manual
- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/docs/dashboard/emails/idempotency-keys
- https://developers.cloudflare.com/kv/concepts/how-kv-works/

## Website-only purchases

Product and outfit pages use Add to cart and the cart uses Stitch Checkout.
There is no WhatsApp ordering fallback or order-message builder. When the server
flag is false, invalid or unreachable, purchase buttons are disabled and read
Checkout temporarily unavailable. Existing saved cart items remain. General
WhatsApp contact links on the footer/contact page and order-email help links remain.
Mobile card alternate images are always positioned over the first photo and hidden;
only hover-capable screens at least 801px wide reveal the second photo.
