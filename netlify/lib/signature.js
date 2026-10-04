// PayFast signature, matching the custom-integration sample on
// https://developers.payfast.co.za/docs (ordered fields, PHP urlencode,
// passphrase appended when it is set). PHP urlencode uses uppercase hex
// and encodes spaces as "+". Do not sort the fields alphabetically.

const crypto = require('crypto');

function phpUrlEncode(value) {
    return encodeURIComponent(String(value))
        .replace(/[!'()*~]/g, (ch) => '%' + ch.charCodeAt(0).toString(16).toUpperCase())
        .replace(/%20/g, '+');
}

// Checkout signature. Blank fields are left out. Values are trimmed.
function signatureParamString(data, passPhrase) {
    const pairs = [];
    for (const [key, val] of Object.entries(data)) {
        if (key === 'signature' || val === undefined || val === null) continue;
        const trimmed = String(val).trim();
        if (trimmed === '') continue;
        pairs.push(key + '=' + phpUrlEncode(trimmed));
    }
    let str = pairs.join('&');
    if (passPhrase !== undefined && passPhrase !== null && String(passPhrase).trim() !== '') {
        str += '&passphrase=' + phpUrlEncode(String(passPhrase).trim());
    }
    return str;
}

function generateSignature(data, passPhrase) {
    return crypto.createHash('md5').update(signatureParamString(data, passPhrase)).digest('hex');
}

// ITN signature. PayFast posts every field it sends, including blanks,
// and the signature covers that string in the order received.
function itnParamString(entries) {
    return entries
        .filter(([key]) => key !== 'signature')
        .map(([key, val]) => key + '=' + phpUrlEncode(val == null ? '' : String(val)))
        .join('&');
}

function itnSignature(entries, passPhrase) {
    let str = itnParamString(entries);
    if (passPhrase !== undefined && passPhrase !== null && String(passPhrase).trim() !== '') {
        str += '&passphrase=' + phpUrlEncode(String(passPhrase).trim());
    }
    return crypto.createHash('md5').update(str).digest('hex');
}

module.exports = {
    phpUrlEncode,
    signatureParamString,
    generateSignature,
    itnParamString,
    itnSignature
};
