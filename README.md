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

1. Take the next free number for that department (`FF-M-002`, `FF-W-001`, `FF-K-001`, and so on).
2. Put `data-outfit-id="FF-W-001"` on that product's Add to Cart button (and on its listing card).
3. Leave brand product URLs, source links, and supplier details out of the site. Those stay in the private Google Sheet, keyed by the outfit ID.

### Adding a product details block

Copy the Product details section on `product-streetwear-set.html` (outfit `FF-M-001`) and place it below that page's size selectors and add-to-cart area. One card per piece: the piece name as a heading, then a `<dl>` of label/value rows (`<dt>` and `<dd>`, not a table). Reuse the `.product-details` rules in `styles.css`. Above 720px the cards sit side by side in a three-column grid; at 720px and below they stack in one column. Do not add retailer or brand links. This page has no WhatsApp link, so the sizing tip stays plain text. If a future product page already links to WhatsApp, point the words "WhatsApp" in that tip at the same link.
