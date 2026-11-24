// Mode and credentials are selected only by the deployment environment.
export class CheckoutError extends Error {
    constructor(message, status = 400) { super(message); this.status = status; }
}
const nonempty = value => typeof value === 'string' && !!value.trim();
export function siteOrigin(env) {
    try {
        const url = new URL(env.STITCH_SITE_URL);
        if (url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) return url;
    } catch { /* Invalid URLs fail closed before creating a payment. */ }
    throw new CheckoutError('Checkout is temporarily unavailable. Please contact us for help.', 503);
}
function requireServices(env) {
    siteOrigin(env);
    if (!nonempty(env.STITCH_WEBHOOK_SECRET) || typeof env.ORDERS?.get !== 'function' || typeof env.ORDERS?.put !== 'function') {
        throw new CheckoutError('Checkout is temporarily unavailable. Please contact us for help.', 503);
    }
    try {
        const secret = env.STITCH_WEBHOOK_SECRET.replace(/^whsec_/, '');
        if (!atob(secret).length) throw new Error('Empty signing key');
    } catch { throw new CheckoutError('Checkout is temporarily unavailable. Please contact us for help.', 503); }
}
export function requireStitchConfig(env) {
    const mode = env.STITCH_MODE;
    if (!['test', 'live'].includes(mode) || !nonempty(env.STITCH_CLIENT_ID) || !nonempty(env.STITCH_CLIENT_SECRET) ||
        env.STITCH_CLIENT_ID !== env.STITCH_CLIENT_ID.trim() ||
        (mode === 'test') !== env.STITCH_CLIENT_ID.startsWith('test-')) {
        throw new CheckoutError('Checkout is temporarily unavailable. Please contact us for help.', 503);
    }
    if (mode === 'live') requireServices(env);
    return mode;
}
export function requireCheckoutConfig(env) {
    if (env.CHECKOUT_ENABLED !== 'true') throw new CheckoutError('Checkout is not enabled.', 503);
    const mode = requireStitchConfig(env);
    requireServices(env);
    return mode;
}
