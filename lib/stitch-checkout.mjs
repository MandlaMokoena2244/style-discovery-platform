// Official contracts: https://express.stitch.money/api/openapi.json
// https://express.stitch.money/api-docs/quickstart
import catalogue from '../products.json' with { type: 'json' };

export class CheckoutError extends Error {
    constructor(message, status = 400) { super(message); this.status = status; }
}
export const provinces = ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape'];
// Published site-config.js rules; parity is checked by test/stitch.test.mjs.
export const delivery = { doorToDoor: 99, locker: 70, freeFrom: 2000 };
export function json(value, status = 200) {
    return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}
export async function readBody(request, limit = 16384) {
    const reader = request.body?.getReader();
    if (!reader) throw new CheckoutError('Request body is required.');
    const chunks = []; let length = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > limit) { await reader.cancel(); throw new CheckoutError('Request is too large.', 413); }
        chunks.push(value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return bytes;
}
export function validateCustomer(input) {
    if (!input || typeof input !== 'object') throw new CheckoutError('Enter delivery details.');
    const customer = {};
    for (const [key, min, max] of [['name',3,40],['email',3,100],['mobile',10,20],['street',3,120],['suburb',2,80],['city',2,60],['province',2,30],['postalCode',4,4]]) {
        const value = typeof input[key] === 'string' ? input[key].trim() : '';
        if (value.length < min || value.length > max || /[\u0000-\u001f]/.test(value)) throw new CheckoutError('Check your ' + key + '.');
        customer[key] = value;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) throw new CheckoutError('Enter a valid email address.');
    const mobile = customer.mobile.replace(/[\s()-]/g, '').replace(/^(?:\+27|27)/, '0');
    if (!/^0[6-8]\d{8}$/.test(mobile)) throw new CheckoutError('Enter a South African mobile number.');
    customer.mobile = '+27' + mobile.slice(1);
    if (!provinces.includes(customer.province) || !/^\d{4}$/.test(customer.postalCode)) throw new CheckoutError('Enter a South African delivery address.');
    if (input.country !== 'ZA') throw new CheckoutError('Delivery is available in South Africa only.');
    return customer;
}
export function priceCart(items, method) {
    if (!Array.isArray(items) || !items.length || items.length > 50) throw new CheckoutError('Choose between 1 and 50 cart items.');
    if (!['door', 'locker'].includes(method)) throw new CheckoutError('Choose a delivery method.');
    const quantities = new Map();
    let subtotal = 0;
    for (const item of items) {
        const product = catalogue.products.find(p => p.id === item?.id && p.sellAlone === true);
        if (!product || product.inStock === false || (Array.isArray(product.sizes) && !product.sizes.length)) throw new CheckoutError('An item is unavailable. Remove it from your cart.');
        if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 20) throw new CheckoutError('Quantity must be between 1 and 20.');
        const count = (quantities.get(product.id) || 0) + item.qty;
        if (count > 20) throw new CheckoutError('Maximum 20 units per product.');
        quantities.set(product.id, count);
        if (Array.isArray(product.sizes) && !product.sizes.includes(item.size)) throw new CheckoutError('Select an available size for ' + product.name + '.');
        const cents = Math.round(product.price * 100);
        if (typeof product.price !== 'number' || !Number.isSafeInteger(cents) || cents <= 0) throw new CheckoutError('Catalogue price unavailable.', 503);
        subtotal += cents * item.qty;
    }
    const deliveryFee = subtotal >= delivery.freeFrom * 100 ? 0 : (method === 'door' ? delivery.doorToDoor : delivery.locker) * 100;
    return { subtotal, deliveryFee, total: subtotal + deliveryFee };
}
const API = 'https://express.stitch.money';
let cached;
async function api(path, body, token) {
    const response = await fetch(API + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000)
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.success !== true) throw new CheckoutError('Stitch test checkout is unavailable. Please try again later.', 502);
    return result.data;
}
export function requireTestConfig(env) {
    // Test credentials use test- per the Express quick start. Fail closed on live credentials.
    if (env.STITCH_MODE !== 'test' || !env.STITCH_CLIENT_ID?.startsWith('test-') || !env.STITCH_CLIENT_SECRET?.startsWith('test-')) {
        throw new CheckoutError('Test checkout is not configured.', 503);
    }
}
export async function createPayment(env, customer, totals) {
    requireTestConfig(env);
    const origin = new URL(env.STITCH_SITE_URL);
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new CheckoutError('Test checkout URL is not configured.', 503);
    if (!cached || cached.client !== env.STITCH_CLIENT_ID || cached.secret !== env.STITCH_CLIENT_SECRET || cached.until <= Date.now()) {
        const data = await api('/api/v1/token', { clientId: env.STITCH_CLIENT_ID, clientSecret: env.STITCH_CLIENT_SECRET, scope: 'client_paymentrequest' });
        if (typeof data?.accessToken !== 'string' || !data.accessToken) throw new CheckoutError('Stitch authentication failed.', 502);
        cached = { client: env.STITCH_CLIENT_ID, secret: env.STITCH_CLIENT_SECRET, token: data.accessToken, until: Date.now() + 14 * 60000 };
    }
    const reference = 'FF-TEST-' + crypto.randomUUID();
    // TODO: Persist the validated cart/address against reference before creating a link.
    // No documented API field accepts a pre-collected address. Do not invent one.
    // Include shipping in amount exactly once; do not request hosted delivery collection.
    const data = await api('/api/v1/payment-links', {
        amount: totals.total, payerName: customer.name, payerEmailAddress: customer.email,
        payerPhoneNumber: customer.mobile, merchantReference: reference,
        expiresAt: new Date(Date.now() + 30 * 60000).toISOString(),
        collectDeliveryDetails: false
    }, cached.token);
    const redirect = new URL(data?.payment?.link);
    if (redirect.origin !== API || redirect.username || redirect.password) throw new CheckoutError('Invalid checkout URL from Stitch.', 502);
    // Register this exact URL once in Stitch. There is no documented cancel_url.
    redirect.searchParams.set('redirect_url', origin.origin + '/checkout-success.html');
    return { redirectUrl: redirect.href, reference, amount: totals.total, deliveryFee: totals.deliveryFee };
}
