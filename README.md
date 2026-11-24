# style-discovery-platform
A fashion discovery platform that helps users explore clothing styles and connect to retail products through a curated browsing experience.

Indie Nation and LilyCo pieces live in `products.json` and are listed on their brand pages only. Men, Women, Kids, and the homepage stay on "New pieces coming soon" until those pieces are placed there. DE TIAMO has a brand page and no products yet. Do not publish any other brand.

## Adding a product

`products.json` has two arrays, `products` and `outfits`. Listing pages render from that file. `product.html?id=` shows a product that does not have its own page. Leave `paymentLink` empty until a Stitch Express link exists. The public email address is hello@fashforge.co.za, set as `email` in `site-config.js`.

Outfit ids use `FF-<M|W|K>-<3 digits>` (`M` men, `W` women, `K` kids). The next free number is `FF-M-001`, `FF-W-001`, or `FF-K-001`.

Example, not a live product:

```json
{
  "products": [
    {
      "id": "example-top",
      "brand": "Brand name",
      "name": "Example top",
      "category": "women",
      "style": "smart-casual",
      "price": 100,
      "sizes": ["S", "M"],
      "colours": ["Black"],
      "images": ["images/example-top.jpg"],
      "imageAlt": "Example top",
      "description": "Short description.",
      "paymentLink": "",
      "inStock": true,
      "stockId": 1,
      "code": "W-EXAMPLE",
      "label": "Top",
      "sellAlone": true,
      "page": ""
    }
  ],
  "outfits": [
    {
      "id": "FF-W-001",
      "title": "Example outfit",
      "gender": "women",
      "style": "smart-casual",
      "stylePage": "women-smart-casual.html",
      "productIds": ["example-top"],
      "pieces": [
        { "key": "top", "label": "Top", "stockId": 1 }
      ],
      "totalPrice": 100,
      "brand": "Brand name",
      "images": ["images/example-outfit.jpg"],
      "imageAlt": "Example outfit",
      "description": "Short description.",
      "paymentLink": "",
      "inStock": true,
      "page": "",
      "trending": true,
      "tag": "1 Piece"
    }
  ]
}
```

Leave brand product URLs and supplier details out of the site. An empty `sizes` list means that piece is sold out. `sellAlone: false` keeps a piece inside an outfit only. After you add an entry, put the same sizes in `PIECE_STOCK` in `script.js` if that piece is sold from a hand-built page. Card checkout reads prices from `products.json` through `netlify/lib/catalogue.js`.

## Website checkout (Stitch)

Products and outfits use Add to cart, followed by Stitch checkout in the cart.
The browser must receive checkoutEnabled:true from /api/site-config. False,
invalid, missing or failed responses disable purchase buttons with the label
Checkout temporarily unavailable. There is no WhatsApp ordering fallback.
General WhatsApp contact links remain for questions and support.
See [STITCH-CHECKOUT.md](STITCH-CHECKOUT.md) for environment configuration.

## Legacy card payments (PayFast)

The PayFast backend and handlers are retained but are not selected by the current
storefront. The historical PAYMENT_PROVIDER constant does not enable ordering;
the server-provided Stitch flag controls storefront availability.

Door-to-door delivery is R99 and a Courier Guy locker is R70. Delivery is free on orders of R2,000 or more. Those amounts live in `site-config.js`. Card checkout is paused and still charges the item total from `netlify/lib/catalogue.js`, with no courier fee added on that path. When you change a selling price or an in-stock size, update that catalogue as well as the product page and `PIECE_STOCK`.

PayFast order references look like `FF-261004-K7QM` (year, month, day in South Africa, then four characters).

`payment-success.html` and `payment-cancelled.html` are `noindex` and are not in `sitemap.xml`.

### Environment variables

Set these in Netlify (Site configuration, Environment variables). Do not commit them.

| Variable | Purpose |
| --- | --- |
| `PAYFAST_MODE` | `sandbox` or `live`. Chooses `https://sandbox.payfast.co.za/eng/process` or `https://www.payfast.co.za/eng/process`. |
| `PAYFAST_MERCHANT_ID` | From the PayFast dashboard. |
| `PAYFAST_MERCHANT_KEY` | From the PayFast dashboard. |
| `PAYFAST_PASSPHRASE` | Salt passphrase from the PayFast dashboard. Leave unset only if you have not set one. A passphrase is recommended. |
| `SITE_URL` | Site origin, no trailing slash. Defaults to `https://fashforge.co.za`. Return, cancel, and notify URLs are built from this. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Optional. The full service-account JSON key, as one line. |
| `GOOGLE_SHEET_ID` | Optional. The id in the Google Sheet URL. |

Paid orders are always written to the Netlify function log by `recordOrder`. If both Google variables are set, the same order is appended to a tab named `Orders`. If either variable is missing, or Sheets cannot be reached, the log is kept and the payment notification still succeeds. Columns: Order ref, Date, Status, Customer name, Email, Mobile, Address, Outfit IDs, Items with sizes, Total, PayFast payment id. The total is ZAR, for example `1050.00`. Share the sheet with the service account email as an editor, and turn on the Google Sheets API.

PayFast publishes these sandbox examples. They are not the FashForge account. Use your own sandbox merchant so payment notifications reach your site.

Sandbox merchant with a passphrase (this is the one that accepts a signature):

```
PAYFAST_MODE=sandbox
PAYFAST_MERCHANT_ID=10004002
PAYFAST_MERCHANT_KEY=q1cd2rdny4a53
PAYFAST_PASSPHRASE=payfast
SITE_URL=https://fashforge.co.za
```

Older docs also show merchant `10000100` / key `46f0cd694581a` with passphrase `jt7NOE43FZPn`. A signature built with that passphrase is currently rejected by the sandbox. Prefer `10004002` or your own sandbox merchant.

### Owner checklist

1. In Netlify, open Site configuration, then Environment variables. Add the variables above for the production site. For a preview test, set `SITE_URL` to that preview origin so the return and notify URLs match it.
2. Create your own merchant on the PayFast sandbox. Put that merchant id, key, and passphrase in the Netlify variables with `PAYFAST_MODE=sandbox`. Deploy. The live site still shows the orders-paused notice until you change `PAYMENT_PROVIDER`.
3. To try the card form, change `PAYMENT_PROVIDER` to `payfast` on a preview branch (do not do this on main until you mean to). Add an item, fill in the delivery form, and finish the test payment on the PayFast sandbox page. You should land on `payment-success.html`. In Netlify, open the `payfast-notify` function log and confirm the paid order. If the Google variables are set, check the Orders tab.
4. When the live PayFast account is verified, set `PAYFAST_MODE=live` and replace the merchant id, key, and passphrase with the live values. Set `SITE_URL` to `https://fashforge.co.za`.
5. Change `PAYMENT_PROVIDER` to `payfast` and deploy. The cart then takes card payment only.
6. Never commit the merchant key, the passphrase, or the Google service-account JSON.

Still to confirm before the pay button: a short line that delivery is by courier and that customers pay first. That wording is not on the site yet, so it has not been added.

### Checks

`node --test` runs the signature test and the checkout and notification checks. No PayFast call is made.

## Release asset caching

run `node scripts/bump-asset-version.mjs` before every release

Commit the rewritten HTML with the release. The script uses one shared
YYYYMMDDHHmm version in Africa/Johannesburg time for every local stylesheet and
script URL, including site-config, catalogue scripts and checkout-status. It
updates existing v parameters, preserves other query parameters/fragments, and
leaves external URLs, inline scripts and images unchanged. It can be run from
any working directory; reruns within a minute are idempotent.

Cloudflare Pages publishes this static site from the repository root (the folder
containing index.html), with no separate build output. Keep _headers in that root
and include it in the uploaded/published files. There is no existing _redirects
or competing _headers file. If a build output directory is introduced later,
copy _headers there alongside index.html. This PR does not inspect or change the
Cloudflare dashboard; verify the existing Pages output directory remains the root.

_headers revalidates HTML and extension-less pages with no-cache, gives CSS/JS
public, max-age=0, must-revalidate, and caches images for one week. Narrow rules
detach the broad Cache-Control before replacing it so overlapping patterns do
not combine conflicting directives. Pages does not apply _headers to Functions;
/api/site-config and the other APIs retain their own no-store responses.
See [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/).

After an authorized release, check response headers for /, /product, a .html
page, versioned CSS/JS, an image, and /api/site-config. Existing already-fresh
browser caches cannot be retroactively invalidated: the new policy takes effect
when browsers next receive a response. Keep unchanged image filenames; use a new
filename when an image changes and needs immediate refresh during its one-week TTL.
