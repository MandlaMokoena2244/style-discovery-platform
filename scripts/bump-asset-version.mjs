import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function assetVersion(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit',
        day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return ['year', 'month', 'day', 'hour', 'minute'].map(key => values[key]).join('');
}

export function versionHtml(html, version) {
    // Skip comments and inline script bodies; change only the opening asset tag.
    return html.replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>|<link\b[^>]*>/gi, tag => {
        if (tag.startsWith('<!--')) return tag;
        const opening = tag.slice(0, tag.indexOf('>') + 1);
        const script = /^<script\b/i.test(opening);
        if (!script) {
            const rel = opening.match(/\brel\s*=\s*(["'])(.*?)\1/i)?.[2];
            if (!rel?.toLowerCase().split(/\s+/).includes('stylesheet')) return tag;
        }
        const attribute = script ? /\bsrc\s*=\s*(["'])(.*?)\1/i : /\bhref\s*=\s*(["'])(.*?)\1/i;
        const updated = opening.replace(attribute, (whole, quote, url) => {
            if (!url || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url)) return whole;
            const [, path, query = '', fragment = ''] = url.match(/^([^?#]*)(?:\?([^#]*))?(#.*)?$/);
            const separator = query.includes('&amp;') ? '&amp;' : '&';
            const parameters = query.split(/&(?:amp;)?/).filter(part => part && !/^v(?:=|$)/.test(part));
            parameters.push('v=' + version);
            return whole.replace(quote + url + quote, quote + path + '?' + parameters.join(separator) + fragment + quote);
        });
        return updated + tag.slice(opening.length);
    });
}

async function htmlFiles(directory) {
    const paths = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const path = join(directory, entry.name);
        if (entry.isDirectory()) paths.push(...await htmlFiles(path));
        else if (entry.isFile() && /\.html$/i.test(entry.name)) paths.push(path);
    }
    return paths;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const version = assetVersion();
    let changed = 0;
    for (const path of await htmlFiles(root)) {
        const original = await readFile(path, 'utf8');
        const updated = versionHtml(original, version);
        if (updated !== original) { await writeFile(path, updated); changed++; }
    }
    console.log(`Asset version ${version}: updated ${changed} HTML files.`);
}
