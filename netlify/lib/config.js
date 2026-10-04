const { CheckoutError } = require('./order');

function readConfig(env) {
    const source = env || {};
    const mode = String(source.PAYFAST_MODE || '').trim().toLowerCase();
    if (mode !== 'sandbox' && mode !== 'live') {
        console.error('PayFast config: PAYFAST_MODE must be sandbox or live');
        throw new CheckoutError('Card payments are not available yet. WhatsApp us on +27 67 256 5980.', 503);
    }
    const merchantId = String(source.PAYFAST_MERCHANT_ID || '').trim();
    const merchantKey = String(source.PAYFAST_MERCHANT_KEY || '').trim();
    if (!merchantId || !merchantKey) {
        console.error('PayFast config: merchant id or merchant key is missing');
        throw new CheckoutError('Card payments are not available yet. WhatsApp us on +27 67 256 5980.', 503);
    }
    const passphraseRaw = source.PAYFAST_PASSPHRASE;
    const passphrase = passphraseRaw == null || String(passphraseRaw).trim() === ''
        ? null
        : String(passphraseRaw).trim();
    const siteUrl = String(source.SITE_URL || 'https://fashforge.co.za').trim().replace(/\/$/, '');
    if (!/^https:\/\/[^\s]+$/.test(siteUrl)) {
        console.error('PayFast config: SITE_URL must be an https origin');
        throw new CheckoutError('Card payments are not available yet. WhatsApp us on +27 67 256 5980.', 503);
    }
    const host = mode === 'live' ? 'www.payfast.co.za' : 'sandbox.payfast.co.za';
    return {
        mode,
        merchantId,
        merchantKey,
        passphrase,
        siteUrl,
        host,
        processUrl: 'https://' + host + '/eng/process'
    };
}

module.exports = { readConfig };
