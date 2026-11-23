import catalogue from '../products.json';

const SITE = 'https://www.fashforge.co.za';
const serif = "Georgia, 'Times New Roman', Times, serif";
const label = 'color:#c9a96e;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;';
const policies = [['Returns', 'refunds-and-cancellations.html'], ['Shipping', 'delivery-policy.html'], ['Privacy', 'privacy.html'], ['Terms', 'terms-and-conditions.html']];
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const firstName = name => String(name || '').trim().split(/\s+/)[0];
export function emailMoney(cents) {
    const value = cents / 100;
    return 'R' + value.toFixed(Number.isInteger(value) ? 0 : 2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
export function emailDate(order) {
    const date = new Date(order.paidAt || order.createdAt);
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}
const displayName = name => name && name === name.toUpperCase() ? name.toLowerCase().replace(/\b\p{L}/gu, c => c.toUpperCase()) : name;
export function enrichItems(order, source = catalogue) {
    return order.items.map(item => {
        const product = source.products?.find(p => p.id === item.id);
        const path = product?.image || product?.images?.[0];
        let image = '';
        if (typeof path === 'string') {
            try {
                const url = new URL(path, SITE + '/');
                if (url.origin === SITE) image = url.href;
            } catch { /* A malformed catalogue image must not block confirmation. */ }
        }
        return { ...item, displayName: displayName(item.name), brand: product?.brand || '', code: product?.code || '', image,
            url: SITE + '/product.html?id=' + encodeURIComponent(item.id) };
    });
}
const link = (url, text) => `<a href="${escapeHtml(url)}" style="color:#1a1a1a;text-decoration:none;border-bottom:1px solid #c9a96e;">${escapeHtml(text)}</a>`;
const button = (url, text) => `<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#1a1a1a" style="background:#1a1a1a;text-align:center;"><a href="${escapeHtml(url)}" style="display:inline-block;padding:17px 24px;border:1px solid #1a1a1a;color:#ffffff;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;text-decoration:none;">${escapeHtml(text)}</a></td></tr></table>`;
const heading = text => `<h2 style="font-family:${serif};font-weight:400;font-size:25px;color:#1a1a1a;margin:32px 0 20px;">${text}</h2>`;

export function customerEmail(order, env, source = catalogue) {
    const c = order.customer;
    const items = enrichItems(order, source);
    const test = order.mode === 'test';
    const banner = 'Test order — no items will be dispatched';
    const delivery = order.deliveryMethod === 'locker' ? 'Courier Guy locker' : 'Door delivery';
    const fee = order.deliveryFee === 0 ? 'Free' : emailMoney(order.deliveryFee);
    const address = [c.name, c.street, c.suburb, c.city, c.province, c.postalCode, 'South Africa'];
    const viewUrl = new URL('/checkout-success.html', env.STITCH_SITE_URL || SITE);
    viewUrl.searchParams.set('ref', order.reference);
    const whatsapp = 'https://wa.me/27672565980?text=' + encodeURIComponent('Hi FashForge, I need help with order ' + order.reference);
    const intro = "Thank you for shopping with FashForge. We've received your payment and we're getting your order ready to ship.";
    const tracking = "We'll send your tracking number by email and WhatsApp when it ships.";
    const steps = ["We're preparing your order.", tracking, 'Delivery usually takes 3–7 working days.'];
    const text = [test ? banner : '', 'Thank you — Order confirmed', 'Dear ' + firstName(c.name) + ',', intro, tracking,
        'Order number: ' + order.reference, 'Date: ' + emailDate(order), 'Payment: Card via Stitch',
        'View your order: ' + viewUrl.href, 'WhatsApp us for help: ' + whatsapp, '', 'Order summary',
        ...items.map(i => [i.brand, i.displayName, (i.size ? 'Size ' + i.size : 'One size') + ' · Qty ' + i.qty, emailMoney(i.unitPrice * i.qty), i.url].filter(Boolean).join(' — ')),
        'Subtotal: ' + emailMoney(order.subtotal), delivery + ': ' + fee, 'Total: ' + emailMoney(order.total), '',
        'Delivery address', ...address, '', 'What happens next', ...steps.map((s, i) => '0' + (i + 1) + ' ' + s), '',
        'Need help? Reply to this email at hello@fashforge.co.za or WhatsApp +27 67 256 5980: ' + whatsapp,
        'Where is my order? ' + SITE + '/delivery-policy.html', 'Change or cancel an order: ' + SITE + '/refunds-and-cancellations.html',
        ...policies.map(([name, path]) => name + ': ' + SITE + '/' + path),
        'FashForge (Pty) Ltd · Reg. 2026/919971/07 · Not VAT registered',
        'Follow us on Instagram: https://www.instagram.com/fashforge_official_account/', 'www.fashforge.co.za'].filter(v => v !== '').join('\n');
    const rows = items.map(i => `<tr><td width="80" valign="top" style="padding:18px 0;border-bottom:1px solid #eeeeee;">${i.image ? `<a href="${escapeHtml(i.url)}"><img src="${escapeHtml(i.image)}" alt="${escapeHtml(i.displayName)}" width="80" height="107" style="display:block;object-fit:cover;border:0;width:80px;height:107px;"></a>` : '<div style="width:80px;height:107px;background:#f5f0eb;"></div>'}</td><td valign="top" style="padding:18px 0 18px 16px;border-bottom:1px solid #eeeeee;overflow-wrap:anywhere;">${i.brand ? `<div style="${label}">${escapeHtml(i.brand)}</div>` : ''}<p style="font-family:${serif};font-size:20px;line-height:1.3;margin:8px 0;">${escapeHtml(i.displayName)}</p><p style="font-size:12px;color:#888888;margin:8px 0;">${escapeHtml(i.size ? 'Size ' + i.size : 'One size')} · Qty ${escapeHtml(i.qty)}</p><p style="margin:8px 0 0;">${emailMoney(i.unitPrice * i.qty)}</p></td></tr>`).join('');
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Order confirmed</title><style>@media only screen and (max-width:600px){.email-content{padding:30px 22px!important;}}</style></head><body style="margin:0;padding:0;background:#f5f0eb;color:#2c2c2c;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${test ? banner + '. ' : ''}Thank you — your FashForge order is confirmed.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f5f0eb"><tr><td align="center" style="padding:24px 0;">
<!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;"><tr><td align="center" style="padding:32px 22px;"><a href="${SITE}"><img src="${SITE}/images/logo-full-black.png" alt="FashForge" width="190" style="display:block;width:190px;max-width:100%;height:auto;border:0;"></a></td></tr>
${test ? `<tr><td align="center" bgcolor="#1a1a1a" style="padding:9px 20px;background:#1a1a1a;${label}font-size:10px;">${banner}</td></tr>` : ''}
<tr><td class="email-content" style="padding:40px;">
<div style="${label}">Thank you</div><h1 style="font-family:${serif};font-weight:400;font-size:36px;line-height:1.2;margin:10px 0 28px;color:#1a1a1a;">Order confirmed</h1>
<p>Dear ${escapeHtml(firstName(c.name))},</p><p>${escapeHtml(intro)}</p><p>${escapeHtml(tracking)}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;border-top:1px solid #eeeeee;border-bottom:1px solid #eeeeee;table-layout:fixed;"><tr><td colspan="2" style="padding:18px 0;overflow-wrap:anywhere;word-break:break-word;"><div style="${label}">Order number</div>${escapeHtml(order.reference)}</td></tr><tr><td width="50%" valign="top" style="padding:0 12px 18px 0;"><div style="${label}">Date</div>${escapeHtml(emailDate(order))}</td><td width="50%" valign="top" style="padding-bottom:18px;"><div style="${label}">Payment</div>Card via Stitch</td></tr></table>
${button(viewUrl.href, 'View your order')}<p style="font-size:12px;">${link(whatsapp, 'WhatsApp us for help')}</p>
${heading('Order summary')}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${rows}</table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:18px;"><tr><td style="padding:6px 0;">Subtotal</td><td align="right">${emailMoney(order.subtotal)}</td></tr><tr><td style="padding:6px 0;">${delivery}</td><td align="right">${fee}</td></tr><tr><td style="padding-top:18px;${label}">Total</td><td align="right" style="padding-top:18px;font-family:${serif};font-size:28px;">${emailMoney(order.total)}</td></tr></table>
${heading('Delivery address')}<p>${address.map(escapeHtml).join('<br>')}</p>
${heading('What happens next')}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${steps.map((s, i) => `<tr><td width="45" valign="top" style="padding:10px 0;color:#c9a96e;font-family:${serif};font-size:24px;">0${i + 1}</td><td style="padding:10px 0;">${escapeHtml(s)}</td></tr>`).join('')}</table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px;background:#f5f0eb;"><tr><td style="padding:24px;">${heading('Need help?')}<p>Reply to this email or WhatsApp us.<br>${link('mailto:hello@fashforge.co.za', 'hello@fashforge.co.za')}</p>${button(whatsapp, 'WhatsApp +27 67 256 5980')}<p>${link(SITE + '/delivery-policy.html', 'Where is my order?')}</p><p>${link(SITE + '/refunds-and-cancellations.html', 'Change or cancel an order')}</p></td></tr></table>
</td></tr><tr><td align="center" style="padding:28px 22px;border-top:1px solid #eeeeee;color:#888888;font-size:11px;">${policies.map(([name, path]) => link(SITE + '/' + path, name)).join(' &nbsp; · &nbsp; ')}<p>FashForge (Pty) Ltd · Reg. 2026/919971/07 · Not VAT registered</p><p>${link('https://www.instagram.com/fashforge_official_account/', 'Follow us on Instagram')}</p>${link(SITE, 'www.fashforge.co.za')}</td></tr></table>
<!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
    return { from: env.ORDER_FROM_EMAIL, to: [c.email], reply_to: 'hello@fashforge.co.za', subject: (test ? '[TEST] ' : '') + 'Your FashForge order is confirmed', text, html };
}
