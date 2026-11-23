// Shop details that should stay easy to change.
// Public email: hello@fashforge.co.za
function formatZar(amount) {
    const value = Number(amount);
    const digits = Number.isInteger(value) ? 0 : 2;
    return 'R' + value.toFixed(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

window.FASHFORGE = {
    // Set true to show full-outfit sections, style pages, and the homepage outfits block again.
    showOutfits: false,
    // TEMPORARY preview testing: revert this commit before merging into dev.
    // Also requires CHECKOUT_ENABLED=true in Cloudflare Pages Preview.
    checkoutEnabled: true,
    legalName: 'FashForge (Pty) Ltd',
    registration: '2026/919971/07',
    email: 'hello@fashforge.co.za',
    phoneDisplay: '+27 67 256 5980',
    phoneWa: '27672565980',
    instagram: 'https://www.instagram.com/fashforge_official_account/',
    instagramHandle: '@fashforge_official_account',
    addressLine: '1064 Cornelius Street, Weltevredenpark, Roodepoort, Gauteng, 1709',
    delivery: {
        doorToDoor: 99,
        locker: 70,
        freeFrom: 2000,
        lockerProvider: 'Courier Guy',
        lockerHours: 36,
        usualBusinessDays: [3, 7],
        packDays: [1, 2],
        courierDays: [1, 3]
    },
    formatZar: formatZar,
    dayRange: function (pair) {
        return pair[0] + '\u2013' + pair[1];
    },
    freeDeliveryLine: function () {
        return 'Free delivery on orders of ' + formatZar(window.FASHFORGE.delivery.freeFrom) + ' or more.';
    },
    deliveryWindowLine: function () {
        const days = window.FASHFORGE.delivery.usualBusinessDays;
        return 'Delivery usually takes ' + window.FASHFORGE.dayRange(days) + ' business days.';
    }
};

// Full outfits are paused. The pages and markup stay; this only hides them.
(function () {
    if (!window.FASHFORGE || window.FASHFORGE.showOutfits !== false) return;
    document.documentElement.classList.add('outfits-hidden');
    var file = (location.pathname.split('/').pop() || '').toLowerCase();
    var back = {
        'men-full-outfits.html': 'men.html',
        'men-streetwear.html': 'men.html',
        'women-full-outfits.html': 'women.html',
        'women-streetwear.html': 'women.html',
        'women-smart-casual.html': 'women.html',
        'women-formal.html': 'women.html',
        'women-evening.html': 'women.html'
    };
    if (!back[file]) return;
    var robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    document.head.appendChild(robots);
    location.replace(back[file]);
})();
