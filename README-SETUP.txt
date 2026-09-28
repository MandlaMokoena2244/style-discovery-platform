STYLEIT - STREETWEAR PRODUCT + CART SETUP
==========================================

FILES IN THIS FOLDER
--------------------
1. men-full-outfits.html   -> REPLACES your existing file (only change: Streetwear card now links to men-streetwear.html)
2. men-streetwear.html     -> NEW file, copy into your project root (next to index.html)
3. product-streetwear-set.html -> NEW file, copy into your project root
4. css-to-add.css          -> copy ALL of it and PASTE AT THE BOTTOM of your styles.css
5. js-to-add.js            -> copy ALL of it and PASTE AT THE BOTTOM of your script.js

REQUIREMENT
-----------
Your image must be at:  images/streetwear1.png

STEPS IN VS CODE
----------------
1. Copy men-streetwear.html and product-streetwear-set.html into your project root
2. Replace your old men-full-outfits.html with the new one
3. Open styles.css, scroll to the very bottom, paste the contents of css-to-add.css
4. Open script.js, scroll to the very bottom, paste the contents of js-to-add.js
5. Save all files, then open index.html in your browser and navigate:
   Men -> Full Outfits -> Streetwear -> click the product

WHAT YOU GET
------------
- Streetwear listing page showing your outfit with brand, price and "3 Pieces" tag
- Product detail page (info shows after clicking the product):
  full name, price R1,050.00, the 3 pieces listed, size selector (S-XXL),
  quantity selector, Add to Cart button
- Working cart: cart icon in the navbar with item counter, slide-out cart
  drawer showing items/size/quantity, remove buttons, running total,
  and a demo checkout button. Cart is saved in the browser (localStorage),
  so it survives page refreshes.

ADDING MORE PRODUCTS LATER
--------------------------
- Duplicate the product card block in men-streetwear.html (change href, img src, name, price)
- Duplicate product-streetwear-set.html for the new detail page
- In js-to-add.js, the addToCart product object uses a unique 'id' per product

Another commit
STYLEIT - STREETWEAR PRODUCT + CART SETUP (v2 - three size selectors)
====================================================================

WHAT CHANGED IN v2
------------------
The product page now has THREE independent size selectors (one per piece):
  Piece 1 - Boxy top ................... S, M, L, XL, XXL
  Piece 2 - Black wide leg jogger ...... S, M, L, XL, XXL
  Piece 3 - Chunky lace up skater sneaker  UK 6, 7, 8, 9, 10
All three sizes must be chosen before Add to Cart works (it tells
you which piece is missing). The cart stores all three sizes per item
and shows them in the drawer, e.g. "Top M - Jogger L - Shoe 9".

STEPS IN VS CODE (only 2 files change)
--------------------------------------
1. REPLACE your product-streetwear-set.html with the new version
2. In script.js: DELETE the old cart block you pasted previously
   (it starts with the comment "SHOPPING CART (paste at the BOTTOM")
   all the way to the end of the file, then PASTE the new js-to-add.js
   content at the bottom instead.

No CSS changes needed - the new size groups reuse the existing styles.

NOTE: if you still see the old single "Select size" section after
updating, hard-refresh the browser (Ctrl+Shift+R / Cmd+Shift+R).

OTHER FILES (unchanged from v1 - keep as they are)
--------------------------------------------------
- men-full-outfits.html (Streetwear card link)
- men-streetwear.html (listing page)
- css-to-add.css contents pasted at bottom of styles.css