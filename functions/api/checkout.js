import { CheckoutError, json, readBody, priceCart, validateCustomer, requireTestConfig, createPayment } from '../../lib/stitch-checkout.mjs';

export async function onRequest({ request, env }) {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
    try {
        if (env.CHECKOUT_ENABLED !== 'true') throw new CheckoutError('Checkout is not enabled.', 503);
        requireTestConfig(env);
        if (request.headers.get('Origin') !== new URL(request.url).origin) throw new CheckoutError('Invalid request origin.', 403);
        if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new CheckoutError('Send JSON.', 415);
        let body;
        try { body = JSON.parse(new TextDecoder().decode(await readBody(request))); }
        catch (error) { if (error instanceof CheckoutError) throw error; throw new CheckoutError('Invalid JSON.'); }
        const customer = validateCustomer(body?.customer);
        const totals = priceCart(body?.items, body?.deliveryMethod);
        return json(await createPayment(env, customer, totals));
    } catch (error) {
        // Never log credentials, upstream responses, customer details or raw bodies.
        return json({ error: error instanceof CheckoutError ? error.message : 'Test checkout is temporarily unavailable.' }, error instanceof CheckoutError ? error.status : 502);
    }
}
