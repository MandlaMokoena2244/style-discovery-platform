// Server price catalogue. Client prices are never trusted.
// Selling prices only. No brand links and no cost prices.
// Keep this in step with data-price / data-name on the product pages
// and with PIECE_STOCK in script.js.
// An empty size list means that piece is sold out. Put the sizes back to restock.
//
// Delivery: the site states "Free delivery on orders over R4,000" and
// does not state a delivery fee. The amount charged is the item total.

const OUTFIT_ID_RE = /^FF-[MWK]-\d{3}$/;

// Prices, size lists, and outfit pieces come from products.json.
// Both Barbi colours share stock id 5. Pieces with sellAlone: false stay out of PIECES.
const catalogueData = require('../../products.json');

const STOCK = {};
catalogueData.products.forEach(function(product) {
    if (product.stockId == null) return;
    STOCK[product.stockId] = product.sizes;
});

const OUTFITS = {};
catalogueData.outfits.forEach(function(outfit) {
    OUTFITS[outfit.id] = {
        name: outfit.title,
        price: outfit.totalPrice,
        pieces: outfit.pieces
    };
});

const PIECES = {};
catalogueData.products.forEach(function(product) {
    if (!product.sellAlone || !product.code) return;
    PIECES[product.name] = {
        code: product.code,
        price: product.price,
        label: product.label,
        stockId: product.stockId
    };
});

const PIECE_BY_CODE = Object.fromEntries(
    Object.entries(PIECES).map(([name, piece]) => [piece.code, Object.assign({ name }, piece)])
);

const SA_PROVINCES = [
    'Eastern Cape',
    'Free State',
    'Gauteng',
    'KwaZulu-Natal',
    'Limpopo',
    'Mpumalanga',
    'Northern Cape',
    'North West',
    'Western Cape'
];

function isSoldOut(stockId) {
    const sizes = STOCK[stockId];
    return Array.isArray(sizes) && sizes.length === 0;
}

module.exports = {
    OUTFIT_ID_RE,
    STOCK,
    OUTFITS,
    PIECES,
    PIECE_BY_CODE,
    SA_PROVINCES,
    isSoldOut
};
