// Server price catalogue. Client prices are never trusted.
// Selling prices only. No brand links and no cost prices.
// Keep this in step with data-price / data-name on the product pages
// and with PIECE_STOCK in script.js.
// An empty size list means that piece is sold out. Put the sizes back to restock.
//
// Delivery: the site states "Free delivery on orders over R4,000" and
// does not state a delivery fee. The amount charged is the item total.

const OUTFIT_ID_RE = /^FF-[MWK]-\d{3}$/;

const STOCK = {
    1: ['XXS', 'XS', 'S', 'M', 'L'],
    2: ['XXS', 'XS', 'S', 'M', 'L', 'XL'],
    3: ['7', '8', '9'],
    4: ['XS', 'S', 'M', 'L', 'XL'],
    5: ['XS'],
    6: ['XS', 'S'],
    7: ['3', '5', '6', '7', '8'],
    8: ['XXS'],
    9: ['XS', 'S'],
    10: ['One size fits most'],
    11: ['One size fits most'],
    12: ['6', '7', '8'],
    13: ['XXS'],
    14: [],
    15: [],
    16: ['5']
};

const OUTFITS = {
    'FF-M-001': {
        name: 'Boxy Top Streetwear Set',
        price: 1050,
        pieces: [
            { key: 'top', label: 'Top', stockId: 1 },
            { key: 'jogger', label: 'Jogger', stockId: 2 },
            { key: 'shoe', label: 'Shoe', stockId: 3 }
        ]
    },
    'FF-W-001': {
        name: 'Total Diva Stone Set',
        price: 1400,
        pieces: [
            { key: 'top', label: 'Top', stockId: 4 },
            { key: 'pants', label: 'Pants', stockId: 5 }
        ]
    },
    'FF-W-002': {
        name: 'Diva Denim Sneaker Set',
        price: 4700,
        pieces: [
            { key: 'top', label: 'Top', stockId: 4 },
            { key: 'pants', label: 'Pants', stockId: 6 },
            { key: 'sneaker', label: 'Sneaker', stockId: 7 }
        ]
    },
    'FF-W-003': {
        name: 'Orange Linen Co-ord',
        price: 700,
        pieces: [
            { key: 'top', label: 'Top', stockId: 8 },
            { key: 'pants', label: 'Pants', stockId: 9 }
        ]
    },
    'FF-W-004': {
        name: 'Chocolate Knit Co-ord',
        price: 3300,
        pieces: [
            { key: 'cardigan', label: 'Cardigan', stockId: 10 },
            { key: 'pants', label: 'Pants', stockId: 11 },
            { key: 'sneaker', label: 'Sneaker', stockId: 12 }
        ]
    },
    'FF-W-005': {
        name: 'Taupe Waistcoat Set',
        price: 700,
        pieces: [
            { key: 'top', label: 'Top', stockId: 13 },
            { key: 'pants', label: 'Pants', stockId: 5 }
        ]
    },
    'FF-W-006': {
        name: 'Corset and Wide Leg Night Set',
        price: 5500,
        pieces: [
            { key: 'corset', label: 'Corset', stockId: 14 },
            { key: 'jeans', label: 'Jeans', stockId: 15 },
            { key: 'boot', label: 'Boot', stockId: 16 }
        ]
    }
};

// Men's individual pieces. These lines have no outfit ID.
const PIECES = {
    'Boxy Top': { code: 'M-TOP', price: 250, label: 'Top', stockId: 1 },
    'Black Wide Leg Graphic Jogger': { code: 'M-JOGGER', price: 500, label: 'Jogger', stockId: 2 },
    'Chunky Lace Up Skater Sneaker': { code: 'M-SHOE', price: 400, label: 'Shoe', stockId: 3 }
};

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
