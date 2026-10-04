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
