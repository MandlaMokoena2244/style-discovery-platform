// Shop details that should stay easy to change.
// The public email will switch to hello@fashforge.co.za when that inbox is ready.
function formatZar(amount) {
    const value = Number(amount);
    const digits = Number.isInteger(value) ? 0 : 2;
    return 'R' + value.toFixed(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

window.FASHFORGE = {
    legalName: 'FashForge (Pty) Ltd',
    registration: '2026/919971/07',
    email: 'fashforge@gmail.com',
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
