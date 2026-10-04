const { readConfig } = require('../lib/config');
const { buildCheckout, CheckoutError } = require('../lib/order');
const { json, readJsonBody } = require('../lib/http');

async function handleCheckout(event, deps = {}) {
    if (!event || event.httpMethod !== 'POST') {
        return json(405, { error: 'Method not allowed' });
    }
    try {
        const config = readConfig(deps.env || process.env);
        const body = readJsonBody(event);
        const built = buildCheckout(body, config, deps.now, deps.randomInt);
        return json(200, {
            orderRef: built.orderRef,
            processUrl: built.processUrl,
            amount: built.amount,
            fields: built.fields
        });
    } catch (err) {
        const status = err.statusCode || 500;
        if (!(err instanceof CheckoutError) && !err.publicMessage) {
            console.error('payfast-checkout failed', err);
        }
        const message = err.publicMessage || err instanceof CheckoutError
            ? err.message
            : 'Card payment could not be started. Please try again.';
        return json(status, { error: message });
    }
}

exports.handler = (event) => handleCheckout(event);
exports.handleCheckout = handleCheckout;
