import { CheckoutError, json, readBody } from '../../lib/stitch-checkout.mjs';
import { processPaymentEvent } from '../../lib/orders.mjs';
// https://express.stitch.money/api-docs/webhooks
// https://docs.svix.com/receiving/verifying-payloads/how-manual
export async function verifyWebhook(bytes, headers, secret, now = Date.now()) {
    const id = headers.get('svix-id');
    const timestamp = headers.get('svix-timestamp');
    const signatures = headers.get('svix-signature');
    if (!id || !/^\d+$/.test(timestamp || '') || !signatures || Math.abs(now / 1000 - Number(timestamp)) > 300) throw new Error('Invalid signature');
    if (typeof secret !== 'string' || !secret) throw new Error('Invalid configuration');
    const encodedSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
    const keyBytes = Uint8Array.from(atob(encodedSecret), c => c.charCodeAt(0));
    if (!keyBytes.length) throw new Error('Invalid configuration');
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const prefix = new TextEncoder().encode(id + '.' + timestamp + '.');
    const signed = new Uint8Array(prefix.length + bytes.length);
    signed.set(prefix); signed.set(bytes, prefix.length);
    for (const part of signatures.split(' ')) {
        if (!part.startsWith('v1,')) continue;
        try {
            const signature = Uint8Array.from(atob(part.slice(3)), c => c.charCodeAt(0));
            if (await crypto.subtle.verify('HMAC', key, signature, signed)) return;
        } catch { /* Invalid rotation candidates cannot bypass verification. */ }
    }
    throw new Error('Invalid signature');
}
export async function onRequest({ request, env }) {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
    if (!['test', 'live'].includes(env.STITCH_MODE) || !env.STITCH_WEBHOOK_SECRET) return json({ error: 'Webhook is not configured.' }, 503);
    let payload;
    try {
        const bytes = await readBody(request, 65536);
        await verifyWebhook(bytes, request.headers, env.STITCH_WEBHOOK_SECRET);
        payload = JSON.parse(new TextDecoder().decode(bytes));
    } catch (error) {
        return json({ error: 'Invalid webhook.' }, error instanceof CheckoutError ? error.status : 400);
    }
    if (typeof payload?.id !== 'string' || !payload.id || payload.status !== 'PAID' || !Number.isSafeInteger(payload.amount)) return json({ error: 'Invalid payment event.' }, 400);
    // Other Express products can share the account webhook; they are not cart orders.
    if (['CONSENT', 'SUBSCRIPTION', 'TERMINAL'].includes(payload.type)) return json({ received: true });
    if (payload.type !== 'LINK' || typeof payload.linkId !== 'string' || !payload.linkId) return json({ error: 'Invalid payment event.' }, 400);
    try {
        await processPaymentEvent(env, payload, request.headers.get('svix-id'));
        return json({ received: true });
    } catch (error) {
        // KV/API/email failures must be retried, not acknowledged as processed.
        console.warn('Stitch order processing deferred', { eventId: request.headers.get('svix-id') });
        return json({ error: 'Order processing is not complete. Please retry.' }, error instanceof CheckoutError ? error.status : 503);
    }
}
