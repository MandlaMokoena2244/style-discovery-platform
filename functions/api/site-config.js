import { requireCheckoutConfig } from '../../lib/stitch-config.mjs';
// Public capabilities only. Never return credentials or the rest of env.
export function onRequest({ request, env }) {
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } });
    let checkoutMode = null;
    try { checkoutMode = requireCheckoutConfig(env); } catch { /* Incomplete configuration is off. */ }
    return Response.json({ checkoutEnabled: checkoutMode !== null, checkoutMode }, { headers: { 'Cache-Control': 'no-store' } });
}
