const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
    phpUrlEncode,
    signatureParamString,
    generateSignature,
    itnSignature
} = require('../netlify/lib/signature');
const { STOCK, OUTFITS, PIECES, isSoldOut } = require('../netlify/lib/catalogue');
const { buildCheckout, priceCart, compactSummary, packSummary, readSummary, parseSummary } = require('../netlify/lib/order');
const { readConfig } = require('../netlify/lib/config');
const { handleCheckout } = require('../netlify/functions/payfast-checkout');
const { handleNotify } = require('../netlify/functions/payfast-notify');
const { ipInCidr, ipInPayfastRanges, isPayfastIp, clientIp } = require('../netlify/lib/payfast-ip');
const { HEADERS, recordOrder, rowFromOrder } = require('../netlify/lib/sheets');

const ROOT = path.join(__dirname, '..');

// PayFast's published sandbox example. Not a FashForge account.
const DOCS_PASSPHRASE = 'jt7NOE43FZPn';
const DOCS_STRING = 'merchant_id=10000100&merchant_key=46f0cd694581a&return_url=http%3A%2F%2Fwww.yourdomain.co.za%2Freturn.php&cancel_url=http%3A%2F%2Fwww.yourdomain.co.za%2Fcancel.php&notify_url=http%3A%2F%2Fwww.yourdomain.co.za%2Fnotify.php&name_first=First+Name&name_last=Last+Name&email_address=test%40test.com&m_payment_id=1234&amount=10.00&item_name=Order%23123&passphrase=jt7NOE43FZPn';

const ENV = {
    PAYFAST_MODE: 'sandbox',
    PAYFAST_MERCHANT_ID: '10000100',
    PAYFAST_MERCHANT_KEY: '46f0cd694581a',
    PAYFAST_PASSPHRASE: DOCS_PASSPHRASE,
    SITE_URL: 'https://fashforge.co.za'
};

function customer(overrides) {
    return Object.assign({
        name: 'Anele Dlamini',
        email: 'anele@example.co.za',
        mobile: '+27 67 256 5980',
        street: '12 Main Road',
        suburb: 'Rosebank',
        city: 'Johannesburg',
        province: 'Gauteng',
        postalCode: '2196',
        note: 'Leave at reception'
    }, overrides);
}

function outfitItem(id, sizes, qty) {
    return { id, name: 'client name is ignored', price: 1, qty: qty || 1, sizes };
}

test('signature matches the PayFast documented parameter string', () => {
    const data = {
        merchant_id: '10000100',
        merchant_key: '46f0cd694581a',
        return_url: 'http://www.yourdomain.co.za/return.php',
        cancel_url: 'http://www.yourdomain.co.za/cancel.php',
        notify_url: 'http://www.yourdomain.co.za/notify.php',
        name_first: 'First Name',
        name_last: 'Last Name',
        email_address: 'test@test.com',
        m_payment_id: '1234',
        amount: '10.00',
        item_name: 'Order#123'
    };
    const param = signatureParamString(data, DOCS_PASSPHRASE);
    assert.equal(param, DOCS_STRING);
    const expectedMd5 = crypto.createHash('md5').update(DOCS_STRING).digest('hex');
    assert.equal(expectedMd5, '8317e2bbd1ae2a6f4f36837e83be4ca9');
    assert.equal(generateSignature(data, DOCS_PASSPHRASE), expectedMd5);
});

test('url encoding uses uppercase hex and plus for spaces', () => {
    assert.equal(phpUrlEncode('First Name'), 'First+Name');
    assert.equal(phpUrlEncode('test@test.com'), 'test%40test.com');
    assert.equal(phpUrlEncode('Order#123'), 'Order%23123');
    assert.equal(phpUrlEncode('a b*~'), 'a+b%2A%7E');
});

test('blank fields are skipped and an empty passphrase is not appended', () => {
    const data = { merchant_id: '10000100', merchant_key: '', amount: '10.00', item_name: 'Hat' };
    assert.equal(signatureParamString(data, null), 'merchant_id=10000100&amount=10.00&item_name=Hat');
    assert.equal(signatureParamString(data, '   '), 'merchant_id=10000100&amount=10.00&item_name=Hat');
    assert.equal(
        signatureParamString(data, 'salt'),
        'merchant_id=10000100&amount=10.00&item_name=Hat&passphrase=salt'
    );
});

test('server catalogue matches the product pages and in-stock sizes', () => {
    const outfits = [
        ['product-streetwear-set.html', 'FF-M-001', '1050'],
        ['product-total-diva-stone-set.html', 'FF-W-001', '1400'],
        ['product-diva-denim-sneaker-set.html', 'FF-W-002', '4700'],
        ['product-orange-linen-coord.html', 'FF-W-003', '700'],
        ['product-chocolate-knit-coord.html', 'FF-W-004', '3300'],
        ['product-taupe-waistcoat-set.html', 'FF-W-005', '700'],
        ['product-corset-wide-leg-night-set.html', 'FF-W-006', '5500']
    ];
    for (const [file, id, price] of outfits) {
        const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
        assert.match(html, new RegExp('data-outfit-id="' + id + '"'));
        assert.match(html, new RegExp('data-price="' + price + '"'));
        assert.equal(OUTFITS[id].price, Number(price));
    }
    const pieces = [
        ['product-boxy-top.html', 'Boxy Top', '250'],
        ['product-graphic-jogger.html', 'Black Wide Leg Graphic Jogger', '500'],
        ['product-skater-sneaker.html', 'Chunky Lace Up Skater Sneaker', '400']
    ];
    for (const [file, name, price] of pieces) {
        const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
        assert.match(html, new RegExp('data-name="' + name + '"'));
        assert.match(html, new RegExp('data-price="' + price + '"'));
        assert.equal(PIECES[name].price, Number(price));
        assert.equal(html.includes('data-outfit-id'), false);
    }

    const script = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');
    const start = script.indexOf('const PIECE_STOCK = ');
    const end = script.indexOf('\n};', start);
    const pieceStock = Function('return ' + script.slice(start + 'const PIECE_STOCK = '.length, end + 2))();
    for (const [id, sizes] of Object.entries(STOCK)) {
        assert.deepEqual(pieceStock.pieces[id].sizes, sizes);
    }
});

test('checkout ignores the client price and does not add a delivery fee', async () => {
    const response = await handleCheckout({
        httpMethod: 'POST',
        body: JSON.stringify({
            customer: customer(),
            items: [
                outfitItem('FF-M-001', { top: 'M', jogger: 'L', shoe: '9' }),
                { name: 'Boxy Top', price: 1, qty: 2, size: 'M' }
            ]
        })
    }, {
        env: ENV,
        now: new Date('2026-10-04T12:00:00Z'),
        randomInt: () => 0
    });
    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    // 1050 + 250 * 2. Under R4,000, and the site states no other delivery fee.
    assert.equal(body.amount, '1550.00');
    assert.equal(body.orderRef, 'FF-261004-AAAA');
    assert.equal(body.processUrl, 'https://sandbox.payfast.co.za/eng/process');
    assert.equal(body.fields.amount, '1550.00');
    assert.equal(body.fields.m_payment_id, 'FF-261004-AAAA');
    assert.equal(body.fields.cell_number, '0672565980');
    assert.equal(body.fields.return_url, 'https://fashforge.co.za/payment-success.html');
    assert.equal(body.fields.cancel_url, 'https://fashforge.co.za/payment-cancelled.html');
    assert.equal(body.fields.notify_url, 'https://fashforge.co.za/.netlify/functions/payfast-notify');
    assert.match(body.fields.custom_str1, /FF-M-001:top=M,jogger=L,shoe=9:1/);
    assert.match(body.fields.custom_str1, /M-TOP:M:2/);
    assert.match(body.fields.custom_str1, /D:Johannesburg:2196/);
    assert.match(body.fields.custom_str2, /0672565980/);
    assert.equal(body.fields.custom_str3, 'Leave at reception');
    assert.equal(response.body.includes(DOCS_PASSPHRASE), false);
    const unsigned = Object.assign({}, body.fields);
    delete unsigned.signature;
    assert.equal(body.fields.signature, generateSignature(unsigned, DOCS_PASSPHRASE));
});

test('a long cart summary splits across PayFast custom fields and still reprices', () => {
    const items = [
        outfitItem('FF-M-001', { top: 'XXS', jogger: 'XXS', shoe: '7' }, 10),
        outfitItem('FF-W-001', { top: 'XS', pants: 'XS' }, 10),
        outfitItem('FF-W-002', { top: 'XL', pants: 'S', sneaker: '3' }, 10),
        outfitItem('FF-W-003', { top: 'XXS', pants: 'S' }, 10),
        outfitItem('FF-W-004', { cardigan: 'One size fits most', pants: 'One size fits most', sneaker: '6' }, 10),
        outfitItem('FF-W-005', { top: 'XXS', pants: 'XS' }, 10),
        outfitItem('FF-W-005', { top: 'XXS', pants: 'XS' }, 10),
        { name: 'Boxy Top', qty: 10, size: 'XXS' },
        { name: 'Black Wide Leg Graphic Jogger', qty: 10, size: 'XXS' },
        { name: 'Chunky Lace Up Skater Sneaker', qty: 10, size: '7' }
    ];
    const priced = priceCart(items);
    const packed = packSummary(compactSummary(priced.lines, { city: 'Johannesburg', postalCode: '2196' }));
    assert.ok(packed.custom_str1.length <= 255);
    assert.ok(packed.custom_str4.length <= 255);
    const again = priceCart(parseSummary(readSummary(packed)).items);
    assert.equal(again.totalCents, priced.totalCents);
    assert.equal(again.deliveryFeeCents, 0);
});

test('an order over R4,000 is still charged the item total only', () => {
    const priced = priceCart([
        outfitItem('FF-W-002', { top: 'M', pants: 'S', sneaker: '7' }),
        outfitItem('FF-W-004', { cardigan: 'One size fits most', pants: 'One size fits most', sneaker: '6' })
    ]);
    assert.equal(priced.deliveryFeeCents, 0);
    assert.equal(priced.totalCents, (4700 + 3300) * 100);
});

function readScriptConst(script, name) {
    const marker = 'const ' + name + ' = ';
    const start = script.indexOf(marker);
    assert.notEqual(start, -1, name);
    const end = script.indexOf('\n};', start);
    return Function('return ' + script.slice(start + marker.length, end + 2))();
}

test('an empty size list means sold out, including a cart that already holds the set', async () => {
    assert.equal(isSoldOut(14), true);
    assert.equal(isSoldOut(15), true);
    assert.equal(isSoldOut(16), false);
    assert.deepEqual(STOCK[14], []);
    assert.deepEqual(STOCK[15], []);

    const stale = await handleCheckout({
        httpMethod: 'POST',
        body: JSON.stringify({
            customer: customer(),
            items: [outfitItem('FF-W-006', { corset: 'S', jeans: '8', boot: '5' })]
        })
    }, { env: ENV });
    assert.equal(stale.statusCode, 400);
    const staleBody = JSON.parse(stale.body);
    assert.equal(staleBody.error, 'Corset and Wide Leg Night Set is sold out. Remove it from your cart.');
    assert.equal(staleBody.error.includes('\u2014'), false);

    const noSizes = await handleCheckout({
        httpMethod: 'POST',
        body: JSON.stringify({
            customer: customer(),
            items: [{ id: 'FF-W-006', qty: 1 }]
        })
    }, { env: ENV });
    assert.equal(noSizes.statusCode, 400);
    assert.equal(JSON.parse(noSizes.body).error, staleBody.error);

    const mixed = await handleCheckout({
        httpMethod: 'POST',
        body: JSON.stringify({
            customer: customer(),
            items: [
                outfitItem('FF-M-001', { top: 'M', jogger: 'L', shoe: '9' }),
                outfitItem('FF-W-006', { corset: 'XL', jeans: '10', boot: '5' })
            ]
        })
    }, { env: ENV });
    assert.equal(mixed.statusCode, 400);
    assert.equal(JSON.parse(mixed.body).error, staleBody.error);

    const badSize = await handleCheckout({
        httpMethod: 'POST',
        body: JSON.stringify({
            customer: customer(),
            items: [outfitItem('FF-M-001', { top: 'XXL', jogger: 'L', shoe: '9' })]
        })
    }, { env: ENV });
    assert.equal(badSize.statusCode, 400);
    assert.match(JSON.parse(badSize.body).error, /in-stock size/);
    assert.equal(JSON.parse(badSize.body).error.includes('sold out'), false);

    const script = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');
    const outfits = readScriptConst(script, 'OUTFIT_PIECE_IDS');
    const singles = readScriptConst(script, 'SINGLE_PIECE_IDS');
    for (const [id, outfit] of Object.entries(OUTFITS)) {
        assert.deepEqual(outfits[id], outfit.pieces.map((piece) => piece.stockId));
    }
    for (const [name, piece] of Object.entries(PIECES)) {
        assert.equal(singles[name], piece.stockId);
    }
    assert.equal(script.includes('No sizes in stock.'), false);
    assert.match(script, /is sold out\. Remove it from your cart\./);

    const helpersEnd = script.indexOf("document.addEventListener('DOMContentLoaded'", script.indexOf('const PIECE_STOCK = '));
    const client = Function(script.slice(script.indexOf('const PIECE_STOCK = '), helpersEnd) + `
        return { pieceIsSoldOut, outfitIsSoldOut, cartLineSoldOut, soldOutCartMessage, PIECE_STOCK };
    `)();
    assert.equal(client.pieceIsSoldOut(14), true);
    assert.equal(client.pieceIsSoldOut(15), true);
    assert.equal(client.pieceIsSoldOut(16), false);
    assert.equal(client.outfitIsSoldOut('FF-W-006'), true);
    assert.equal(client.outfitIsSoldOut('FF-M-001'), false);
    const staleLine = {
        id: 'FF-W-006',
        name: 'Corset and Wide Leg Night Set',
        sizes: { corset: 'S', jeans: '8', boot: '5' }
    };
    assert.equal(client.cartLineSoldOut(staleLine), true);
    assert.equal(client.soldOutCartMessage([staleLine]), staleBody.error);
    assert.equal(client.cartLineSoldOut({ name: 'Boxy Top', size: 'M' }), false);
    client.PIECE_STOCK.pieces[1].sizes = [];
    assert.equal(
        client.soldOutCartMessage([{ name: 'Boxy Top', size: 'M' }]),
        'Boxy Top is sold out. Remove it from your cart.'
    );
    assert.equal(client.soldOutCartMessage([
        staleLine,
        { name: 'Boxy Top', size: 'M' }
    ]), 'Some items are sold out. Remove them from your cart.');

    const evening = fs.readFileSync(path.join(ROOT, 'women-evening.html'), 'utf8');
    const full = fs.readFileSync(path.join(ROOT, 'women-full-outfits.html'), 'utf8');
    const men = fs.readFileSync(path.join(ROOT, 'men-individual-pieces.html'), 'utf8');
    assert.match(evening, /class="item-card outfit-card reveal" data-outfit-id="FF-W-006"/);
    assert.match(full, /data-outfit-id="FF-W-006"/);
    assert.match(men, /data-piece-id="1"/);
    assert.match(men, /data-piece-id="2"/);
    assert.match(men, /data-piece-id="3"/);
});

test('unknown outfits, bad sizes, and missing config are rejected', async () => {
    const badSize = await handleCheckout({
        httpMethod: 'POST',
        body: JSON.stringify({
            customer: customer(),
            items: [outfitItem('FF-M-001', { top: 'XXL', jogger: 'L', shoe: '9' })]
        })
    }, { env: ENV });
    assert.equal(badSize.statusCode, 400);

    const unknown = await handleCheckout({
        httpMethod: 'POST',
        body: JSON.stringify({
            customer: customer(),
            items: [outfitItem('FF-W-999', { top: 'M' })]
        })
    }, { env: ENV });
    assert.equal(unknown.statusCode, 400);

    const missing = await handleCheckout({
        httpMethod: 'POST',
        body: JSON.stringify({ customer: customer(), items: [] })
    }, { env: {} });
    assert.equal(missing.statusCode, 503);
    assert.equal(missing.body.includes('46f0cd694581a'), false);
    assert.equal(missing.body.includes(DOCS_PASSPHRASE), false);
});

test('live mode uses the live PayFast host and defaults the site URL', () => {
    const config = readConfig({
        PAYFAST_MODE: 'live',
        PAYFAST_MERCHANT_ID: '12345678',
        PAYFAST_MERCHANT_KEY: 'live-key',
        SITE_URL: 'https://fashforge.co.za/'
    });
    assert.equal(config.processUrl, 'https://www.payfast.co.za/eng/process');
    assert.equal(config.siteUrl, 'https://fashforge.co.za');
    assert.equal(config.passphrase, null);
});

test('PayFast IP ranges match the notification hosts and not a public resolver', () => {
    assert.equal(ipInCidr('41.74.179.194', '41.74.179.192/27'), true);
    assert.equal(ipInCidr('41.74.179.223', '41.74.179.192/27'), true);
    assert.equal(ipInCidr('41.74.179.224', '41.74.179.192/27'), false);
    assert.equal(ipInCidr('197.97.145.159', '197.97.145.144/28'), true);
    assert.equal(ipInCidr('197.97.145.160', '197.97.145.144/28'), false);
    assert.equal(ipInCidr('102.216.36.13', '102.216.36.0/28'), true);
    assert.equal(ipInCidr('102.216.36.136', '102.216.36.128/28'), true);
    assert.equal(ipInCidr('144.126.193.139', '144.126.193.139/32'), true);
    assert.equal(ipInPayfastRanges('8.8.8.8'), false);
    assert.equal(clientIp({ 'X-NF-Client-Connection-IP': '41.74.179.194' }), '41.74.179.194');
    assert.equal(clientIp({ 'X-Forwarded-For': '1.2.3.4' }), '');
});

test('a resolved PayFast address counts even when it is outside the static ranges', async () => {
    const ok = await isPayfastIp('34.107.176.71', async () => ['34.107.176.71']);
    assert.equal(ok, true);
    const no = await isPayfastIp('8.8.8.8', async () => ['34.107.176.71']);
    assert.equal(no, false);
});

function itnBody(fields, overrides, passphrase) {
    const data = Object.assign({
        m_payment_id: fields.m_payment_id,
        pf_payment_id: '1089250',
        payment_status: 'COMPLETE',
        item_name: fields.item_name,
        item_description: fields.item_description,
        amount_gross: fields.amount,
        amount_fee: '-4.60',
        amount_net: '0.00',
        custom_str1: fields.custom_str1,
        custom_str2: fields.custom_str2,
        name_first: fields.name_first,
        name_last: fields.name_last,
        email_address: fields.email_address,
        merchant_id: fields.merchant_id
    }, overrides);
    if (fields.custom_str3 && data.custom_str3 === undefined) data.custom_str3 = fields.custom_str3;
    if (fields.custom_str4) data.custom_str4 = fields.custom_str4;
    const entries = Object.entries(data).filter(([, value]) => value !== undefined);
    entries.push(['signature', itnSignature(entries, passphrase)]);
    return entries.map(([key, value]) => phpUrlEncode(key) + '=' + phpUrlEncode(value)).join('&');
}

async function checkoutBody(items, env) {
    const response = await handleCheckout({
        httpMethod: 'POST',
        body: JSON.stringify({ customer: customer({ note: '' }), items })
    }, {
        env: env || ENV,
        now: new Date('2026-10-04T12:00:00Z'),
        randomInt: () => 0
    });
    assert.equal(response.statusCode, 200);
    return JSON.parse(response.body);
}

test('a valid ITN is recorded only after signature, source, and amount checks', async () => {
    const built = await checkoutBody([
        outfitItem('FF-W-004', { cardigan: 'One size fits most', pants: 'One size fits most', sneaker: '8' })
    ]);
    assert.equal(built.amount, '3300.00');
    assert.equal(built.fields.custom_str3, undefined);
    const saved = [];
    const response = await handleNotify({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '8.8.8.8' },
        body: itnBody(built.fields, {}, DOCS_PASSPHRASE)
    }, {
        env: ENV,
        now: new Date('2026-10-04T12:00:00Z'),
        fetch: async () => ({ ok: true, text: async () => 'VALID' }),
        recordOrder: async (order) => { saved.push(order); }
    });
    assert.equal(response.statusCode, 200);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].orderRef, 'FF-261004-AAAA');
    assert.equal(saved[0].status, 'PAID');
    assert.equal(saved[0].total, '3300.00');
    assert.equal(saved[0].deliveryFee, '0.00');
    assert.equal(saved[0].customerName, 'Anele Dlamini');
    assert.equal(saved[0].mobile, '0672565980');
    assert.equal(saved[0].email, 'anele@example.co.za');
    assert.match(saved[0].address, /12 Main Road, Rosebank, Johannesburg, Gauteng, 2196/);
    assert.equal(saved[0].outfitIds, 'FF-W-004');
    assert.match(saved[0].itemsWithSizes, /One size fits most/);
    assert.equal(saved[0].payfastPaymentId, '1089250');
    assert.deepEqual(rowFromOrder(saved[0]).length, HEADERS.length);
});

test('ITN source check accepts validate or, if that call fails, a PayFast IP', async () => {
    const built = await checkoutBody([outfitItem('FF-M-001', { top: 'S', jogger: 'M', shoe: '8' })]);
    const base = {
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '41.74.179.194' },
        body: itnBody(built.fields, {}, DOCS_PASSPHRASE)
    };
    const saved = [];
    const byIp = await handleNotify(base, {
        env: ENV,
        fetch: async () => { throw new Error('network'); },
        isPayfastIp: async () => true,
        recordOrder: async (order) => { saved.push(order); }
    });
    assert.equal(byIp.statusCode, 200);
    assert.equal(saved.length, 1);

    const invalid = await handleNotify(base, {
        env: ENV,
        fetch: async () => ({ ok: true, text: async () => 'INVALID' }),
        isPayfastIp: async () => true,
        recordOrder: async () => { throw new Error('should not record'); }
    });
    assert.equal(invalid.statusCode, 400);

    const neither = await handleNotify({
        httpMethod: 'POST',
        headers: { 'x-forwarded-for': '41.74.179.194' },
        body: itnBody(built.fields, {}, DOCS_PASSPHRASE)
    }, {
        env: ENV,
        fetch: async () => { throw new Error('network'); },
        isPayfastIp: async () => false,
        recordOrder: async () => { throw new Error('should not record'); }
    });
    assert.equal(neither.statusCode, 400);
});

test('a bad signature, a cancelled payment, and a wrong amount are not marked paid', async () => {
    const built = await checkoutBody([outfitItem('FF-W-001', { top: 'M', pants: 'XS' })]);
    let fetches = 0;
    const badSig = await handleNotify({
        httpMethod: 'POST',
        body: itnBody(built.fields, { amount_gross: '1.00' }, 'wrong-passphrase')
    }, {
        env: ENV,
        fetch: async () => { fetches += 1; return { ok: true, text: async () => 'VALID' }; },
        recordOrder: async () => { throw new Error('should not record'); }
    });
    assert.equal(badSig.statusCode, 400);
    assert.equal(fetches, 0);

    const cancelled = await handleNotify({
        httpMethod: 'POST',
        body: itnBody(built.fields, { payment_status: 'CANCELLED' }, DOCS_PASSPHRASE)
    }, {
        env: ENV,
        fetch: async () => ({ ok: true, text: async () => 'VALID' }),
        recordOrder: async () => { throw new Error('should not record'); }
    });
    assert.equal(cancelled.statusCode, 200);

    const cheap = await handleNotify({
        httpMethod: 'POST',
        body: itnBody(built.fields, { amount_gross: '1.00' }, DOCS_PASSPHRASE)
    }, {
        env: ENV,
        fetch: async () => ({ ok: true, text: async () => 'VALID' }),
        recordOrder: async () => { throw new Error('should not record'); }
    });
    assert.equal(cheap.statusCode, 400);
});

test('recordOrder logs without Google Sheets and does not throw when Sheets is misconfigured', async () => {
    const order = {
        orderRef: 'FF-261004-AAAA',
        date: '2026-10-04 14:00',
        status: 'PAID',
        customerName: 'Anele Dlamini',
        email: 'anele@example.co.za',
        mobile: '0672565980',
        address: '12 Main Road, Rosebank, Johannesburg, Gauteng, 2196',
        outfitIds: 'FF-M-001',
        itemsWithSizes: 'FF-M-001 Boxy Top Streetwear Set (Top M, Jogger L, Shoe 9) x1',
        total: '1050.00',
        payfastPaymentId: '1089250'
    };
    const logged = await recordOrder(order, {});
    assert.equal(logged.recorded, 'log');
    const broken = await recordOrder(order, {
        GOOGLE_SERVICE_ACCOUNT_JSON: 'not-json',
        GOOGLE_SHEET_ID: 'sheet-id'
    });
    assert.equal(broken.recorded, 'log');
    assert.match(broken.sheetError, /JSON/);
    assert.deepEqual(HEADERS, [
        'Order ref',
        'Date',
        'Status',
        'Customer name',
        'Email',
        'Mobile',
        'Address',
        'Outfit IDs',
        'Items with sizes',
        'Total',
        'PayFast payment id'
    ]);
});

test('the payment switch defaults to WhatsApp, and result pages stay out of the sitemap', () => {
    const script = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');
    assert.match(script, /const PAYMENT_PROVIDER = 'whatsapp';/);
    assert.match(script, /Order on WhatsApp/);
    assert.match(script, /Pay by card/);
    assert.match(script, /Free delivery on orders over R4,000\./);
    const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    assert.equal(sitemap.includes('payment-success'), false);
    assert.equal(sitemap.includes('payment-cancelled'), false);
    for (const file of ['payment-success.html', 'payment-cancelled.html']) {
        const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
        assert.match(html, /noindex/);
        assert.match(html, /\+27 67 256 5980/);
        assert.equal(html.includes('\u2014'), false);
    }
});
