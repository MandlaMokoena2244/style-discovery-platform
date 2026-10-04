const dns = require('dns').promises;

// Hosts PayFast documents for ITN checks.
const PAYFAST_HOSTS = [
    'www.payfast.co.za',
    'sandbox.payfast.co.za',
    'w1w.payfast.co.za',
    'w2w.payfast.co.za'
];

// Ranges seen on those hosts. DNS resolution is checked as well, because
// www and sandbox also resolve outside these ranges.
const PAYFAST_CIDRS = [
    '197.97.145.144/28',
    '41.74.179.192/27',
    '102.216.36.0/28',
    '102.216.36.128/28',
    '144.126.193.139/32',
    '13.245.74.88/32'
];

function ipv4ToInt(ip) {
    const parts = String(ip).split('.');
    if (parts.length !== 4) return null;
    let value = 0;
    for (const part of parts) {
        if (!/^\d{1,3}$/.test(part)) return null;
        const n = Number(part);
        if (n > 255) return null;
        value = (value << 8) + n;
    }
    return value >>> 0;
}

function ipInCidr(ip, cidr) {
    const [range, bitsRaw] = cidr.split('/');
    const bits = Number(bitsRaw);
    const ipInt = ipv4ToInt(ip);
    const rangeInt = ipv4ToInt(range);
    if (ipInt === null || rangeInt === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
    if (bits === 0) return true;
    const mask = bits === 32 ? 0xffffffff : ((0xffffffff << (32 - bits)) >>> 0);
    return (ipInt & mask) === (rangeInt & mask);
}

function ipInPayfastRanges(ip) {
    return PAYFAST_CIDRS.some((cidr) => ipInCidr(ip, cidr));
}

let cache = { at: 0, ips: new Set() };

async function resolvedPayfastIps(resolve4 = dns.resolve4) {
    const custom = resolve4 !== dns.resolve4;
    if (!custom && cache.ips.size && Date.now() - cache.at < 10 * 60 * 1000) return cache.ips;
    const ips = new Set();
    await Promise.all(PAYFAST_HOSTS.map(async (host) => {
        try {
            const list = await resolve4(host);
            for (const ip of list) ips.add(ip);
        } catch (err) {
            console.error('PayFast DNS lookup failed for ' + host);
        }
    }));
    if (ips.size && !custom) cache = { at: Date.now(), ips };
    return ips;
}

async function isPayfastIp(ip, resolve4) {
    if (!ip || ipv4ToInt(ip) === null) return false;
    if (ipInPayfastRanges(ip)) return true;
    const ips = await resolvedPayfastIps(resolve4);
    return ips.has(ip);
}

function clientIp(headers) {
    const lower = {};
    for (const [key, value] of Object.entries(headers || {})) {
        lower[String(key).toLowerCase()] = value;
    }
    const raw = lower['x-nf-client-connection-ip'] || lower['client-ip'] || '';
    return String(raw).split(',')[0].trim();
}

module.exports = {
    PAYFAST_HOSTS,
    PAYFAST_CIDRS,
    ipInCidr,
    ipInPayfastRanges,
    isPayfastIp,
    clientIp,
    resolvedPayfastIps
};
