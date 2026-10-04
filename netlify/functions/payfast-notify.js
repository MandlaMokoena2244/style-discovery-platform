const { readConfig } = require('../lib/config');
const { amountsMatch, orderFromItn, orderRecord, formatWhen } = require('../lib/order');
const { itnSignature, itnParamString } = require('../lib/signature');
const { recordOrder } = require('../lib/sheets');
const { isPayfastIp, clientIp } = require('../lib/payfast-ip');
const { text, readRawBody, parseFormBody, formFields } = require('../lib/http');

async function validateWithPayfast(paramString, host, fetchImpl) {
    const res = await fetchImpl('https://' + host + '/eng/query/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: paramString,
        signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) throw new Error('PayFast validate HTTP ' + res.status);
    const body = (await res.text()).trim().toUpperCase();
    return body === 'VALID';
}

// Signature first. Then PayFast's validate call. If that call cannot be
// completed, fall back to the PayFast source IP check. An explicit INVALID
// is rejected even when the IP matches. Amount is repriced from the
// catalogue. payment_status COMPLETE is the only paid state.
async function handleNotify(event, deps = {}) {
    if (!event || event.httpMethod !== 'POST') {
        return text(405, 'Method not allowed');
    }
    let config;
    try {
        config = readConfig(deps.env || process.env);
    } catch (err) {
        console.error('payfast-notify is not configured');
        return text(503, 'Not configured');
    }

    let entries;
    try {
        entries = parseFormBody(readRawBody(event));
    } catch (err) {
        return text(400, 'Bad request');
    }
    const fields = formFields(entries);
    const postedSignature = fields.signature || '';
    const expected = itnSignature(entries, config.passphrase);
    if (!postedSignature || postedSignature !== expected) {
        console.error('payfast-notify rejected: signature mismatch for ' + (fields.m_payment_id || ''));
        return text(400, 'Invalid signature');
    }
    if (String(fields.merchant_id || '') !== config.merchantId) {
        console.error('payfast-notify rejected: merchant id mismatch');
        return text(400, 'Invalid merchant');
    }

    const paramString = itnParamString(entries);
    const fetchImpl = deps.fetch || fetch;
    const ip = clientIp(event.headers);
    let sourceOk = false;
    try {
        const valid = await validateWithPayfast(paramString, config.host, fetchImpl);
        sourceOk = valid;
        if (!valid) console.error('payfast-notify rejected: PayFast validate returned INVALID');
    } catch (err) {
        console.error('payfast-notify validate call failed, checking source IP');
        const checkIp = deps.isPayfastIp || isPayfastIp;
        sourceOk = await checkIp(ip);
        if (!sourceOk) console.error('payfast-notify rejected: source IP is not a PayFast address');
    }
    if (!sourceOk) return text(400, 'Unverified notification');

    const status = String(fields.payment_status || '').toUpperCase();
    if (status !== 'COMPLETE') {
        console.log('payfast-notify ignored status ' + (status || '(blank)') + ' for ' + (fields.m_payment_id || ''));
        return text(200, 'OK');
    }

    let priced;
    try {
        priced = orderFromItn(fields);
    } catch (err) {
        console.error('payfast-notify rejected: ' + (err.message || 'order could not be read'));
        return text(400, 'Order could not be confirmed');
    }
    if (!priced.orderRef || !/^FF-\d{6}-[A-Z0-9]{4}$/.test(priced.orderRef)) {
        console.error('payfast-notify rejected: missing order reference');
        return text(400, 'Order could not be confirmed');
    }
    if (!amountsMatch(priced.totalCents, fields.amount_gross)) {
        console.error('payfast-notify rejected: amount mismatch for ' + priced.orderRef);
        return text(400, 'Amount mismatch');
    }

    const order = orderRecord({
        orderRef: priced.orderRef,
        customer: priced.customer,
        lines: priced.lines,
        totalCents: priced.totalCents,
        payfastPaymentId: String(fields.pf_payment_id || ''),
        when: formatWhen(deps.now || new Date()),
        status: 'PAID'
    });
    const save = deps.recordOrder || recordOrder;
    await save(order, deps.env || process.env, fetchImpl);
    return text(200, 'OK');
}

exports.handler = (event) => handleNotify(event);
exports.handleNotify = handleNotify;
