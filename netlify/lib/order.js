const crypto = require('crypto');
const { OUTFIT_ID_RE, STOCK, OUTFITS, PIECES, PIECE_BY_CODE, SA_PROVINCES } = require('./catalogue');
const { generateSignature } = require('./signature');

const MAX_QTY = 10;
const FIELD_ORDER = [
    'merchant_id',
    'merchant_key',
    'return_url',
    'cancel_url',
    'notify_url',
    'name_first',
    'name_last',
    'email_address',
    'cell_number',
    'm_payment_id',
    'amount',
    'item_name',
    'item_description',
    'custom_str1',
    'custom_str2',
    'custom_str3',
    'custom_str4',
    'email_confirmation'
];

class CheckoutError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;
        this.publicMessage = true;
    }
}

function johannesburgParts(date) {
    const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Johannesburg',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    });
    const parts = {};
    for (const part of fmt.formatToParts(date)) {
        if (part.type !== 'literal') parts[part.type] = part.value;
    }
    return parts;
}

function makeOrderRef(now = new Date(), randomInt = (max) => crypto.randomInt(max)) {
    const parts = johannesburgParts(now);
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += alphabet[randomInt(alphabet.length)];
    return 'FF-' + parts.year.slice(2) + parts.month + parts.day + '-' + code;
}

function formatWhen(now = new Date()) {
    const parts = johannesburgParts(now);
    return parts.year + '-' + parts.month + '-' + parts.day + ' ' + parts.hour + ':' + parts.minute;
}

function normaliseMobile(input) {
    let digits = String(input || '').replace(/[\s()-]/g, '');
    if (digits.startsWith('+27')) digits = '0' + digits.slice(3);
    else if (digits.startsWith('27') && digits.length === 11) digits = '0' + digits.slice(2);
    if (!/^0[6-8]\d{8}$/.test(digits)) return '';
    return digits;
}

function cleanLine(value, max) {
    return String(value || '').replace(/[\r\n|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function validateCustomer(input) {
    const src = input && typeof input === 'object' ? input : {};
    const name = cleanLine(src.name, 100);
    if (name.length < 2 || !/^[\p{L}][\p{L} .'\-]*$/u.test(name)) {
        throw new CheckoutError('Enter your full name.');
    }
    const email = cleanLine(src.email, 100);
    if (email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new CheckoutError('Enter a valid email address.');
    }
    const mobile = normaliseMobile(src.mobile);
    if (!mobile) throw new CheckoutError('Enter a South African mobile number.');
    const street = cleanLine(src.street, 120);
    const suburb = cleanLine(src.suburb, 80);
    const city = cleanLine(src.city, 60);
    if (street.length < 3) throw new CheckoutError('Enter the street address.');
    if (suburb.length < 2) throw new CheckoutError('Enter the suburb.');
    if (city.length < 2) throw new CheckoutError('Enter the city.');
    if (street.includes(':') || suburb.includes(':') || city.includes(':')) {
        throw new CheckoutError('Please remove colons from the address.');
    }
    const province = String(src.province || '').trim();
    if (!SA_PROVINCES.includes(province)) throw new CheckoutError('Select a province.');
    const postalCode = String(src.postalCode || '').trim();
    if (!/^\d{4}$/.test(postalCode)) throw new CheckoutError('Enter a 4-digit postal code.');
    const note = cleanLine(src.note, 200);
    return { name, email, mobile, street, suburb, city, province, postalCode, note };
}

function asQty(value) {
    const qty = Number(value);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
        throw new CheckoutError('Each item needs a quantity from 1 to ' + MAX_QTY + '.');
    }
    return qty;
}

function sizeMap(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    return raw;
}

function priceItem(raw) {
    if (!raw || typeof raw !== 'object') throw new CheckoutError('An item in the cart is not valid.');
    const qty = asQty(raw.qty);
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';

    if (OUTFIT_ID_RE.test(id)) {
        const outfit = OUTFITS[id];
        if (!outfit) throw new CheckoutError('An item in the cart is no longer available.');
        const sizes = sizeMap(raw.sizes);
        if (!sizes) throw new CheckoutError('Choose a size for each piece in ' + outfit.name + '.');
        const chosen = {};
        for (const piece of outfit.pieces) {
            const size = sizes[piece.key] == null ? '' : String(sizes[piece.key]).trim();
            if (!STOCK[piece.stockId].includes(size)) {
                throw new CheckoutError('Choose an in-stock size for ' + outfit.name + '.');
            }
            chosen[piece.key] = size;
        }
        const extra = Object.keys(sizes).filter((key) => !outfit.pieces.some((piece) => piece.key === key));
        if (extra.length) throw new CheckoutError('An item in the cart is not valid.');
        return {
            outfitId: id,
            name: outfit.name,
            qty,
            sizes: chosen,
            pieces: outfit.pieces,
            unitCents: outfit.price * 100,
            lineCents: outfit.price * 100 * qty
        };
    }

    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    const piece = PIECES[name];
    if (!piece) throw new CheckoutError('An item in the cart is no longer available.');
    const size = raw.size == null ? '' : String(raw.size).trim();
    if (!STOCK[piece.stockId].includes(size)) {
        throw new CheckoutError('Choose an in-stock size for ' + name + '.');
    }
    return {
        pieceCode: piece.code,
        name,
        qty,
        size,
        label: piece.label,
        unitCents: piece.price * 100,
        lineCents: piece.price * 100 * qty
    };
}

function priceCart(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new CheckoutError('Your cart is empty.');
    }
    if (items.length > 12) throw new CheckoutError('Please order fewer items at a time.');
    const lines = items.map(priceItem);
    const totalCents = lines.reduce((sum, line) => sum + line.lineCents, 0);
    return { lines, totalCents, deliveryFeeCents: 0 };
}

function deliveryToken(city) {
    return city.replace(/[|:]/g, ' ').replace(/\s+/g, ' ').trim();
}

function sizePairs(line) {
    if (line.outfitId) {
        return line.pieces.map((piece) => piece.key + '=' + line.sizes[piece.key]).join(',');
    }
    return '';
}

function compactSummary(lines, customer) {
    const parts = ['v1'];
    for (const line of lines) {
        if (line.outfitId) {
            parts.push(line.outfitId + ':' + sizePairs(line) + ':' + line.qty);
        } else {
            parts.push(line.pieceCode + ':' + line.size + ':' + line.qty);
        }
    }
    parts.push('D:' + deliveryToken(customer.city) + ':' + customer.postalCode);
    return parts.join('|');
}

function packSummary(summary) {
    if (summary.length <= 255) return { custom_str1: summary };
    const bits = summary.split('|');
    let first = '';
    let index = 0;
    for (; index < bits.length; index++) {
        const next = first ? first + '|' + bits[index] : bits[index];
        if (next.length > 255) break;
        first = next;
    }
    if (!first || index === 0 || index >= bits.length) {
        throw new CheckoutError('This order is too large to pay in one go. Please remove an item.');
    }
    const custom4 = 'v1c|' + bits.slice(index).join('|');
    if (custom4.length > 255) {
        throw new CheckoutError('This order is too large to pay in one go. Please remove an item.');
    }
    return { custom_str1: first, custom_str4: custom4 };
}

function readSummary(fields) {
    let summary = fields.custom_str1 || '';
    const extra = fields.custom_str4 || '';
    if (extra.startsWith('v1c|')) summary += '|' + extra.slice('v1c|'.length);
    return summary;
}

function parseSummary(summary) {
    const parts = String(summary || '').split('|');
    if (parts[0] !== 'v1') throw new CheckoutError('The order summary could not be read.');
    const items = [];
    let delivery = null;
    for (const part of parts.slice(1)) {
        if (part.startsWith('D:')) {
            const bits = part.split(':');
            if (bits.length !== 3) throw new CheckoutError('The order summary could not be read.');
            delivery = { city: bits[1], postalCode: bits[2] };
            continue;
        }
        const bits = part.split(':');
        if (bits.length !== 3) throw new CheckoutError('The order summary could not be read.');
        const qty = Number(bits[2]);
        if (OUTFIT_ID_RE.test(bits[0])) {
            const sizes = {};
            if (!bits[1]) throw new CheckoutError('The order summary could not be read.');
            for (const pair of bits[1].split(',')) {
                const eq = pair.indexOf('=');
                if (eq <= 0) throw new CheckoutError('The order summary could not be read.');
                sizes[pair.slice(0, eq)] = pair.slice(eq + 1);
            }
            items.push({ id: bits[0], qty, sizes });
        } else if (PIECE_BY_CODE[bits[0]]) {
            items.push({ name: PIECE_BY_CODE[bits[0]].name, qty, size: bits[1] });
        } else {
            throw new CheckoutError('The order summary could not be read.');
        }
    }
    if (!items.length || !delivery) throw new CheckoutError('The order summary could not be read.');
    return { items, delivery };
}

function describeLine(line) {
    if (line.outfitId) {
        const sizes = line.pieces.map((piece) => piece.label + ' ' + line.sizes[piece.key]).join(', ');
        return line.outfitId + ' ' + line.name + ' (' + sizes + ') x' + line.qty;
    }
    return line.name + ' (' + line.label + ' ' + line.size + ') x' + line.qty;
}

function splitName(name) {
    const parts = name.split(' ');
    if (parts.length === 1) return { name_first: parts[0], name_last: parts[0] };
    return { name_first: parts[0], name_last: parts.slice(1).join(' ') };
}

function clip(value, max) {
    const text = String(value);
    return text.length <= max ? text : text.slice(0, max - 3) + '...';
}

function buildCheckout(body, config, now = new Date(), randomInt) {
    const customer = validateCustomer(body && body.customer);
    const priced = priceCart(body && body.items);
    const orderRef = makeOrderRef(now, randomInt);
    const amount = (priced.totalCents / 100).toFixed(2);
    const summary = packSummary(compactSummary(priced.lines, customer));
    // Mobile is repeated here because PayFast's ITN customer block does not
    // list cell_number. custom_str2 is posted back with the payment.
    const address = [customer.street, customer.suburb, customer.city, customer.province, customer.postalCode, customer.mobile].join('|');
    if (address.length > 255) throw new CheckoutError('Please shorten the delivery address.');
    const names = splitName(customer.name);
    const description = clip(priced.lines.map(describeLine).join('; '), 255);
    const data = {
        merchant_id: config.merchantId,
        merchant_key: config.merchantKey,
        return_url: config.siteUrl + '/payment-success.html',
        cancel_url: config.siteUrl + '/payment-cancelled.html',
        notify_url: config.siteUrl + '/.netlify/functions/payfast-notify',
        name_first: clip(names.name_first, 100),
        name_last: clip(names.name_last, 100),
        email_address: customer.email,
        cell_number: customer.mobile,
        m_payment_id: orderRef,
        amount,
        item_name: clip('FashForge ' + orderRef, 100),
        item_description: description,
        custom_str1: summary.custom_str1,
        custom_str2: address
    };
    if (customer.note) data.custom_str3 = customer.note;
    if (summary.custom_str4) data.custom_str4 = summary.custom_str4;
    data.email_confirmation = '1';

    const ordered = {};
    for (const key of FIELD_ORDER) {
        if (data[key] !== undefined) ordered[key] = data[key];
    }
    ordered.signature = generateSignature(ordered, config.passphrase);

    return {
        orderRef,
        processUrl: config.processUrl,
        amount,
        fields: ordered,
        order: orderRecord({
            orderRef,
            customer,
            lines: priced.lines,
            totalCents: priced.totalCents,
            payfastPaymentId: '',
            when: formatWhen(now)
        })
    };
}

function amountsMatch(expectedCents, gross) {
    const paid = Number(gross);
    if (!Number.isFinite(paid)) return false;
    return Math.abs(expectedCents - Math.round(paid * 100)) <= 1;
}

function customerFromFields(fields) {
    const addressParts = String(fields.custom_str2 || '').split('|');
    if (addressParts.length !== 6) throw new CheckoutError('The delivery address could not be read.');
    const [street, suburb, city, province, postalCode, storedMobile] = addressParts;
    let name = [fields.name_first, fields.name_last].filter(Boolean).join(' ').trim();
    if (fields.name_first && fields.name_first === fields.name_last) name = fields.name_first;
    return validateCustomer({
        name,
        email: fields.email_address,
        mobile: storedMobile || fields.cell_number,
        street,
        suburb,
        city,
        province,
        postalCode,
        note: fields.custom_str3 || ''
    });
}

function orderFromItn(fields) {
    const summary = parseSummary(readSummary(fields));
    const priced = priceCart(summary.items);
    const customer = customerFromFields(fields);
    if (deliveryToken(customer.city) !== summary.delivery.city || customer.postalCode !== summary.delivery.postalCode) {
        throw new CheckoutError('The delivery details do not match the order.');
    }
    return {
        customer,
        lines: priced.lines,
        totalCents: priced.totalCents,
        orderRef: String(fields.m_payment_id || '').trim()
    };
}

function orderRecord({ orderRef, customer, lines, totalCents, payfastPaymentId, when, status = 'PAID' }) {
    const address = [customer.street, customer.suburb, customer.city, customer.province, customer.postalCode].join(', ');
    const addressWithNote = customer.note ? address + '. Note: ' + customer.note : address;
    const outfitIds = lines.filter((line) => line.outfitId).map((line) => line.outfitId);
    return {
        orderRef,
        date: when,
        status,
        customerName: customer.name,
        email: customer.email,
        mobile: customer.mobile,
        address: addressWithNote,
        outfitIds: outfitIds.join(', '),
        itemsWithSizes: lines.map(describeLine).join('; '),
        total: (totalCents / 100).toFixed(2),
        payfastPaymentId: payfastPaymentId || '',
        deliveryFee: '0.00',
        lines: lines.map(describeLine)
    };
}

module.exports = {
    CheckoutError,
    FIELD_ORDER,
    makeOrderRef,
    formatWhen,
    normaliseMobile,
    validateCustomer,
    priceCart,
    compactSummary,
    packSummary,
    readSummary,
    parseSummary,
    buildCheckout,
    amountsMatch,
    orderFromItn,
    orderRecord,
    describeLine
};
