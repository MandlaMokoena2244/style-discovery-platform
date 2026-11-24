import { CheckoutError, json, readBody, priceCart, validateCustomer, createPayment } from '../../lib/stitch-checkout.mjs';
import { requireCheckoutConfig } from '../../lib/stitch-config.mjs';
import { requireOrders, savePendingOrder } from '../../lib/orders.mjs';

export async function onRequest({ request, env }) {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
    try {
        requireCheckoutConfig(env);
        if (request.headers.get('Origin') !== new URL(request.url).origin) throw new CheckoutError('Invalid request origin.', 403);
        if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new CheckoutError('Send JSON.', 415);
        let body;
        try { body = JSON.parse(new TextDecoder().decode(await readBody(request))); }
        catch (error) { if (error instanceof CheckoutError) throw error; throw new CheckoutError('Invalid JSON.'); }
        const customer = validateCustomer(body?.customer);
        const totals = priceCart(body?.items, body?.deliveryMethod);
        requireOrders(env);
        const payment = await createPayment(env, customer, totals);
        // Do not hand out a payable link until its full order has been saved.
        await savePendingOrder(env, payment, customer, body.deliveryMethod, totals);
        const { paymentLinkId, ...response } = payment;
        return json(response);
    } catch (error) {
        // Never log credentials, upstream responses, customer details or raw bodies.
        return json({ error: error instanceof CheckoutError ? error.message : 'Checkout is temporarily unavailable.' }, error instanceof CheckoutError ? error.status : 502);
    }
}
