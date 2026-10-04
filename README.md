# style-discovery-platform
A fashion discovery platform that helps users explore clothing styles and seamlessly connect to retail products through a curated browsing experience.

## Outfit IDs

Every real outfit has an ID in the form `FF-<M|W|K>-<3-digit number>`:

- `M` — men
- `W` — women
- `K` — kids

`FF-M-001` is the Boxy Top Streetwear Set styled by FashForge. Brand: THE FIX. The ID lives on the product as `data-outfit-id` (on the Add to Cart button, and on the listing card). Adding that set to the cart stores the same `id` on the item in `localStorage` under `fashforge_cart`. WhatsApp checkout prints it on the line, for example:

`FF-M-001 — THE FIX — Boxy Top Streetwear Set (Top M, Jogger L, Shoe 9) — Qty: 2 — R2,100.00`

The same three pieces are also sold on their own from Men, Individual Pieces. Piece prices are Boxy Top R250.00, Black Wide Leg Graphic Jogger R500.00, and Chunky Lace Up Skater Sneaker R400.00. The full set stays R1,050.00. A piece added on its own uses that piece price in the cart total and in the WhatsApp order line. Those lines do not use a separate outfit ID.

Each checkout also adds one order reference, `Order ref: FF-` plus the date (`YYYYMMDD`) and a short random code, for example `Order ref: FF-20260929-K7QM`.

Items already in a cart with no `id`, or with an older id that is not this format, still check out. Those lines are sent without an outfit ID.

### Adding a new outfit

1. Take the next free number for that department (`FF-M-002`, `FF-W-007`, `FF-K-001`, and so on). Women's `FF-W-001` to `FF-W-006` are already in use.
2. Put that ID on the product's Add to Cart button (and on its listing card), for example `data-outfit-id="FF-W-007"`.
3. Leave brand product URLs, source links, and supplier details out of the site. Those stay in the private Google Sheet, keyed by the outfit ID.

### Adding a product details block

Copy the Product details section on `product-streetwear-set.html` (outfit `FF-M-001`) and place it below that page's size selectors and add-to-cart area. One card per piece: the piece name as a heading, then a `<dl>` of four rows in this order: Material, Fit, Colour, Care (`<dt>` and `<dd>`, not a table). Reuse the `.product-details` rules in `styles.css`. Above 720px the cards sit side by side in a three-column grid; at 720px and below they stack in one column. Do not add retailer or brand links. This page has no WhatsApp link, so the sizing tip stays plain text. If a future product page already links to WhatsApp, point the words "WhatsApp" in that tip at the same link.

### Women's full outfits

Women, Full Outfits links to four style pages. Each outfit page sets `data-outfit-id` on the Add to Cart button and on the listing card. WhatsApp checkout prints that ID the same way as `FF-M-001`, and it still adds one order reference.

| ID | Name | Set price | Page |
| --- | --- | --- | --- |
| FF-W-001 | Total Diva Stone Set | R1,400.00 | `product-total-diva-stone-set.html` |
| FF-W-002 | Diva Denim Sneaker Set | R4,700.00 | `product-diva-denim-sneaker-set.html` |
| FF-W-003 | Orange Linen Co-ord | R700.00 | `product-orange-linen-coord.html` |
| FF-W-004 | Chocolate Knit Co-ord | R3,300.00 | `product-chocolate-knit-coord.html` |
| FF-W-005 | Taupe Waistcoat Set | R700.00 | `product-taupe-waistcoat-set.html` |
| FF-W-006 | Corset and Wide Leg Night Set | R5,500.00 | `product-corset-wide-leg-night-set.html` |

Style pages:

- Streetwear (`women-streetwear.html`): FF-W-001 and FF-W-002
- Smart Casual (`women-smart-casual.html`): FF-W-003 and FF-W-004
- Formal (`women-formal.html`): FF-W-005
- Evening (`women-evening.html`): FF-W-006

The set price is for the full outfit. Piece names are listed on the outfit page. Brand names are plain text. Brand product URLs and piece prices are not on the site.

In-stock sizes come from `PIECE_STOCK` in `script.js`, keyed by piece id, with `checkedOn` for the date the brand pages were last checked. Each size group sets `data-piece-id` and is left empty. Only sizes in stock are shown. A piece with one size is preselected. The next free women's number is FF-W-007.

## Card payments (PayFast)

Orders still go out on WhatsApp until you flip one switch. In `script.js`:

```js
const PAYMENT_PROVIDER = 'whatsapp'; // change to 'payfast' when card payments should go live
```

- `whatsapp` (the default): the cart keeps the Order on WhatsApp button. Merging this does not turn card payments on.
- `payfast`: that button is replaced by the delivery form and Pay by card. There is no WhatsApp order button in the cart. The contact form still opens WhatsApp.

The amount charged is the item total from `netlify/lib/catalogue.js`. The shop says "Free delivery on orders over R4,000" and does not state a delivery fee, so no delivery fee is added either way. When you change a selling price or an in-stock size, update that catalogue as well as the product page and `PIECE_STOCK`.

PayFast order references look like `FF-261004-K7QM` (year, month, day in South Africa, then four characters). WhatsApp order references stay in the longer `FF-20260929-K7QM` form.

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
2. Create your own merchant on the PayFast sandbox. Put that merchant id, key, and passphrase in the Netlify variables with `PAYFAST_MODE=sandbox`. Deploy. The live site still shows Order on WhatsApp.
3. To try the card form, change `PAYMENT_PROVIDER` to `payfast` on a preview branch (do not do this on main until you mean to). Add an item, fill in the delivery form, and finish the test payment on the PayFast sandbox page. You should land on `payment-success.html`. In Netlify, open the `payfast-notify` function log and confirm the paid order. If the Google variables are set, check the Orders tab.
4. When the live PayFast account is verified, set `PAYFAST_MODE=live` and replace the merchant id, key, and passphrase with the live values. Set `SITE_URL` to `https://fashforge.co.za`.
5. Change `PAYMENT_PROVIDER` to `payfast` and deploy. The cart then takes card payment only.
6. Never commit the merchant key, the passphrase, or the Google service-account JSON.

Still to confirm before the pay button: a short line that delivery is by courier and that customers pay first. That wording is not on the site yet, so it has not been added.

### Checks

`node --test` runs the signature test and the checkout and notification checks. No PayFast call is made.
