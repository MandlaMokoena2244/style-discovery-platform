import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHmac, randomBytes } from 'node:crypto';
import catalogue from '../products.json' with { type: 'json' };
import { priceCart, validateCustomer, delivery, requireTestConfig } from '../lib/stitch-checkout.mjs';
import { onRequest as checkout } from '../functions/api/checkout.js';
import { onRequest as webhook, verifyWebhook } from '../functions/api/stitch-webhook.js';

const product = catalogue.products.find(p => p.sellAlone && p.sizes?.length && p.inStock !== false);
const item = { id: product.id, size: product.sizes[0], qty: 1 };
const customer = { name: 'Test Customer', email: 'test@example.com', mobile: '0820000000', street: '1 Test Street', suburb: 'Test Suburb', city: 'Johannesburg', province: 'Gauteng', postalCode: '2000', country: 'ZA' };
const env = { CHECKOUT_ENABLED: 'true', STITCH_MODE: 'test', STITCH_CLIENT_ID: 'test-placeholder', STITCH_CLIENT_SECRET: 'test-placeholder', STITCH_SITE_URL: 'https://preview.example.com' };
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
    assert.throws(() => requireTestConfig({ ...env, STITCH_MODE: 'live' }));
    assert.throws(() => requireTestConfig({ ...env, STITCH_CLIENT_ID: 'live-placeholder' }));
    assert.throws(() => requireTestConfig({ ...env, STITCH_CLIENT_SECRET: 'live-placeholder' }));
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
        assert.match(html, /cart has been kept/);
        assert.ok(!readFileSync(new URL('../sitemap.xml', import.meta.url), 'utf8').includes(name));
    }
});
test('checkout HTTP guardrails and documented API contract', async () => {
    const body = { customer, items: [{ ...item, price: 1 }], deliveryMethod: 'door' };
    assert.equal((await checkout({ request: request(body), env: {} })).status, 503);
    assert.equal((await checkout({ request: request(body, { headers: { Origin: 'https://attacker.example' } }), env })).status, 403);
    assert.equal((await checkout({ request: request('{'), env })).status, 400);
    assert.equal((await checkout({ request: request(' '.repeat(17000)), env })).status, 413);
    assert.equal((await checkout({ request: new Request('https://preview.example.com/api/checkout'), env })).status, 405);
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, options) => {
        calls.push({ url, options, body: JSON.parse(options.body) });
        return Response.json({ success: true, data: url.endsWith('/token') ? { accessToken: 'mock-token' } : { payment: { id: 'mock-link', link: 'https://express.stitch.money/mock-link' } } });
    };
    try {
        const result = await checkout({ request: request(body), env });
        assert.equal(result.status, 200);
        const data = await result.json();
        assert.equal(calls[0].url, 'https://express.stitch.money/api/v1/token');
        assert.deepEqual(calls[0].body, { clientId: env.STITCH_CLIENT_ID, clientSecret: env.STITCH_CLIENT_SECRET, scope: 'client_paymentrequest' });
        assert.equal(calls[1].url, 'https://express.stitch.money/api/v1/payment-links');
        assert.equal(calls[1].options.headers.Authorization, 'Bearer mock-token');
        assert.equal(calls[1].body.amount, priceCart([item], 'door').total);
        assert.equal(calls[1].body.collectDeliveryDetails, false);
        assert.equal(calls[1].body.deliveryFee, undefined);
        assert.equal(new URL(data.redirectUrl).searchParams.get('redirect_url'), env.STITCH_SITE_URL + '/checkout-success.html');
        assert.ok(!JSON.stringify(data).includes('mock-token'));
        await checkout({ request: request(body), env });
        assert.equal(calls.filter(c => c.url.endsWith('/token')).length, 1);
        globalThis.fetch = async () => Response.json({ success: false, secret: 'never-return-this' }, { status: 500 });
        const failure = await checkout({ request: request(body), env });
        assert.equal(failure.status, 502);
        assert.ok(!(await failure.text()).includes('never-return-this'));
    } finally { globalThis.fetch = originalFetch; }
});
test('webhook raw-body HMAC, rotations, timestamps, retries and tampering', async () => {
    const key = randomBytes(32);
    const secret = 'whsec_' + key.toString('base64');
    const timestamp = String(Math.floor(Date.now() / 1000));
    const raw = JSON.stringify({ id: 'test-payment', status: 'PAID', amount: 100, type: 'LINK', linkId: 'test-link' });
    const signature = createHmac('sha256', key).update('msg-test.' + timestamp + '.' + raw).digest('base64');
    const headers = new Headers({ 'svix-id': 'msg-test', 'svix-timestamp': timestamp, 'svix-signature': 'v1,invalid v1,' + signature });
    const bytes = new TextEncoder().encode(raw);
    await verifyWebhook(bytes, headers, secret);
    await assert.rejects(verifyWebhook(new TextEncoder().encode(raw + ' '), headers, secret));
    await assert.rejects(verifyWebhook(bytes, headers, secret, Number(timestamp) * 1000 + 301000));
    await assert.rejects(verifyWebhook(bytes, headers, secret, Number(timestamp) * 1000 - 301000));
    await assert.rejects(verifyWebhook(bytes, new Headers(), secret));
    for (let i = 0; i < 2; i++) assert.equal((await webhook({ request: new Request('https://preview.example.com/api/stitch-webhook', { method: 'POST', headers, body: raw }), env: { STITCH_MODE: 'test', STITCH_WEBHOOK_SECRET: secret } })).status, 200);
    assert.equal((await webhook({ request: new Request('https://preview.example.com/api/stitch-webhook', { method: 'POST', headers, body: raw + ' ' }), env: { STITCH_MODE: 'test', STITCH_WEBHOOK_SECRET: secret } })).status, 400);
});
