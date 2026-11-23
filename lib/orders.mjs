import { customerEmail, enrichItems } from './order-email.mjs';
import { CheckoutError, getPaymentLink, requireTestConfig } from './stitch-checkout.mjs';

export const REFERENCE_RE = /^FF-TEST-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function requireOrders(env) {
    requireTestConfig(env);
    if (!env.ORDERS?.get || !env.ORDERS?.put) throw new CheckoutError('Order storage is not configured.', 503);
}
export async function savePendingOrder(env, payment, customer, deliveryMethod, totals) {
    const order = {
        reference: payment.reference, mode: 'test', paymentLinkId: payment.paymentLinkId,
        customer, deliveryMethod, items: totals.items, currency: 'ZAR',
        subtotal: totals.subtotal, deliveryFee: totals.deliveryFee, total: totals.total,
        status: 'pending', createdAt: new Date().toISOString()
    };
    await env.ORDERS.put(order.reference, JSON.stringify(order));
    return order;
}
export async function readOrder(env, reference) {
    if (!REFERENCE_RE.test(reference || '')) return null;
    const order = await env.ORDERS.get(reference, 'json');
    if (!order || order.mode !== 'test' || order.reference !== reference) return null;
    // A separate monotonic marker protects paid status from stale cancellation writes.
    const paid = await env.ORDERS.get('paid:' + reference, 'json');
    return paid ? { ...order, status: 'paid', ...paid } : order;
}
function matchOrder(order, link) {
    if (link.merchantReference !== order.reference || link.id !== order.paymentLinkId || link.amount !== order.total) {
        throw new CheckoutError('Payment does not match the order.', 409);
    }
}
export async function refreshUnpaidStatus(env, order) {
    if (order.status === 'paid') return order;
    const link = await getPaymentLink(env, order.paymentLinkId);
    matchOrder(order, link);
    // Express only emits payment.paid. Negative outcomes are read from the link.
    const status = link.status === 'CANCELLED' ? 'cancelled' : link.status === 'EXPIRED' ? 'failed' : 'pending';
    if (status !== order.status) {
        const latest = await readOrder(env, order.reference);
        if (latest?.status === 'paid') return latest;
        order = { ...order, status };
        await env.ORDERS.put(order.reference, JSON.stringify(order));
    }
    // A PAID link remains pending here until its verified webhook has been processed.
    return order;
}
const money = cents => 'R' + (cents / 100).toFixed(2);
function emailBody(order, audience, env) {
    if (audience === 'customer') return customerEmail(order, env);
    const c = order.customer;
    const common = ['TEST ORDER — no fulfilment', 'Order: ' + order.reference, 'Total: ' + money(order.total)];
    const details = [
        'Customer: ' + c.name, 'Email: ' + c.email, 'Mobile: ' + c.mobile,
        'Address: ' + [c.street, c.suburb, c.city, c.province, c.postalCode, c.country].join(', '),
        'Delivery: ' + order.deliveryMethod, 'Delivery note: ' + (c.note || 'None'),
        ...enrichItems(order).map(i => i.name + (i.code ? ' / SKU ' + i.code : '') + ' [' + i.id + '] / ' + (i.size || 'One size') + ' / Qty ' + i.qty + ' / Unit ' + money(i.unitPrice)),
        'Subtotal: ' + money(order.subtotal), 'Delivery fee: ' + money(order.deliveryFee),
        'Created: ' + order.createdAt
    ];
    return {
        from: env.ORDER_FROM_EMAIL,
        to: [env.ORDER_NOTIFY_EMAIL],
        subject: '[TEST] Paid order ' + order.reference,
        text: [...common, '', ...details].join('\n')
    };
}
export async function notifyPaidOrder(env, order) {
    // Separate recipient receipts survive partial failures. Resend also deduplicates
    // concurrent requests while KV reads may still be stale (24-hour provider window).
    for (const audience of ['owner', 'customer']) {
        const key = 'email:' + order.reference + ':' + audience;
        if (await env.ORDERS.get(key)) continue;
        let skip;
        if (!env.RESEND_API_KEY) skip = 'missing_api_key';
        else if (!env.ORDER_FROM_EMAIL || !env.ORDER_NOTIFY_EMAIL) skip = 'missing_email_addresses';
        // Avoid replaying an ambiguous send beyond Resend's idempotency retention.
        // Provider paidAt is stable across deliveries, unlike a webhook delivery timestamp.
        else if (Date.now() - Date.parse(order.paidAt) > 23 * 60 * 60 * 1000) skip = 'retry_window_expired';
        if (skip) {
            console.info('Order email skipped', { reference: order.reference, audience, reason: skip });
            await env.ORDERS.put(key, JSON.stringify({ status: 'skipped', reason: skip }));
            continue;
        }
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json',
                'Idempotency-Key': 'test-order-paid/' + order.reference + '/' + audience
            },
            body: JSON.stringify(emailBody(order, audience, env)),
            signal: AbortSignal.timeout(15000)
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || typeof result?.id !== 'string') throw new CheckoutError('Order email is temporarily unavailable.', 503);
        await env.ORDERS.put(key, JSON.stringify({ status: 'sent', id: result.id }));
    }
}
export async function processPaymentEvent(env, payload, eventId) {
    requireOrders(env);
    if (!eventId || eventId.length > 200) throw new CheckoutError('Invalid event ID.');
    const eventKey = 'event:' + eventId;
    if (await env.ORDERS.get(eventKey)) return;
    // merchantReference is not in the documented webhook payload. Look up its link
    // using the same test credentials; never trust a browser or guessed event field.
    const link = await getPaymentLink(env, payload.linkId);
    const order = await readOrder(env, link.merchantReference);
    if (!order) throw new CheckoutError('Order is not available yet.', 503);
    matchOrder(order, link);
    if (payload.amount !== order.total || link.status !== 'PAID' || link.paymentId !== payload.id) {
        throw new CheckoutError('Payment does not match the order.', 409);
    }
    if (order.paymentId && order.paymentId !== payload.id) throw new CheckoutError('Order already has a different payment.', 409);
    const paidAt = Number.isFinite(Date.parse(link.paidAt)) ? link.paidAt : order.createdAt;
    const paid = { paymentId: payload.id, paidAt };
    if (order.status !== 'paid') {
        await env.ORDERS.put('paid:' + order.reference, JSON.stringify(paid));
    }
    await env.ORDERS.put(order.reference, JSON.stringify({ ...order, ...paid, status: 'paid' }));
    await notifyPaidOrder(env, { ...order, ...paid, status: 'paid' });
    // Acknowledge only after payment storage and both email receipts (sent/skipped).
    await env.ORDERS.put(eventKey, JSON.stringify({ reference: order.reference, paymentId: payload.id }));
    console.info('Stitch order paid', { reference: order.reference, eventId });
}
