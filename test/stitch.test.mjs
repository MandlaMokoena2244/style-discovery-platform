import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHmac, randomBytes } from 'node:crypto';
import { registerHooks } from 'node:module';
import { requireCheckoutConfig } from '../lib/stitch-config.mjs';
import { onRequest as siteConfig } from '../functions/api/site-config.js';

const catalogueUrl = new URL('../products.json', import.meta.url);
const catalogue = JSON.parse(readFileSync(catalogueUrl, 'utf8'));
const purchaseScript = readFileSync(new URL('../script.js', import.meta.url), 'utf8');
const purchaseHelpers = purchaseScript.slice(purchaseScript.indexOf('// Product purchase helpers.'), purchaseScript.indexOf('// End product purchase helpers.'));

test('public checkout flag exposes only enabled/mode and keeps test guards', async () => {
    const request = new Request('https://preview.example.com/api/site-config');
    const config = { STITCH_SITE_URL: 'https://preview.example.com', STITCH_WEBHOOK_SECRET: 'c2lnbmluZy1maXh0dXJl', ORDERS: { get() {}, put() {} }, CHECKOUT_ENABLED: 'true', STITCH_MODE: 'test', STITCH_CLIENT_ID: 'test-fixture', STITCH_CLIENT_SECRET: 'opaque-fixture', RESEND_API_KEY: 'private-fixture' };
    const response = siteConfig({ request, env: config });
    assert.deepEqual(await response.json(), { checkoutEnabled: true, checkoutMode: 'test' });
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    for (const change of [{ CHECKOUT_ENABLED: 'false' }, { CHECKOUT_ENABLED: undefined }, { STITCH_MODE: 'live' }, { STITCH_CLIENT_ID: 'live-fixture' }, { STITCH_CLIENT_SECRET: '' }]) {
        assert.deepEqual(await siteConfig({ request, env: { ...config, ...change } }).json(), { checkoutEnabled: false, checkoutMode: null });
    }
    assert.equal(siteConfig({ request: new Request(request.url, { method: 'POST' }), env: config }).status, 405);
});

test('server flag enables a disabled local default, overrides stale true and fails safely', async () => {
    for (const [local, remote, expected] of [[false, true, true], [true, false, false], [true, 'invalid', false]]) {
        const context = { window: { FASHFORGE: { checkoutEnabled: local, showOutfits: false } }, AbortSignal, fetch: async () => Response.json({ checkoutEnabled: remote }) };
        vm.runInNewContext(purchaseHelpers, context);
        await context.loadCheckoutFlag();
        assert.equal(context.window.FASHFORGE.checkoutEnabled, expected);
        assert.equal(context.window.FASHFORGE.showOutfits, false);
    }
    const context = { window: { FASHFORGE: { checkoutEnabled: true } }, AbortSignal, fetch: async () => { throw new Error('offline'); } };
    vm.runInNewContext(purchaseHelpers, context);
    await context.loadCheckoutFlag();
    assert.equal(context.window.FASHFORGE.checkoutEnabled, false);
});

function purchaseHarness(enabled) {
    const product = catalogue.products.find(p => p.name === 'Death Before Decaf Black Unisex Tee') ||
        catalogue.products.find(p => p.sellAlone && p.sizes?.length && p.inStock !== false);
    const added = [], opened = [], inserted = [];
    let selected = null;
    const group = { dataset: { piece: 'size', label: product.name }, querySelector() { return selected; } };
    const quantity = { value: '2' };
    const button = {
        dataset: { id: product.id, name: product.name }, disabled: false, events: {},
        setAttribute(key, value) { this[key] = value; },
        classList: { add(value) { button.addedClass = value; } },
        insertAdjacentElement(position, element) { inserted.push(element); },
        addEventListener(name, callback) { this.events[name] = callback; }
    };
    const context = {
        window: { FASHFORGE: { phoneWa: '27672565980' }, addToCart(line) { added.push(line); }, open(...args) { opened.push(args); } },
        document: {
            createElement() { return { events: {}, setAttribute(key, value) { this[key] = value; }, addEventListener(name, callback) { this.events[name] = callback; } }; },
            querySelectorAll() { return [group]; },
            getElementById() { return quantity; },
            querySelector() { return { value: 'door' }; }
        },
        insertDeliveryChoice() {},
        deliveryChoiceLabel() { return 'door-to-door'; }
    };
    vm.runInNewContext(purchaseHelpers, context);
    context.bindProductPurchase(button, catalogue, enabled);
    return { context, product, button, quantity, added, opened, feedback: inserted[0], secondary: inserted[1], choose(size) { selected = { dataset: { size } }; } };
}

test('enabled product button requires size, adds canonical items/quantity and shows feedback without purchase links', () => {
    const h = purchaseHarness(true);
    assert.equal(h.button.textContent, 'Add to cart');
    assert.equal(h.secondary, undefined);
    h.button.events.click();
    assert.equal(h.added.length, 0);
    assert.match(h.feedback.textContent, /Please select a size/);
    h.choose(h.product.sizes[0]);
    h.button.events.click();
    assert.equal(h.added.length, 1);
    assert.equal(h.added[0].id, h.product.id);
    assert.equal(h.added[0].size, h.product.sizes[0]);
    assert.equal(h.added[0].qty, 2);
    assert.match(h.feedback.textContent, /Added to cart/);
    assert.equal(h.button.addedClass, 'added');
    assert.equal(h.opened.length, 0);
    h.quantity.value = '0';
    h.button.events.click();
    assert.equal(h.added.length, 1);
    assert.match(h.feedback.textContent, /quantity/);
    // The existing checkout request mapper never sends the display price/name.
    const mapper = purchaseScript.match(/items: cart\.map\(item => \(\{ id: item\.id, size: item\.size \|\| '', qty: item\.qty \}\)\)/);
    assert.ok(mapper);
});

test('disabled product button blocks purchases without opening WhatsApp', () => {
    const h = purchaseHarness(false);
    assert.equal(h.button.textContent, 'Checkout temporarily unavailable');
    assert.equal(h.button.disabled, true);
    assert.equal(h.secondary, undefined);
    h.choose(h.product.sizes[0]);
    h.button.events.click();
    assert.equal(h.added.length, 0);
    assert.equal(h.opened.length, 0);
});

test('shared outfit path uses server-accepted piece IDs and sizes, rejects unavailable pieces', () => {
    const h = purchaseHarness(true);
    const p = h.product;
    const fixture = { products: [p], outfits: [{ id: 'outfit-fixture', pieces: [{ stockId: p.stockId, key: 'top' }] }] };
    const lines = h.context.productCartItems(fixture, 'outfit-fixture', { top: p.sizes[0] }, 1);
    assert.equal(lines[0].id, p.id);
    assert.equal(lines[0].size, p.sizes[0]);
    assert.throws(() => h.context.productCartItems(fixture, 'outfit-fixture', {}, 1), /size/);
    assert.throws(() => h.context.productCartItems({ ...fixture, products: [{ ...p, sellAlone: false }] }, 'outfit-fixture', { top: p.sizes[0] }, 1), /unavailable/);
});
// Node-only loader: mimic Wrangler's native JSON bundling without adding
// import attributes to production source. Scope the hook to this catalogue.
const catalogueLoader = registerHooks({
    load(url, context, nextLoad) {
        if (url === catalogueUrl.href) {
            return { format: 'module', source: 'export default ' + JSON.stringify(catalogue) + ';', shortCircuit: true };
        }
        return nextLoad(url, context);
    }
});
let readOrder, referenceMode;
let customerEmail, enrichItems, emailMoney, emailDate, firstName, escapeHtml;
let priceCart, validateCustomer, delivery, requireStitchConfig, checkout, webhook, verifyWebhook, orderStatus;
try {
    ({ readOrder, referenceMode } = await import('../lib/orders.mjs'));
    ({ customerEmail, enrichItems, emailMoney, emailDate, firstName, escapeHtml } = await import('../lib/order-email.mjs'));
    ({ priceCart, validateCustomer, delivery, requireStitchConfig } = await import('../lib/stitch-checkout.mjs'));
    ({ onRequest: checkout } = await import('../functions/api/checkout.js'));
    ({ onRequest: webhook, verifyWebhook } = await import('../functions/api/stitch-webhook.js'));
    ({ onRequest: orderStatus } = await import('../functions/api/order-status.js'));
} finally {
    catalogueLoader.deregister();
}

const orderRef = 'FF-TEST-12345678-1234-4234-8234-123456789abc';
function emailFixture() {
    return { reference: orderRef, mode: 'test', customer: { name: 'Alex Smith', email: 'alex@example.com', street: '1 Test Street', suburb: 'Test Suburb', city: 'Johannesburg', province: 'Gauteng', postalCode: '2000', note: 'Private <note>' },
        items: [{ id: 'example', name: 'BLACK TEE', size: 'M', qty: 2, unitPrice: 48500 }], subtotal: 97000, deliveryFee: 9900, total: 106900, deliveryMethod: 'door', paidAt: '2026-11-22T23:30:00Z', createdAt: '2026-11-21T12:00:00Z' };
}
const emailEnv = { ORDER_FROM_EMAIL: 'FashForge <orders@example.com>', STITCH_SITE_URL: 'https://preview.example.com' };
const emailCatalogue = { products: [{ id: 'example', brand: 'Indie Nation', code: 'IN-05', image: 'images/products/test.webp' }] };
test('branded email uses stored facts, catalogue enrichment, matching text and Johannesburg dates', () => {
    const order = emailFixture();
    const result = customerEmail(order, emailEnv, emailCatalogue);
    assert.equal(firstName('  Alex Smith '), 'Alex');
    assert.equal(firstName('Alex'), 'Alex');
    assert.equal(emailMoney(106900), 'R1,069');
    assert.equal(emailMoney(42000), 'R420');
    assert.equal(emailMoney(42050), 'R420.50');
    assert.equal(emailDate(order), '23 November 2026');
    assert.equal(emailDate({ ...order, paidAt: undefined }), '21 November 2026');
    for (const fragment of ['Dear Alex,', 'Black Tee', 'Indie Nation', 'Size M', 'Qty 2', 'R1,069', 'R970', 'Door delivery', 'R99', orderRef, '1 Test Street', 'South Africa', 'Card via Stitch']) {
        assert.ok(result.text.includes(fragment), fragment);
        assert.ok(result.html.includes(fragment), fragment);
    }
    assert.ok(result.html.includes('https://www.fashforge.co.za/images/products/test.webp'));
    assert.ok(result.html.includes('https://www.fashforge.co.za/product.html?id=example'));
    assert.ok(result.html.includes('https://preview.example.com/checkout-success.html?ref=' + orderRef));
    assert.ok(!result.html.includes('IN-05'));
    assert.ok(!result.text.includes('Private'));
    assert.ok(!result.html.includes('Private'));
    assert.equal(enrichItems(order, emailCatalogue)[0].code, 'IN-05');
    assert.deepEqual(customerEmail(order, emailEnv, emailCatalogue), result);
});
test('email escapes untrusted content and safely handles absent catalogue products', () => {
    const order = emailFixture();
    order.customer.name = '<Alex> & "Smith"';
    order.customer.street = '<script> & "street"';
    order.customer.note = '<note> & secret';
    order.items[0].name = '<ITEM> & "NAME"';
    const source = { products: [{ id: 'example', brand: '<brand> & "quoted"', image: 'https://attacker.example/a.png' }] };
    const result = customerEmail(order, emailEnv, source);
    for (const raw of [order.customer.name, order.customer.street, order.customer.note, '<brand>', '<script>', '<ITEM>']) assert.ok(!result.html.includes(raw));
    assert.ok(result.html.includes('&lt;script&gt; &amp; &quot;street&quot;'));
    assert.ok(result.html.includes('&lt;brand&gt; &amp; &quot;quoted&quot;'));
    assert.ok(!result.html.includes('attacker.example'));
    assert.equal(escapeHtml('<>&"'), '&lt;&gt;&amp;&quot;');
    const fallback = customerEmail(emailFixture(), emailEnv, { products: [] });
    assert.ok(fallback.html.includes('Black Tee'));
    assert.ok(!fallback.html.includes('Indie Nation'));
    assert.equal(enrichItems(order, { products: [] })[0].image, '');
});
test('email test banner, free locker delivery and one-size fallback', () => {
    const order = emailFixture();
    order.deliveryMethod = 'locker'; order.deliveryFee = 0; order.items[0].size = '';
    const testEmail = customerEmail(order, emailEnv, { products: [] });
    for (const output of [testEmail.text, testEmail.html]) {
        assert.ok(output.includes('Test order — no items will be dispatched'));
        assert.ok(output.includes('Courier Guy locker'));
        assert.ok(output.includes('Free'));
        assert.ok(output.includes('One size'));
    }
    const live = customerEmail({ ...order, mode: 'live' }, emailEnv, { products: [] });
    assert.equal(live.subject, 'Your FashForge order is confirmed');
    assert.ok(!live.html.includes('Test order — no items will be dispatched'));
    assert.ok(!live.text.includes('Test order — no items will be dispatched'));
});
async function orderFixture(run, overrides = {}) {
    const fixtureMode = overrides.STITCH_MODE || 'test';
    const fixtureReference = fixtureMode === 'live' ? orderRef.replace('FF-TEST-', 'FF-') : orderRef;
    const key = randomBytes(32);
    const orders = new MemoryKV();
    const totals = priceCart([item], 'door');
    const order = {
        reference: fixtureReference, mode: fixtureMode, status: 'pending', paymentLinkId: 'order-link',
        customer: validateCustomer({ ...customer, note: 'At the gate' }), deliveryMethod: 'door',
        ...totals, currency: 'ZAR', createdAt: new Date().toISOString()
    };
    await orders.put(fixtureReference, JSON.stringify(order));
    const config = {
        ...env, ORDERS: orders, STITCH_WEBHOOK_SECRET: key.toString('base64'),
        RESEND_API_KEY: 'mock-resend-key', ORDER_NOTIFY_EMAIL: 'owner@example.com',
        ORDER_FROM_EMAIL: 'shop@example.com', ...overrides
    };
    const link = { id: order.paymentLinkId, merchantReference: fixtureReference, amount: order.total, status: 'PAID', paymentId: 'payment-1', paidAt: new Date().toISOString() };
    const attempts = [];
    const sent = new Map();
    const control = { failCustomerOnce: false, linkReads: 0 };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
        if (url === 'https://express.stitch.money/api/v1/token') return Response.json({ success: true, data: { accessToken: 'order-mock-token' } });
        if (url === 'https://express.stitch.money/api/v1/payment-links/order-link') {
            assert.equal(options.method, 'GET');
            assert.ok(options.headers.Authorization.startsWith('Bearer '));
            control.linkReads++;
            return Response.json({ success: true, data: { payment: link } });
        }
        assert.equal(url, 'https://api.resend.com/emails');
        assert.equal(options.headers.Authorization, 'Bearer mock-resend-key');
        const body = JSON.parse(options.body);
        const idempotencyKey = options.headers['Idempotency-Key'];
        attempts.push({ body, idempotencyKey });
        if (control.failCustomerOnce && body.to[0] === customer.email) {
            control.failCustomerOnce = false;
            return Response.json({ error: 'provider unavailable' }, { status: 503 });
        }
        if (sent.has(idempotencyKey)) assert.deepEqual(body, sent.get(idempotencyKey).body);
        else sent.set(idempotencyKey, { body, id: 'email-' + sent.size });
        return Response.json({ id: sent.get(idempotencyKey).id });
    };
    function event(id = 'event-1', changes = {}) {
        const payload = { id: 'payment-1', status: 'PAID', type: 'LINK', linkId: order.paymentLinkId, amount: order.total, ...changes };
        const body = JSON.stringify(payload);
        const timestamp = String(Math.floor(Date.now() / 1000));
        const signature = createHmac('sha256', key).update(id + '.' + timestamp + '.' + body).digest('base64');
        return new Request('https://preview.example.com/api/stitch-webhook', {
            method: 'POST', body,
            headers: { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': 'v1,' + signature }
        });
    }
    const statusRequest = () => new Request('https://preview.example.com/api/order-status?ref=' + fixtureReference);
    try { await run({ config, orders, order, link, attempts, sent, control, event, statusRequest }); }
    finally { globalThis.fetch = originalFetch; }
}

test('paid webhook reconciles reference and amount, stores status and sends both emails once', async () => {
    await orderFixture(async ({ config, orders, order, attempts, sent, event, statusRequest, control }) => {
        assert.equal((await webhook({ request: event(), env: config })).status, 200);
        assert.equal((await orders.get(orderRef, 'json')).status, 'paid');
        assert.equal(sent.size, 2);
        const owner = attempts[0].body;
        for (const detail of [customer.name, customer.email, customer.mobile.slice(1), customer.street, customer.suburb, customer.city, customer.province, customer.postalCode, product.name, product.id, item.size, 'At the gate']) assert.ok(owner.text.includes(detail));
        assert.equal(attempts[1].body.to[0], customer.email);
        assert.ok(attempts[1].body.text.includes('Order confirmed'));
        assert.equal(attempts[1].body.subject, '[TEST] Your FashForge order is confirmed');
        assert.equal(attempts[1].body.reply_to, 'hello@fashforge.co.za');
        assert.ok(attempts[1].body.html.includes('Order summary'));
        assert.equal((await webhook({ request: event(), env: config })).status, 200);
        assert.equal(control.linkReads, 1);
        assert.equal(attempts.length, 2);
        // A distinct delivery ID for the same payment also cannot resend emails.
        assert.equal((await webhook({ request: event('event-2'), env: config })).status, 200);
        assert.equal(attempts.length, 2);
        const response = await orderStatus({ request: statusRequest(), env: config });
        assert.equal(response.headers.get('Cache-Control'), 'no-store');
        assert.equal(response.headers.get('X-Order-Confirmation'), 'sent');
        assert.deepEqual(await response.json(), { status: 'paid', total: order.total });
    });
});

test('partial email failure retries the unsent recipient, not the completed owner email', async () => {
    await orderFixture(async ({ config, orders, attempts, sent, event, control }) => {
        control.failCustomerOnce = true;
        assert.equal((await webhook({ request: event(), env: config })).status, 503);
        assert.equal((await orders.get(orderRef, 'json')).status, 'paid');
        assert.equal(await orders.get('event:event-1'), null);
        assert.equal((await webhook({ request: event(), env: config })).status, 200);
        assert.equal(sent.size, 2);
        assert.equal(attempts.filter(a => a.body.to[0] === 'owner@example.com').length, 1);
        const customerAttempts = attempts.filter(a => a.body.to[0] === customer.email);
        assert.equal(customerAttempts.length, 2);
        assert.equal(customerAttempts[0].idempotencyKey, customerAttempts[1].idempotencyKey);
        assert.deepEqual(customerAttempts[0].body, customerAttempts[1].body);
    });
});

test('stale KV receipts and concurrent deliveries still use identical Resend idempotency keys', async () => {
    await orderFixture(async ({ config, orders, attempts, sent, event }) => {
        const get = orders.get.bind(orders);
        orders.get = (key, type) => key.startsWith('email:') || key.startsWith('event:') ? Promise.resolve(null) : get(key, type);
        const responses = await Promise.all([webhook({ request: event(), env: config }), webhook({ request: event(), env: config })]);
        assert.ok(responses.every(response => response.status === 200));
        assert.equal(sent.size, 2);
        assert.equal(new Set(attempts.map(a => a.idempotencyKey)).size, 2);
    });
});

test('missing Resend key skips email, keeps paid status and acknowledges retries', async () => {
    await orderFixture(async ({ config, orders, attempts, event, statusRequest }) => {
        assert.equal((await webhook({ request: event(), env: config })).status, 200);
        assert.equal(attempts.length, 0);
        assert.equal((await orders.get('email:' + orderRef + ':customer', 'json')).status, 'skipped');
        const response = await orderStatus({ request: statusRequest(), env: config });
        assert.equal((await response.json()).status, 'paid');
        assert.equal(response.headers.get('X-Order-Confirmation'), 'skipped');
    }, { RESEND_API_KEY: '' });
});

test('late retries outside provider idempotency retention do not send another email', async () => {
    await orderFixture(async ({ config, link, attempts, event, orders }) => {
        link.paidAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        assert.equal((await webhook({ request: event(), env: config })).status, 200);
        assert.equal(attempts.length, 0);
        assert.equal((await orders.get('email:' + orderRef + ':owner', 'json')).reason, 'retry_window_expired');
    });
});

test('mismatched amount, payment ID, foreign reference and unsupported statuses cause no email', async () => {
    await orderFixture(async ({ config, order, link, attempts, event, orders }) => {
        assert.equal((await webhook({ request: event('amount', { amount: 1 }), env: config })).status, 409);
        assert.equal((await webhook({ request: event('id', { id: 'wrong-payment' }), env: config })).status, 409);
        link.amount++;
        assert.equal((await webhook({ request: event('link-amount'), env: config })).status, 409);
        link.amount = order.total;
        link.merchantReference = 'other-merchant-reference';
        assert.equal((await webhook({ request: event('reference'), env: config })).status, 503);
        link.merchantReference = orderRef;
        assert.equal((await webhook({ request: event('cancel', { status: 'CANCELLED' }), env: config })).status, 400);
        assert.equal((await orders.get(orderRef, 'json')).status, 'pending');
        assert.equal(attempts.length, 0);
    });
});

test('missing order and KV failure remain retryable; paid marker survives partial storage failure', async () => {
    await orderFixture(async ({ config, orders, order, event, attempts }) => {
        orders.values.delete(orderRef);
        assert.equal((await webhook({ request: event(), env: config })).status, 503);
        assert.equal(await orders.get('event:event-1'), null);
        await orders.put(orderRef, JSON.stringify(order));
        const put = orders.put.bind(orders);
        let fail = true;
        orders.put = async (key, value) => {
            if (key === orderRef && fail) { fail = false; throw new Error('KV unavailable'); }
            return put(key, value);
        };
        assert.equal((await webhook({ request: event(), env: config })).status, 503);
        assert.equal(attempts.length, 0);
        assert.equal((await webhook({ request: event(), env: config })).status, 200);
        assert.equal((await orders.get(orderRef, 'json')).status, 'paid');
        assert.equal(attempts.length, 2);
    });
});

test('order status exposes no personal data, maps cancelled/expired and never marks paid from redirect', async () => {
    await orderFixture(async ({ config, orders, order, link, event, statusRequest, attempts }) => {
        for (const [remote, local] of [['PENDING', 'pending'], ['CANCELLED', 'cancelled'], ['EXPIRED', 'failed'], ['PAID', 'pending']]) {
            link.status = remote;
            const response = await orderStatus({ request: statusRequest(), env: config });
            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), { status: local, total: order.total });
        }
        assert.equal(attempts.length, 0);
        assert.equal((await webhook({ request: event(), env: config })).status, 200);
        link.status = 'CANCELLED';
        assert.equal((await (await orderStatus({ request: statusRequest(), env: config })).json()).status, 'paid');
        const invalid = new Request('https://preview.example.com/api/order-status?ref=not-an-order&status=paid');
        assert.equal((await orderStatus({ request: invalid, env: config })).status, 400);
        const missing = new Request('https://preview.example.com/api/order-status?ref=FF-TEST-00000000-0000-4000-8000-000000000000');
        assert.equal((await orderStatus({ request: missing, env: config })).status, 404);
        assert.equal((await orderStatus({ request: statusRequest(), env: { ...config, STITCH_MODE: 'live' } })).status, 503);
        assert.equal((await orders.get(orderRef, 'json')).status, 'paid');
    });
});

test('checkout never exposes a link when its KV write fails or binding is absent', async () => {
    const originalFetch = globalThis.fetch;
    let creates = 0;
    globalThis.fetch = async url => {
        if (url.endsWith('/token')) return Response.json({ success: true, data: { accessToken: 'mock-token' } });
        creates++;
        return Response.json({ success: true, data: { payment: { id: 'failed-store-link', link: 'https://express.stitch.money/failed-store-link' } } });
    };
    try {
        const body = { customer, items: [item], deliveryMethod: 'door' };
        const absent = await checkout({ request: request(body), env: { ...env, ORDERS: undefined } });
        assert.equal(absent.status, 503);
        assert.equal(creates, 0);
        const response = await checkout({ request: request(body), env: { ...env, ORDERS: { get() {}, async put() { throw new Error('storage failed'); } } } });
        assert.equal(response.status, 502);
        assert.ok(!(await response.text()).includes('failed-store-link'));
    } finally { globalThis.fetch = originalFetch; }
});

async function statusPage(responses, search = '?ref=' + orderRef) {
    const elements = Object.fromEntries(['order-message', 'order-heading', 'order-total', 'order-retry', 'order-refresh'].map(id => [id, { textContent: '', hidden: true, addEventListener() {} }]));
    const timers = [];
    const calls = [];
    let cleared = 0;
    const context = {
        document: { getElementById: id => elements[id] },
        window: { location: { search }, dispatchEvent() {} },
        localStorage: { removeItem(key) { assert.equal(key, 'fashforge_cart'); cleared++; } },
        URLSearchParams, Intl, AbortSignal, Event,
        setTimeout(callback) { timers.push(callback); },
        async fetch(url) { calls.push(url); return responses.shift(); }
    };
    vm.runInNewContext(readFileSync(new URL('../checkout-status.js', import.meta.url), 'utf8'), context);
    await new Promise(setImmediate);
    return { elements, timers, calls, cleared: () => cleared };
}
test('return page polls pending, clears cart only on paid, and reports actual email state', async () => {
    const page = await statusPage([
        Response.json({ status: 'pending', total: 10000 }),
        Response.json({ status: 'paid', total: 10000 }, { headers: { 'X-Order-Confirmation': 'sent' } })
    ]);
    assert.equal(page.cleared(), 0);
    assert.match(page.elements['order-message'].textContent, /confirming/);
    await page.timers.shift()();
    assert.equal(page.cleared(), 1);
    assert.equal(page.elements['order-message'].textContent, "Payment successful, thank you! We've emailed your confirmation.");
    assert.equal(page.timers.length, 0);
    const skipped = await statusPage([Response.json({ status: 'paid', total: 10000 }, { headers: { 'X-Order-Confirmation': 'skipped' } })]);
    assert.equal(skipped.cleared(), 1);
    assert.ok(!skipped.elements['order-message'].textContent.includes("We've emailed"));
});
test('return page preserves cart for failed/cancelled, stops polling and ignores forged URL status', async () => {
    for (const status of ['failed', 'cancelled']) {
        const page = await statusPage([Response.json({ status, total: 10000 })]);
        assert.equal(page.cleared(), 0);
        assert.equal(page.elements['order-retry'].hidden, false);
        assert.match(page.elements['order-message'].textContent, /didn't go through/);
    }
    const invalid = await statusPage([], '?status=paid');
    assert.equal(invalid.cleared(), 0);
    assert.equal(invalid.calls.length, 0);
    const pending = await statusPage(Array.from({ length: 8 }, () => Response.json({ status: 'pending', total: 10000 })));
    while (pending.timers.length) await pending.timers.shift()();
    assert.equal(pending.calls.length, 8);
    assert.equal(pending.cleared(), 0);
    assert.equal(pending.elements['order-refresh'].hidden, false);
});

const product = catalogue.products.find(p => p.sellAlone && p.sizes?.length && p.inStock !== false);
const item = { id: product.id, size: product.sizes[0], qty: 1 };
const customer = { name: 'Test Customer', email: 'test@example.com', mobile: '0820000000', street: '1 Test Street', suburb: 'Test Suburb', city: 'Johannesburg', province: 'Gauteng', postalCode: '2000', country: 'ZA' };
class MemoryKV {
    values = new Map();
    async get(key, type) {
        const value = this.values.get(key);
        return value == null ? null : type === 'json' ? JSON.parse(value) : value;
    }
    async put(key, value) { this.values.set(key, value); }
}
const env = { CHECKOUT_ENABLED: 'true', STITCH_MODE: 'test', STITCH_CLIENT_ID: 'test-placeholder', STITCH_CLIENT_SECRET: 'opaque-placeholder', STITCH_SITE_URL: 'https://preview.example.com', STITCH_WEBHOOK_SECRET: 'c2lnbmluZy1maXh0dXJl', ORDERS: new MemoryKV() };
function request(body, options = {}) {
    return new Request('https://preview.example.com/api/checkout', {
        method: 'POST', headers: { Origin: 'https://preview.example.com', 'Content-Type': 'application/json', ...options.headers },
        body: typeof body === 'string' ? body : JSON.stringify(body)
    });
}
test('catalogue prices override all browser prices; both delivery methods and free threshold', () => {
    const subtotal = product.price * 100;
    assert.equal(priceCart([{ ...item, price: 0.01 }], 'door').total, subtotal + (subtotal >= 200000 ? 0 : 9900));
    assert.equal(priceCart([item], 'locker').deliveryFee, subtotal >= 200000 ? 0 : 7000);
    const qty = Math.ceil(2000 / product.price);
    assert.equal(priceCart([{ ...item, qty }], 'door').deliveryFee, 0);
    const context = { window: {}, document: { documentElement: { classList: { add() {} } } }, location: { pathname: '/' } };
    vm.runInNewContext(readFileSync(new URL('../site-config.js', import.meta.url), 'utf8'), context);
    for (const key of Object.keys(delivery)) assert.equal(context.window.FASHFORGE.delivery[key], delivery[key]);
    assert.equal(context.window.FASHFORGE.checkoutEnabled, false);
    assert.equal(context.window.FASHFORGE.showOutfits, false);
});
test('empty, unknown, missing size, invalid quantity and duplicate quantity bypass are rejected', () => {
    for (const items of [[], [null], [{ ...item, id: 'missing' }], [{ ...item, size: '' }], [{ ...item, qty: -1 }], [{ ...item, qty: 1.5 }], [{ ...item, qty: '1' }], [{ ...item, qty: 20 }, item]]) {
        assert.throws(() => priceCart(items, 'door'));
    }
    assert.throws(() => priceCart([item], 'free'));
    const sold = catalogue.products.find(p => p.sizes?.length === 0);
    if (sold) assert.throws(() => priceCart([{ ...item, id: sold.id }], 'door'));
});
test('customer validation and live credentials fail closed', () => {
    assert.equal(validateCustomer(customer).mobile, '+27820000000');
    for (const change of [{ country: 'US' }, { name: 'A' }, { email: 'bad' }, { mobile: '123' }, { province: 'Unknown' }, { postalCode: '123' }]) assert.throws(() => validateCustomer({ ...customer, ...change }));
    assert.throws(() => requireStitchConfig({ ...env, STITCH_MODE: 'live' }));
    assert.throws(() => requireStitchConfig({ ...env, STITCH_CLIENT_ID: 'live-placeholder' }));
    assert.doesNotThrow(() => requireStitchConfig(env));
    assert.doesNotThrow(() => requireStitchConfig({ ...env, STITCH_CLIENT_SECRET: 'test-placeholder' }));
    for (const secret of [undefined, null, '', '   ', 123]) {
        assert.throws(() => requireStitchConfig({ ...env, STITCH_CLIENT_SECRET: secret }));
    }
});
test('browser flag selects Stitch and return pages preserve the cart without claiming payment', () => {
    const script = readFileSync(new URL('../script.js', import.meta.url), 'utf8');
    const provider = script.slice(script.indexOf("const PAYMENT_PROVIDER"), script.indexOf('// In-stock sizes'));
    for (const enabled of [false, true]) {
        const context = { window: { FASHFORGE: { checkoutEnabled: enabled } } };
        assert.equal(vm.runInNewContext(provider + '\nactivePaymentProvider()', context), enabled ? 'stitch' : 'disabled');
    }
    for (const name of ['checkout-success.html', 'checkout-cancelled.html']) {
        const html = readFileSync(new URL('../' + name, import.meta.url), 'utf8');
        assert.match(html, /name="robots" content="noindex, nofollow"/);
        assert.ok(!html.includes('localStorage.removeItem'));
        if (name === 'checkout-success.html') assert.match(html, /checkout-status.js/);
        else assert.match(html, /cart has been kept/);
        assert.ok(!readFileSync(new URL('../sitemap.xml', import.meta.url), 'utf8').includes(name));
    }
});
test('checkout HTTP guardrails and documented API contract', async () => {
    const contractEnv = { ...env, STITCH_CLIENT_ID: 'test-contract-placeholder' };
    const body = { customer, items: [{ ...item, price: 1 }], deliveryMethod: 'door' };
    assert.equal((await checkout({ request: request(body), env: {} })).status, 503);
    assert.equal((await checkout({ request: request(body, { headers: { Origin: 'https://attacker.example' } }), env: contractEnv })).status, 403);
    assert.equal((await checkout({ request: request('{'), env: contractEnv })).status, 400);
    assert.equal((await checkout({ request: request(' '.repeat(17000)), env: contractEnv })).status, 413);
    assert.equal((await checkout({ request: new Request('https://preview.example.com/api/checkout'), env: contractEnv })).status, 405);
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, options) => {
        calls.push({ url, options, body: JSON.parse(options.body) });
        return Response.json({ success: true, data: url.endsWith('/token') ? { accessToken: 'mock-token' } : { payment: { id: 'mock-link', link: 'https://express.stitch.money/mock-link' } } });
    };
    try {
        const result = await checkout({ request: request(body), env: contractEnv });
        assert.equal(result.status, 200);
        const data = await result.json();
        assert.equal(calls[0].url, 'https://express.stitch.money/api/v1/token');
        assert.deepEqual(calls[0].body, { clientId: contractEnv.STITCH_CLIENT_ID, clientSecret: contractEnv.STITCH_CLIENT_SECRET, scope: 'client_paymentrequest' });
        assert.equal(calls[1].url, 'https://express.stitch.money/api/v1/payment-links');
        assert.equal(calls[1].options.headers.Authorization, 'Bearer mock-token');
        assert.equal(calls[1].body.amount, priceCart([item], 'door').total);
        assert.equal(calls[1].body.collectDeliveryDetails, false);
        assert.equal(calls[1].body.deliveryFee, undefined);
        const callback = new URL(new URL(data.redirectUrl).searchParams.get('redirect_url'));
        assert.equal(callback.origin + callback.pathname, contractEnv.STITCH_SITE_URL + '/checkout-success.html');
        assert.equal(callback.searchParams.get('ref'), data.reference);
        const stored = await contractEnv.ORDERS.get(data.reference, 'json');
        assert.equal(stored.status, 'pending');
        assert.equal(stored.customer.email, customer.email);
        assert.equal(stored.customer.country, 'ZA');
        assert.equal(stored.customer.street, customer.street);
        assert.equal(stored.deliveryMethod, 'door');
        assert.equal(stored.items[0].unitPrice, product.price * 100);
        assert.equal(stored.items[0].name, product.name);
        assert.equal(stored.total, data.amount);
        assert.equal(stored.paymentLinkId, 'mock-link');
        assert.ok(stored.createdAt);
        assert.ok(!JSON.stringify(data).includes('mock-token'));
        await checkout({ request: request(body), env: contractEnv });
        assert.equal(calls.filter(c => c.url.endsWith('/token')).length, 1);
        globalThis.fetch = async () => Response.json({ success: false, secret: 'never-return-this' }, { status: 500 });
        const failure = await checkout({ request: request(body), env: contractEnv });
        assert.equal(failure.status, 502);
        assert.ok(!(await failure.text()).includes('never-return-this'));
    } finally { globalThis.fetch = originalFetch; }
});
for (const prefix of ['', 'whsec_']) {
test('webhook raw-body HMAC, rotations, timestamps, retries and tampering: ' + (prefix || 'unprefixed'), async () => {
    const key = randomBytes(32);
    const secret = prefix + key.toString('base64');
    const timestamp = String(Math.floor(Date.now() / 1000));
    const raw = JSON.stringify({ id: 'test-payment', status: 'PAID', amount: 100, type: 'LINK', linkId: 'test-link' });
    const signature = createHmac('sha256', key).update('msg-test.' + timestamp + '.' + raw).digest('base64');
    const headers = new Headers({ 'svix-id': 'msg-test', 'svix-timestamp': timestamp, 'svix-signature': 'v1,invalid v1,' + signature });
    const bytes = new TextEncoder().encode(raw);
    await verifyWebhook(bytes, headers, secret);
    for (const invalidSecret of [undefined, '', 'whsec_', 'not-base64!', 'whsec_not-base64!']) {
        await assert.rejects(verifyWebhook(bytes, headers, invalidSecret));
    }
    await assert.rejects(verifyWebhook(bytes, headers, prefix + randomBytes(32).toString('base64')));
    await assert.rejects(verifyWebhook(new TextEncoder().encode(raw + ' '), headers, secret));
    await assert.rejects(verifyWebhook(bytes, headers, secret, Number(timestamp) * 1000 + 301000));
    await assert.rejects(verifyWebhook(bytes, headers, secret, Number(timestamp) * 1000 - 301000));
    await assert.rejects(verifyWebhook(bytes, new Headers(), secret));
    assert.equal((await webhook({ request: new Request('https://preview.example.com/api/stitch-webhook', { method: 'POST', headers, body: raw }), env: { STITCH_MODE: 'test', STITCH_WEBHOOK_SECRET: secret } })).status, 503);
    assert.equal((await webhook({ request: new Request('https://preview.example.com/api/stitch-webhook', { method: 'POST', headers, body: raw + ' ' }), env: { STITCH_MODE: 'test', STITCH_WEBHOOK_SECRET: secret } })).status, 400);
});
}

const liveEnv = () => ({ ...env, STITCH_MODE: 'live', STITCH_CLIENT_ID: 'live-fixture', STITCH_SITE_URL: 'https://www.fashforge.co.za', ORDERS: new MemoryKV() });
test('complete live config enables checkout; incomplete and mismatched modes fail closed', async () => {
    const live = liveEnv();
    assert.equal(requireStitchConfig(live), 'live');
    assert.equal(requireCheckoutConfig(live), 'live');
    assert.doesNotThrow(() => requireStitchConfig({ ...live, CHECKOUT_ENABLED: 'false' }));
    const req = new Request('https://www.fashforge.co.za/api/site-config');
    assert.deepEqual(await siteConfig({ request: req, env: live }).json(), { checkoutEnabled: true, checkoutMode: 'live' });
    const invalid = [{ STITCH_MODE: undefined }, { STITCH_MODE: '' }, { STITCH_MODE: 'LIVE' }, { STITCH_CLIENT_ID: 'test-fixture' }, { STITCH_CLIENT_ID: '' }, { STITCH_CLIENT_ID: 123 }, { STITCH_CLIENT_ID: ' test-fixture' }, { STITCH_CLIENT_SECRET: undefined }, { STITCH_CLIENT_SECRET: ' ' }, { STITCH_WEBHOOK_SECRET: undefined }, { STITCH_WEBHOOK_SECRET: 'not-base64!' }, { ORDERS: undefined }, { ORDERS: { get: true, put: true } }, { STITCH_SITE_URL: undefined }, { STITCH_SITE_URL: 'http://www.fashforge.co.za' }, { STITCH_SITE_URL: 'https://example.com/path' }, { STITCH_SITE_URL: 'https://user:pass@example.com' }, { CHECKOUT_ENABLED: 'false' }];
    for (const change of invalid) {
        const config = { ...live, ...change };
        assert.throws(() => requireCheckoutConfig(config), { status: 503 });
        assert.deepEqual(await siteConfig({ request: req, env: config }).json(), { checkoutEnabled: false, checkoutMode: null });
        assert.equal((await checkout({ request: request({ customer, items: [item], deliveryMethod: 'door' }), env: config })).status, 503);
    }
    assert.doesNotThrow(() => requireCheckoutConfig({ ...live, STITCH_SITE_URL: 'https://another.example', STITCH_WEBHOOK_SECRET: 'whsec_' + live.STITCH_WEBHOOK_SECRET }));
});
test('checkout selects mode only from env, generates unique matching references and uses Express live contract', async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, options) => {
        calls.push({ url, body: JSON.parse(options.body) });
        return Response.json({ success: true, data: url.endsWith('/token') ? { accessToken: 'mode-fixture-token' } : { payment: { id: 'mode-link', link: 'https://express.stitch.money/mode-link' } } });
    };
    try {
        const refs = new Set();
        for (const mode of ['live', 'test']) {
            const config = { ...(mode === 'live' ? liveEnv() : env), STITCH_CLIENT_ID: mode === 'test' ? 'test-mode-contract' : 'live-mode-contract' };
            for (let i = 0; i < 2; i++) {
                const response = await checkout({ request: request({ customer, items: [item], deliveryMethod: 'door', mode: mode === 'live' ? 'test' : 'live', reference: 'forged' }), env: config });
                assert.equal(response.status, 200);
                const data = await response.json(); refs.add(data.reference);
                assert.equal(referenceMode(data.reference), mode);
                const stored = await config.ORDERS.get(data.reference, 'json');
                assert.equal(stored.mode, mode);
                assert.equal(stored.total, priceCart([item], 'door').total);
                assert.equal(new URL(new URL(data.redirectUrl).searchParams.get('redirect_url')).searchParams.get('ref'), data.reference);
            }
        }
        assert.equal(refs.size, 4);
        const tokens = calls.filter(c => c.url.endsWith('/token'));
        assert.equal(tokens.length, 2);
        for (const call of tokens) { assert.equal(call.url, 'https://express.stitch.money/api/v1/token'); assert.equal(call.body.scope, 'client_paymentrequest'); }
        assert.ok(calls.filter(c => !c.url.endsWith('/token')).every(c => c.url === 'https://express.stitch.money/api/v1/payment-links'));
        assert.equal(referenceMode('FF-not-a-uuid'), null);
    } finally { globalThis.fetch = originalFetch; }
});
for (const mode of ['test', 'live']) {
    test(mode + ' webhook reconciles and retries mode-specific emails with identical bodies', async () => {
        await orderFixture(async ({ config, orders, order, attempts, sent, event, control, statusRequest }) => {
            control.failCustomerOnce = true;
            // Turning off new checkouts must not strand an existing paid order.
            config.CHECKOUT_ENABLED = 'false';
            assert.equal((await webhook({ request: event(), env: config })).status, 503);
            assert.equal((await webhook({ request: event(), env: config })).status, 200);
            assert.equal(sent.size, 2);
            assert.equal((await orders.get(order.reference, 'json')).status, 'paid');
            const customerAttempts = attempts.filter(a => a.body.to[0] === customer.email);
            assert.deepEqual(customerAttempts[0].body, customerAttempts[1].body);
            for (const attempt of attempts) assert.ok(attempt.idempotencyKey.startsWith((mode === 'test' ? 'test-order-paid/' : 'order-paid/') + order.reference + '/'));
            const owner = attempts[0].body;
            const recipient = customerAttempts[0].body;
            if (mode === 'live') {
                assert.match(owner.subject, /^New paid order FF-/);
                assert.ok(!owner.text.includes('TEST ORDER'));
                assert.ok(!owner.subject.includes('[TEST]'));
                assert.equal(recipient.subject, 'Your FashForge order is confirmed');
                assert.ok(!recipient.html.includes('Test order'));
                assert.ok(!recipient.text.includes('Test order'));
            } else {
                assert.ok(owner.subject.startsWith('[TEST]'));
                assert.ok(owner.text.includes('TEST ORDER'));
                assert.ok(recipient.html.includes('Test order'));
            }
            assert.equal((await webhook({ request: event(), env: config })).status, 200);
            assert.equal(attempts.length, 3);
            assert.equal((await (await orderStatus({ request: statusRequest(), env: config })).json()).status, 'paid');
            assert.equal((await webhook({ request: event('wrong-secret'), env: { ...config, STITCH_WEBHOOK_SECRET: randomBytes(32).toString('base64') } })).status, 400);
        }, { STITCH_MODE: mode, STITCH_CLIENT_ID: mode === 'test' ? 'test-webhook-mode' : 'live-webhook-mode' });
    });
    test(mode + ' endpoint rejects opposite-mode and prefix-mismatched stored orders', async () => {
        await orderFixture(async ({ config, orders, order, link, event, attempts }) => {
            const other = mode === 'test' ? 'live' : 'test';
            const otherRef = other === 'test' ? orderRef : orderRef.replace('FF-TEST-', 'FF-');
            await orders.put(otherRef, JSON.stringify({ ...order, reference: otherRef, mode: other }));
            link.merchantReference = otherRef;
            assert.equal((await webhook({ request: event(), env: config })).status, 503);
            assert.equal((await orders.get(otherRef, 'json')).status, 'pending');
            assert.equal(await orders.get('event:event-1'), null);
            assert.equal(await orders.get('paid:' + otherRef), null);
            assert.equal(await readOrder(config, otherRef), null);
            const response = await orderStatus({ request: new Request('https://preview.example.com/api/order-status?ref=' + otherRef), env: config });
            assert.equal(response.status, 404);
            // A record claiming the current mode under the opposite prefix also fails.
            await orders.put(otherRef, JSON.stringify({ ...order, reference: otherRef }));
            assert.equal(await readOrder(config, otherRef), null);
            link.merchantReference = order.reference;
            await orders.put(order.reference, JSON.stringify({ ...order, mode: other }));
            assert.equal((await webhook({ request: event('mismatch'), env: config })).status, 503);
            assert.equal(attempts.length, 0);
        }, { STITCH_MODE: mode, STITCH_CLIENT_ID: mode === 'test' ? 'test-isolation' : 'live-isolation' });
    });
}
test('live return page accepts live references and shows no test wording', async () => {
    const reference = orderRef.replace('FF-TEST-', 'FF-');
    const page = await statusPage([Response.json({ status: 'paid', total: 10000 }, { headers: { 'X-Order-Confirmation': 'sent' } })], '?ref=' + reference);
    assert.equal(page.cleared(), 1);
    assert.equal(page.calls[0], '/api/order-status?ref=' + reference);
    assert.ok(!/test/i.test(page.elements['order-message'].textContent));
    for (const path of ['checkout-success.html', 'checkout-cancelled.html']) assert.ok(!/test checkout/i.test(readFileSync(new URL('../' + path, import.meta.url), 'utf8')));
    for (const mode of ['live', 'test']) {
        const context = { window: { FASHFORGE: { checkoutEnabled: false } }, AbortSignal, fetch: async () => Response.json({ checkoutEnabled: true, checkoutMode: mode }) };
        vm.runInNewContext(purchaseHelpers, context); await context.loadCheckoutFlag();
        assert.equal(context.window.FASHFORGE.checkoutMode, mode);
    }
});

test('failed capability responses cannot retain stale enabled checkout', async () => {
    for (const response of [Response.json({}, { status: 503 }), Response.json({}), new Response('not JSON')]) {
        const context = { window: { FASHFORGE: { checkoutEnabled: true, checkoutMode: 'live' } }, AbortSignal, fetch: async () => response };
        vm.runInNewContext(purchaseHelpers, context);
        await context.loadCheckoutFlag();
        assert.equal(context.window.FASHFORGE.checkoutEnabled, false);
        assert.equal(context.window.FASHFORGE.checkoutMode, null);
    }
});
