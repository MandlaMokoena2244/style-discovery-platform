function json(statusCode, payload) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
        },
        body: JSON.stringify(payload)
    };
}

function text(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-store'
        },
        body
    };
}

function readRawBody(event) {
    if (!event || event.body == null || event.body === '') return '';
    const raw = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf8')
        : String(event.body);
    if (raw.length > 20000) {
        const err = new Error('Request is too large');
        err.statusCode = 400;
        err.publicMessage = true;
        throw err;
    }
    return raw;
}

function readJsonBody(event) {
    const raw = readRawBody(event);
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch (err) {
        const error = new Error('We could not read that order.');
        error.statusCode = 400;
        error.publicMessage = true;
        throw error;
    }
}

function parseFormBody(raw) {
    const entries = [];
    if (!raw) return entries;
    for (const part of String(raw).split('&')) {
        if (!part) continue;
        const eq = part.indexOf('=');
        const key = decodeFormComponent(eq === -1 ? part : part.slice(0, eq));
        const val = decodeFormComponent(eq === -1 ? '' : part.slice(eq + 1));
        entries.push([key, val]);
    }
    return entries;
}

function decodeFormComponent(value) {
    try {
        return decodeURIComponent(String(value).replace(/\+/g, ' '));
    } catch (err) {
        return String(value);
    }
}

function formFields(entries) {
    const fields = {};
    for (const [key, val] of entries) fields[key] = val;
    return fields;
}

module.exports = {
    json,
    text,
    readRawBody,
    readJsonBody,
    parseFormBody,
    formFields
};
