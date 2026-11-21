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

test('the public catalogue lists signed brands only, and old product pages are gone', () => {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'products.json'), 'utf8'));
    assert.deepEqual(data.outfits, []);
    assert.ok(data.products.length >= 8);
    const brands = new Set(data.products.map((product) => product.brand));
    assert.deepEqual(brands, new Set(['Indie Nation', 'LilyCo']));
    data.products.forEach((product) => {
        assert.ok(['women', 'men', 'kids'].includes(product.category), product.name);
        assert.equal(product.placement, 'brand');
        assert.match(product.sourceUrl, /^https:\/\/(www\.)?(indienation|lilycodesigns)\.co\.za\//);
        assert.ok(product.price > 0 && product.price < 10000, product.name);
        assert.ok(product.sizes.length > 0, product.name);
    });
    assert.equal(Object.keys(STOCK).length, data.products.length);
    assert.equal(Object.keys(PIECES).length, data.products.length);
    const pages = fs.readdirSync(ROOT).filter((name) => name.startsWith('product-') && name.endsWith('.html'));
    assert.deepEqual(pages, []);
    assert.equal(fs.existsSync(path.join(ROOT, 'product.html')), true);
    const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    assert.equal(sitemap.includes('/product-'), false);
    const script = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');
    const start = script.indexOf('const PIECE_STOCK = ');
    const end = script.indexOf('\n};', start);
    const pieceStock = Function('return ' + script.slice(start + 'const PIECE_STOCK = '.length, end + 2))();
    assert.deepEqual(pieceStock.pieces, {});
});

test('an item that is not in the catalogue is refused', async () => {
    const response = await handleCheckout({
        httpMethod: 'POST',
        body: JSON.stringify({
            customer: customer(),
            items: [{ name: 'Example top', price: 1, qty: 1, size: 'M' }]
        })
    }, { env: ENV });
    assert.equal(response.statusCode, 400);
    assert.match(JSON.parse(response.body).error, /no longer available/);
});

test('checkout refuses an outfit that is not in the catalogue', async () => {
    const response = await handleCheckout({
        httpMethod: 'POST',
        body: JSON.stringify({
            customer: customer(),
            items: [outfitItem('FF-M-001', { top: 'M' })]
        })
    }, { env: ENV });
    assert.equal(response.statusCode, 400);
    assert.match(JSON.parse(response.body).error, /no longer available/);
    assert.equal(response.body.includes(DOCS_PASSPHRASE), false);
});

test('a long summary still splits across PayFast custom fields', () => {
    const summary = Array.from({ length: 22 }, (_, i) => 'PIECE-' + String(i).padStart(2, '0') + ':M:1').join('|');
    assert.ok(summary.length > 255);
    const packed = packSummary(summary);
    assert.ok(packed.custom_str1.length <= 255);
    assert.ok(packed.custom_str4.length <= 255);
    assert.equal(readSummary(packed), summary);
});

function readScriptConst(script, name) {
    const marker = 'const ' + name + ' = ';
    const start = script.indexOf(marker);
    assert.notEqual(start, -1, name);
    const end = script.indexOf('\n};', start);
    return Function('return ' + script.slice(start + marker.length, end + 2))();
}

test('shop pages keep a coming-soon grid when the catalogue is empty', () => {
    const evening = fs.readFileSync(path.join(ROOT, 'women-evening.html'), 'utf8');
    const full = fs.readFileSync(path.join(ROOT, 'women-full-outfits.html'), 'utf8');
    const men = fs.readFileSync(path.join(ROOT, 'men-individual-pieces.html'), 'utf8');
    const ui = fs.readFileSync(path.join(ROOT, 'catalogue-ui.js'), 'utf8');
    assert.match(evening, /data-catalogue-grid[^>]*data-style="evening"/);
    assert.match(full, /data-catalogue-styles[^>]*data-gender="women"/);
    assert.match(men, /data-catalogue-grid[^>]*data-kind="piece"[^>]*data-gender="men"/);
    assert.match(ui, /New outfits coming soon/);
    assert.match(ui, /instagram.com\/fashforge_official_account/);
    assert.equal(isSoldOut(1), false);
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

function signedNotice(overrides, passphrase) {
    const data = Object.assign({
        m_payment_id: 'FF-261004-AAAA',
        pf_payment_id: '1089250',
        payment_status: 'COMPLETE',
        item_name: 'FashForge order',
        amount_gross: '100.00',
        custom_str1: 'v1|FF-W-999:top=M:1|D:Johannesburg:2196',
        name_first: 'Anele',
        name_last: 'Dlamini',
        email_address: 'anele@example.co.za',
        merchant_id: '10000100'
    }, overrides);
    const entries = Object.entries(data).filter(([, value]) => value !== undefined);
    entries.push(['signature', itnSignature(entries, passphrase)]);
    return entries.map(([key, value]) => phpUrlEncode(key) + '=' + phpUrlEncode(value)).join('&');
}

test('a paid notice for an unknown outfit is not recorded', async () => {
    const saved = [];
    const response = await handleNotify({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '8.8.8.8' },
        body: signedNotice({}, DOCS_PASSPHRASE)
    }, {
        env: ENV,
        fetch: async () => ({ ok: true, text: async () => 'VALID' }),
        recordOrder: async (order) => { saved.push(order); }
    });
    assert.equal(response.statusCode, 400);
    assert.equal(saved.length, 0);
});

test('ITN source check accepts validate or, if that call fails, a PayFast IP', async () => {
    const base = {
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '41.74.179.194' },
        body: signedNotice({ payment_status: 'CANCELLED' }, DOCS_PASSPHRASE)
    };
    const byIp = await handleNotify(base, {
        env: ENV,
        fetch: async () => { throw new Error('network'); },
        isPayfastIp: async () => true,
        recordOrder: async () => { throw new Error('should not record'); }
    });
    assert.equal(byIp.statusCode, 200);

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
        body: signedNotice({ payment_status: 'CANCELLED' }, DOCS_PASSPHRASE)
    }, {
        env: ENV,
        fetch: async () => { throw new Error('network'); },
        isPayfastIp: async () => false,
        recordOrder: async () => { throw new Error('should not record'); }
    });
    assert.equal(neither.statusCode, 400);
});

test('a bad signature and a cancelled payment are not marked paid', async () => {
    let fetches = 0;
    const badSig = await handleNotify({
        httpMethod: 'POST',
        body: signedNotice({ amount_gross: '1.00' }, 'wrong-passphrase')
    }, {
        env: ENV,
        fetch: async () => { fetches += 1; return { ok: true, text: async () => 'VALID' }; },
        recordOrder: async () => { throw new Error('should not record'); }
    });
    assert.equal(badSig.statusCode, 400);
    assert.equal(fetches, 0);

    const cancelled = await handleNotify({
        httpMethod: 'POST',
        body: signedNotice({ payment_status: 'CANCELLED' }, DOCS_PASSPHRASE)
    }, {
        env: ENV,
        fetch: async () => ({ ok: true, text: async () => 'VALID' }),
        recordOrder: async () => { throw new Error('should not record'); }
    });
    assert.equal(cancelled.statusCode, 200);
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
        outfitIds: 'FF-W-001',
        itemsWithSizes: 'FF-W-001 Example outfit (Top M) x1',
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

test('old standalone product pages are not on the site', () => {
    for (const file of ['product-orange-wrap-top.html', 'product-taupe-knit-top.html', 'product-orange-linen-coord.html', 'product-taupe-waistcoat-set.html']) {
        assert.equal(fs.existsSync(path.join(ROOT, file)), false);
    }
    const listing = fs.readFileSync(path.join(ROOT, 'women-individual-pieces.html'), 'utf8');
    assert.equal(listing.includes('product-orange-wrap-top.html'), false);
    assert.equal(listing.includes('product-taupe-knit-top.html'), false);
    const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    assert.equal(sitemap.includes('product-orange-wrap-top'), false);
    assert.equal(sitemap.includes('product-taupe-knit-top'), false);
});

test('the payment switch pauses orders, and result pages stay out of the sitemap', () => {
    const script = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');
    assert.match(script, /const PAYMENT_PROVIDER = 'disabled';/);
    const providerStart = script.indexOf('const PAYMENT_PROVIDER');
    const providerEnd = script.indexOf('const PIECE_STOCK');
    const provider = Function(script.slice(providerStart, providerEnd) + '\nreturn activePaymentProvider();')();
    assert.equal(provider, 'disabled');
    assert.match(script, /We're not taking payments yet\. Online checkout is coming soon — you can save items in your cart and check back shortly\./);
    assert.match(script, /Order on WhatsApp/);
    assert.match(script, /Pay by card/);
    assert.match(script, /Free delivery on orders of R2,000 or more\./);
    const siteConfig = fs.readFileSync(path.join(ROOT, 'site-config.js'), 'utf8');
    assert.match(siteConfig, /doorToDoor: 99/);
    assert.match(siteConfig, /locker: 70/);
    assert.match(siteConfig, /freeFrom: 2000/);
    assert.match(siteConfig, /usualBusinessDays: \[3, 7\]/);
    assert.match(siteConfig, /packDays: \[1, 2\]/);
    assert.match(siteConfig, /courierDays: \[1, 3\]/);
    assert.equal(fs.readFileSync(path.join(ROOT, 'delivery-policy.html'), 'utf8').includes('TODO(Mandla): confirm a typical delivery window'), false);
    assert.equal(script.includes('https://wa.me/27672565980?text='), true);
    for (const file of fs.readdirSync(ROOT)) {
        if (!file.endsWith('.html')) continue;
        const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
        assert.equal(html.includes('wa.me/27672565980?text='), false, file);
        assert.equal(html.includes('Order on WhatsApp'), false, file);
        assert.equal(html.includes('order on WhatsApp'), false, file);
    }
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
