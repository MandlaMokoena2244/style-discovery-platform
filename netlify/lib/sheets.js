const crypto = require('crypto');

const HEADERS = [
    'Order ref',
    'Date',
    'Status',
    'Customer name',
    'Email',
    'Mobile',
    'Address',
    'Outfit IDs',
    'Items with sizes',
    'Total',
    'PayFast payment id'
];

function base64url(input) {
    return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function loadServiceAccount(raw) {
    const parsed = JSON.parse(String(raw));
    if (!parsed.client_email || !parsed.private_key) {
        throw new Error('Service account JSON is missing client_email or private_key');
    }
    let privateKey = String(parsed.private_key);
    if (privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');
    return { client_email: parsed.client_email, private_key: privateKey };
}

async function googleAccessToken(serviceAccount, fetchImpl) {
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = base64url(JSON.stringify({
        iss: serviceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600
    }));
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(header + '.' + claims);
    sign.end();
    const signature = sign.sign(serviceAccount.private_key)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    const body = new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: header + '.' + claims + '.' + signature
    });
    const res = await fetchImpl('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
    });
    if (!res.ok) throw new Error('Google token request failed');
    const json = await res.json();
    if (!json.access_token) throw new Error('Google token response had no access token');
    return json.access_token;
}

function rowFromOrder(order) {
    return [
        order.orderRef,
        order.date,
        order.status,
        order.customerName,
        order.email,
        order.mobile,
        order.address,
        order.outfitIds,
        order.itemsWithSizes,
        order.total,
        order.payfastPaymentId
    ];
}

async function appendOrderToSheet(order, env, fetchImpl = fetch) {
    const sheetId = String(env.GOOGLE_SHEET_ID || '').trim();
    const account = loadServiceAccount(env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const token = await googleAccessToken(account, fetchImpl);
    const auth = { Authorization: 'Bearer ' + token };
    const base = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(sheetId) + '/values/';
    const headerUrl = base + encodeURIComponent('Orders!A1:K1');
    const headerRes = await fetchImpl(headerUrl, { headers: auth });
    if (!headerRes.ok) throw new Error('Could not read the Orders tab. Create a tab named Orders and share it with the service account.');
    const headerJson = await headerRes.json();
    const first = headerJson.values && headerJson.values[0] ? String(headerJson.values[0][0] || '') : '';
    if (!first) {
        const put = await fetchImpl(headerUrl + '?valueInputOption=USER_ENTERED', {
            method: 'PUT',
            headers: Object.assign({ 'Content-Type': 'application/json' }, auth),
            body: JSON.stringify({ values: [HEADERS] })
        });
        if (!put.ok) throw new Error('Could not write the Orders header row');
    }

    const columnUrl = base + encodeURIComponent('Orders!A:A');
    const columnRes = await fetchImpl(columnUrl, { headers: auth });
    if (columnRes.ok) {
        const columnJson = await columnRes.json();
        const existing = (columnJson.values || []).map((row) => String(row[0] || '').trim());
        if (existing.includes(order.orderRef)) return { appended: false, reason: 'duplicate' };
    }

    const appendUrl = base + encodeURIComponent('Orders!A:K') + ':append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS';
    const appendRes = await fetchImpl(appendUrl, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, auth),
        body: JSON.stringify({ values: [rowFromOrder(order)] })
    });
    if (!appendRes.ok) throw new Error('Could not append the order to Google Sheets');
    return { appended: true };
}

// Logs every paid order. Appends to Google Sheets only when both env vars are set.
async function recordOrder(order, env = process.env, fetchImpl = fetch) {
    console.log('FashForge paid order ' + JSON.stringify(order));
    const json = env && env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const sheetId = env && env.GOOGLE_SHEET_ID;
    if (!json || !String(sheetId || '').trim()) {
        console.log('FashForge order kept in function logs only. Google Sheets env vars are not set.');
        return { recorded: 'log' };
    }
    try {
        const result = await appendOrderToSheet(order, env, fetchImpl);
        console.log('FashForge order sheet result ' + JSON.stringify(result));
        return { recorded: 'sheet', appended: result.appended };
    } catch (err) {
        console.error('FashForge Google Sheets append failed: ' + err.message);
        return { recorded: 'log', sheetError: err.message };
    }
}

module.exports = {
    HEADERS,
    rowFromOrder,
    loadServiceAccount,
    appendOrderToSheet,
    recordOrder
};
