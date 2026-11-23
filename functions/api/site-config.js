// Public UI capability only. Never return credentials or the rest of env.
export function onRequest({ request, env }) {
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } });
    const checkoutEnabled = env.CHECKOUT_ENABLED === 'true' && env.STITCH_MODE === 'test' &&
        typeof env.STITCH_CLIENT_ID === 'string' && env.STITCH_CLIENT_ID.startsWith('test-') &&
        typeof env.STITCH_CLIENT_SECRET === 'string' && !!env.STITCH_CLIENT_SECRET.trim();
    return Response.json({ checkoutEnabled }, { headers: { 'Cache-Control': 'no-store' } });
}
