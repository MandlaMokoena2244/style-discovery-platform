import { CheckoutError, json } from '../../lib/stitch-checkout.mjs';
import { REFERENCE_RE, requireOrders, readOrder, refreshUnpaidStatus } from '../../lib/orders.mjs';

export async function onRequest({ request, env }) {
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } });
    try {
        requireOrders(env);
        const reference = new URL(request.url).searchParams.get('ref');
        if (!REFERENCE_RE.test(reference || '')) return json({ error: 'Invalid order reference.' }, 400);
        let order = await readOrder(env, reference);
        if (!order) return json({ error: 'Order not found yet.' }, 404);
        order = await refreshUnpaidStatus(env, order);
        // References are random UUID capabilities. No customer/cart data is public.
        const response = json({ status: order.status, total: order.total });
        if (order.status === 'paid') {
            const receipt = await env.ORDERS.get('email:' + reference + ':customer', 'json');
            // Non-personal header keeps the JSON contract limited to status and total
            // and avoids claiming an email was sent when it was skipped or is retrying.
            response.headers.set('X-Order-Confirmation', receipt?.status === 'sent' ? 'sent' : receipt?.status === 'skipped' ? 'skipped' : 'pending');
        }
        return response;
    } catch (error) {
        return json({ error: 'Your order status is temporarily unavailable.' }, error instanceof CheckoutError ? error.status : 503);
    }
}
