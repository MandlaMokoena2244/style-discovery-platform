// ============================================
// FashForge - Main JavaScript
// ============================================

function applySiteDetails() {
    const site = window.FASHFORGE;
    if (!site) return;
    document.querySelectorAll('[data-site-email]').forEach(function(el) {
        el.textContent = site.email;
        if (el.tagName === 'A') el.setAttribute('href', 'mailto:' + site.email);
    });
    document.querySelectorAll('[data-site-legal]').forEach(function(el) {
        el.textContent = site.legalName;
    });
    document.querySelectorAll('[data-site-reg]').forEach(function(el) {
        el.textContent = site.registration;
    });
    document.querySelectorAll('[data-site-address]').forEach(function(el) {
        el.textContent = site.addressLine;
    });
    if (!site.delivery || typeof site.formatZar !== 'function') return;
    document.querySelectorAll('[data-site-free-from]').forEach(function(el) {
        el.textContent = site.formatZar(site.delivery.freeFrom);
    });
    document.querySelectorAll('[data-site-door-fee]').forEach(function(el) {
        el.textContent = site.formatZar(site.delivery.doorToDoor);
    });
    document.querySelectorAll('[data-site-locker-fee]').forEach(function(el) {
        el.textContent = site.formatZar(site.delivery.locker);
    });
    document.querySelectorAll('[data-site-locker-hours]').forEach(function(el) {
        el.textContent = String(site.delivery.lockerHours);
    });
    document.querySelectorAll('[data-site-locker-provider]').forEach(function(el) {
        el.textContent = site.delivery.lockerProvider;
    });
    if (typeof site.deliveryWindowLine === 'function') {
        document.querySelectorAll('[data-site-delivery-window]').forEach(function(el) {
            el.textContent = site.deliveryWindowLine();
        });
    }
    if (typeof site.dayRange === 'function') {
        document.querySelectorAll('[data-site-pack-days]').forEach(function(el) {
            el.textContent = site.dayRange(site.delivery.packDays);
        });
        document.querySelectorAll('[data-site-courier-days]').forEach(function(el) {
            el.textContent = site.dayRange(site.delivery.courierDays);
        });
    }
}

function deliveryChoiceLabel(value) {
    const delivery = window.FASHFORGE && window.FASHFORGE.delivery;
    if (value === 'locker') {
        const provider = delivery && delivery.lockerProvider ? delivery.lockerProvider : 'Courier Guy';
        return provider + ' locker';
    }
    return 'door-to-door';
}

function insertDeliveryChoice(button) {
    if (!button || document.getElementById('delivery-choice') || !window.FASHFORGE || !window.FASHFORGE.delivery) return;
    const delivery = window.FASHFORGE.delivery;
    const zar = window.FASHFORGE.formatZar;
    const field = document.createElement('fieldset');
    field.className = 'delivery-choice';
    field.id = 'delivery-choice';
    field.innerHTML =
        '<legend>Delivery</legend>' +
        '<label><input type="radio" name="delivery-method" value="door"> Door-to-door, ' + zar(delivery.doorToDoor) + '</label>' +
        '<label><input type="radio" name="delivery-method" value="locker"> ' + delivery.lockerProvider + ' locker, ' + zar(delivery.locker) + '. Collect with a PIN within ' + delivery.lockerHours + ' hours.</label>' +
        '<p>' + window.FASHFORGE.freeDeliveryLine() + ' ' + window.FASHFORGE.deliveryWindowLine() + '</p>';
    button.insertAdjacentElement('beforebegin', field);
}

document.addEventListener('DOMContentLoaded', function() {
    applySiteDetails();

    // Navbar scroll effect
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Mobile menu toggle (hamburger)
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navLinks.classList.toggle('active');
        });
    }

    // Close mobile menu when clicking a link
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            if (hamburger && navLinks) {
                hamburger.classList.remove('active');
                navLinks.classList.remove('active');
            }
        });
    });

    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Contact form posts to Web3Forms. WhatsApp on the contact page is only for queries.
    const contactForm = document.querySelector('.contact-form form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const form = this;
            const button = form.querySelector('[type="submit"]');
            const error = document.getElementById('contact-error');
            const thanks = document.getElementById('contact-thanks');
            if (error) {
                error.hidden = true;
                error.textContent = '';
            }
            if (button) button.disabled = true;
            const payload = Object.fromEntries(new FormData(form).entries());
            fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            }).then(function(response) {
                return response.json();
            }).then(function(data) {
                if (!data || data.success !== true) throw new Error('send failed');
                form.hidden = true;
                if (thanks) thanks.hidden = false;
            }).catch(function() {
                if (button) button.disabled = false;
                if (error) {
                    error.hidden = false;
                    error.textContent = 'We could not send your message just now. Please try again, or WhatsApp us on +27 67 256 5980.';
                }
            });
        });
    }

});

// ============================================
// SHOPPING CART (paste at the BOTTOM of script.js)
// NOTE: if you pasted the previous cart code, delete that
// old block first (from its header comment to the end of file)
// ============================================
// ============================================
// PAYMENT SWITCH
// One place to turn ordering back on.
// 'disabled' shows a notice and does not take orders. Add to cart still works.
// 'whatsapp' keeps Order on WhatsApp.
// 'payfast' replaces that button with the card checkout form.
// There is no WhatsApp order button while this is 'payfast' or 'disabled'.
// The contact form posts to Web3Forms and does not follow this switch.
// WhatsApp on the contact page is for queries only.
// ============================================
const PAYMENT_PROVIDER = 'disabled';
const ORDERS_PAUSED_NOTICE = 'Card payments are not available yet. To place an order, use the button on the product page.';

function activePaymentProvider() {
    if (PAYMENT_PROVIDER === 'payfast') return 'payfast';
    if (PAYMENT_PROVIDER === 'disabled') return 'disabled';
    if (PAYMENT_PROVIDER !== 'whatsapp') {
        console.warn('PAYMENT_PROVIDER must be disabled, whatsapp, or payfast. Staying on WhatsApp.');
    }
    return 'whatsapp';
}

// In-stock sizes only, keyed by piece id. Keep this in step with products.json.
// The public catalogue is empty until outfits are added there.
// sizes: [] means sold out. There is no separate sold-out flag.
const PIECE_STOCK = {
    pieces: {}
};

const OUTFIT_PIECE_IDS = {};

const SINGLE_PIECE_IDS = {};

function pieceSizes(pieceId) {
    const entry = PIECE_STOCK.pieces[pieceId];
    return entry && Array.isArray(entry.sizes) ? entry.sizes : [];
}

function pieceIsSoldOut(pieceId) {
    return pieceSizes(pieceId).length === 0;
}

function outfitIsSoldOut(outfitId) {
    const ids = OUTFIT_PIECE_IDS[outfitId];
    return Array.isArray(ids) && ids.some(pieceIsSoldOut);
}

function cartLinePieceIds(item) {
    if (!item || typeof item !== 'object') return [];
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    if (OUTFIT_PIECE_IDS[id]) return OUTFIT_PIECE_IDS[id];
    if (SINGLE_PIECE_IDS[item.name] != null) return [SINGLE_PIECE_IDS[item.name]];
    return [];
}

function cartLineSoldOut(item) {
    return cartLinePieceIds(item).some(pieceIsSoldOut);
}

function soldOutCartMessage(items) {
    const names = [];
    (items || []).forEach(function(item) {
        if (!cartLineSoldOut(item)) return;
        const label = item.name || 'This item';
        if (names.indexOf(label) !== -1) return;
        names.push(label);
    });
    if (!names.length) return '';
    if (names.length === 1) return names[0] + ' is sold out. Remove it from your cart.';
    return 'Some items are sold out. Remove them from your cart.';
}

document.addEventListener('DOMContentLoaded', async function() {

    let catalogue = null;
    try {
        const response = await fetch('products.json');
        if (response.ok) catalogue = await response.json();
    } catch (err) {
        catalogue = null;
    }
    if (catalogue && window.renderFashforgeCatalogue) {
        window.renderFashforgeCatalogue(catalogue);
    }

    function formatRand(amount) {
        return 'R' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    // Product pages leave size groups empty and set data-piece-id.
    // One size is preselected. Several sizes stay unselected until the shopper picks one.
    const sizeGroups = document.querySelectorAll('.size-group[data-piece-id]');
    sizeGroups.forEach(group => {
        if (group.querySelector('.size-btn')) return;
        const sizes = pieceSizes(group.dataset.pieceId);
        if (!sizes.length) {
            group.insertAdjacentHTML('beforeend', '<p class="sold-out-label">Sold out</p>');
            return;
        }
        const only = sizes.length === 1;
        group.innerHTML = sizes.map(size =>
            '<button class="size-btn' + (only ? ' selected' : '') + '" type="button" data-size="' + size + '">' + size + '</button>'
        ).join('');
    });

    const productGroups = document.querySelectorAll('.product-info-col .size-group[data-piece-id]');
    const productSoldOut = Array.prototype.some.call(productGroups, function(group) {
        return pieceIsSoldOut(group.dataset.pieceId);
    });
    if (productSoldOut) {
        const price = document.querySelector('.product-info-col .product-price');
        const name = document.querySelector('.product-info-col .product-name');
        const anchor = price || name;
        if (anchor && !document.querySelector('.product-info-col > .sold-out-badge')) {
            anchor.insertAdjacentHTML('afterend', '<p class="sold-out-badge">Sold out</p>');
        }
        const soldOutBtn = document.getElementById('add-to-cart');
        if (soldOutBtn) {
            soldOutBtn.disabled = true;
            soldOutBtn.textContent = 'Sold out';
            soldOutBtn.setAttribute('aria-disabled', 'true');
        }
    }

    const buyButton = document.getElementById('add-to-cart');
    if (buyButton && !buyButton.disabled) {
        const sellable = window.lookupFashforgeSellable ? window.lookupFashforgeSellable(catalogue, buyButton) : null;
        const paymentLink = sellable && typeof sellable.paymentLink === 'string' ? sellable.paymentLink.trim() : '';
        buyButton.textContent = paymentLink ? 'Buy' : 'Order on WhatsApp';
    }

    function placeSoldOutBadge(card) {
        if (card.querySelector(':scope > .sold-out-badge')) return;
        card.insertAdjacentHTML('afterbegin', '<span class="sold-out-badge">Sold out</span>');
    }

    document.querySelectorAll('.item-card[data-outfit-id], .style-card[data-outfit-id]').forEach(function(card) {
        if (outfitIsSoldOut(card.dataset.outfitId)) placeSoldOutBadge(card);
    });
    document.querySelectorAll('.item-card[data-piece-id]').forEach(function(card) {
        if (pieceIsSoldOut(card.dataset.pieceId)) placeSoldOutBadge(card);
    });

    const cartBtn = document.getElementById('cart-btn');
    if (!cartBtn) return; // page has no cart button, do nothing

    const CART_KEY = 'fashforge_cart';
    let cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');

    // Outfit ID format: FF-<M|W|K>-<NNN> (M men, W women, K kids), e.g. FF-M-001.
    // Set data-outfit-id on the product's Add to Cart button. The next free number
    // in that department is the next ID. The catalogue is empty, so FF-M-001 is free.
    // Brand product URLs and supplier details stay in a private Google Sheet keyed
    // by this ID — do not put them in the site. Cart lines with no outfit id
    // (or an older non-FF id) still check out; the id is left off that line.
    const OUTFIT_ID_RE = /^FF-[MWK]-\d{3}$/;

    // Short labels for the cart and the WhatsApp line. Men's keys stay as they are.
    const PIECE_LABELS = {
        top: 'Top',
        jogger: 'Jogger',
        shoe: 'Shoe',
        pants: 'Pants',
        sneaker: 'Sneaker',
        boot: 'Boot',
        cardigan: 'Cardigan',
        corset: 'Corset',
        jeans: 'Jeans'
    };

    const paymentProvider = activePaymentProvider();
    const payfastOn = paymentProvider === 'payfast';
    const ordersDisabled = paymentProvider === 'disabled';

    function checkoutFormHtml() {
        const provinces = [
            'Eastern Cape',
            'Free State',
            'Gauteng',
            'KwaZulu-Natal',
            'Limpopo',
            'Mpumalanga',
            'Northern Cape',
            'North West',
            'Western Cape'
        ];
        const options = '<option value="">Select a province</option>' + provinces.map(function(name) {
            return '<option value="' + name + '">' + name + '</option>';
        }).join('');
        return `
            <form id="checkout-form" class="checkout-form" novalidate>
                <h4>Delivery details</h4>
                <div class="form-group">
                    <label for="checkout-name">Full name</label>
                    <input id="checkout-name" name="name" type="text" autocomplete="name" maxlength="100" required>
                </div>
                <div class="form-group">
                    <label for="checkout-email">Email</label>
                    <input id="checkout-email" name="email" type="email" autocomplete="email" maxlength="100" required>
                </div>
                <div class="form-group">
                    <label for="checkout-mobile">Mobile number</label>
                    <input id="checkout-mobile" name="mobile" type="tel" autocomplete="tel" inputmode="tel" placeholder="082 000 0000" required>
                </div>
                <div class="form-group">
                    <label for="checkout-street">Street address</label>
                    <input id="checkout-street" name="street" type="text" autocomplete="address-line1" maxlength="120" required>
                </div>
                <div class="form-group">
                    <label for="checkout-suburb">Suburb</label>
                    <input id="checkout-suburb" name="suburb" type="text" autocomplete="address-line2" maxlength="80" required>
                </div>
                <div class="form-group">
                    <label for="checkout-city">City</label>
                    <input id="checkout-city" name="city" type="text" autocomplete="address-level2" maxlength="60" required>
                </div>
                <div class="form-group">
                    <label for="checkout-province">Province</label>
                    <select id="checkout-province" name="province" autocomplete="address-level1" required>${options}</select>
                </div>
                <div class="form-group">
                    <label for="checkout-postal">Postal code</label>
                    <input id="checkout-postal" name="postalCode" type="text" autocomplete="postal-code" inputmode="numeric" maxlength="4" required>
                </div>
                <div class="form-group">
                    <label for="checkout-note">Delivery note (optional)</label>
                    <textarea id="checkout-note" name="note" maxlength="200"></textarea>
                </div>
            </form>
        `;
    }

    // ---- Inject cart drawer + overlay into the page ----
    document.body.insertAdjacentHTML('beforeend', `
        <div class="cart-overlay" id="cart-overlay"></div>
        <aside class="cart-drawer${payfastOn ? ' is-checkout' : ''}" id="cart-drawer" data-payment-provider="${paymentProvider}">
            <div class="cart-drawer-header">
                <h3>Your Cart</h3>
                <button class="cart-close" id="cart-close" aria-label="Close cart">&times;</button>
            </div>
            <div class="cart-drawer-body">
                <div class="cart-items" id="cart-items"></div>
                ${payfastOn ? checkoutFormHtml() : ''}
            </div>
            <div class="cart-drawer-footer">
                ${payfastOn ? '<p class="cart-delivery-note">' + (window.FASHFORGE && window.FASHFORGE.freeDeliveryLine ? window.FASHFORGE.freeDeliveryLine() : 'Free delivery on orders of R2,000 or more.') + '</p>' : ''}
                <div class="cart-total-row">
                    <span>Total</span>
                    <strong id="cart-total">R0.00</strong>
                </div>
                <p class="checkout-error" id="checkout-error" role="alert" hidden></p>
                ${ordersDisabled
                    ? '<p class="orders-paused" role="status">' + ORDERS_PAUSED_NOTICE + '</p>'
                    : '<button class="btn-checkout" id="checkout-btn" type="' + (payfastOn ? 'submit' : 'button') + '"' + (payfastOn ? ' form="checkout-form"' : '') + '>' + (payfastOn ? 'Pay by card' : 'Order on WhatsApp') + '</button>'}
                <p class="cart-policy-links"><a href="terms-and-conditions.html">Terms</a><a href="refunds-and-cancellations.html">Refunds</a><a href="delivery-policy.html">Delivery</a></p>
            </div>
        </aside>
    `);

    const drawer       = document.getElementById('cart-drawer');
    const overlay      = document.getElementById('cart-overlay');
    const itemsEl      = document.getElementById('cart-items');
    const totalEl      = document.getElementById('cart-total');
    const countEl      = document.getElementById('cart-count');
    const closeBtn     = document.getElementById('cart-close');
    const checkoutBtn  = document.getElementById('checkout-btn');
    const checkoutError = document.getElementById('checkout-error');

    function showCheckoutError(message, reason) {
        if (!checkoutError) return;
        checkoutError.hidden = !message;
        checkoutError.textContent = message || '';
        if (message) checkoutError.dataset.reason = reason || 'checkout';
        else delete checkoutError.dataset.reason;
    }

    function saveCart() {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
    }

    // Turn { top: 'M', jogger: 'L', shoe: '9' } into a display string
    function formatSizes(item, plain) {
        if (item.sizes) {
            const parts = Object.entries(item.sizes)
                .map(([piece, size]) => (PIECE_LABELS[piece] || piece) + ' ' + size);
            return plain ? parts.join(', ') : parts.join(' &middot; ');
        }
        return item.size || ''; // old cart items (backwards compatible)
    }

    function outfitIdOf(item) {
        if (!item || typeof item.id !== 'string') return '';
        return OUTFIT_ID_RE.test(item.id) ? item.id : '';
    }

    function orderLine(item) {
        const label = item.brand ? (item.brand + ' — ' + item.name) : item.name;
        const sizes = formatSizes(item, true);
        const sizePart = sizes ? ' (' + sizes + ')' : '';
        const id = outfitIdOf(item);
        const prefix = id ? (id + ' — ') : '';
        return prefix + label + sizePart + ' — Qty: ' + item.qty + ' — ' + formatRand(item.price * item.qty);
    }

    // One reference per checkout, e.g. Order ref: FF-20260929-K7QM
    function makeOrderRef() {
        const now = new Date();
        const date = String(now.getFullYear())
            + String(now.getMonth() + 1).padStart(2, '0')
            + String(now.getDate()).padStart(2, '0');
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
        }
        return 'FF-' + date + '-' + code;
    }

    function renderCart() {
        // Badge count
        const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
        countEl.textContent = totalQty;
        countEl.classList.remove('bump');
        void countEl.offsetWidth; // restart animation
        countEl.classList.add('bump');

        // Items list
        if (cart.length === 0) {
            itemsEl.innerHTML = '<p class="cart-empty">Your cart is empty.</p>';
        } else {
            itemsEl.innerHTML = cart.map((item, i) => `
                <div class="cart-item">
                    <div class="cart-item-info">
                        <h4>${item.brand ? item.brand + ' — ' + item.name : item.name}</h4>
                        <p>${formatSizes(item)} &nbsp;&middot;&nbsp; Qty: ${item.qty}</p>
                        ${cartLineSoldOut(item) ? '<p class="cart-sold-out">Sold out</p>' : ''}
                    </div>
                    <div class="cart-item-right">
                        <p class="cart-item-price">${formatRand(item.price * item.qty)}</p>
                        <button class="cart-item-remove" data-index="${i}">Remove</button>
                    </div>
                </div>
            `).join('');
        }

        // Total
        const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
        totalEl.textContent = formatRand(total);

        const blocked = soldOutCartMessage(cart);
        if (blocked) showCheckoutError(blocked, 'sold-out');
        else if (checkoutError && checkoutError.dataset.reason === 'sold-out') showCheckoutError('');
    }

    window.addToCart = function(product) {
        if (cartLineSoldOut(product)) return;
        // Same product + same sizes for all pieces? Increase quantity instead of a new line
        const existing = cart.find(item =>
            item.id === product.id &&
            item.name === product.name &&
            (item.size || '') === (product.size || '') &&
            JSON.stringify(item.sizes || null) === JSON.stringify(product.sizes || null)
        );
        if (existing) {
            existing.qty += product.qty;
        } else {
            cart.push(product);
        }
        saveCart();
        renderCart();
        openCart();
    };

    function openCart() {
        drawer.classList.add('open');
        overlay.classList.add('open');
    }
    function closeCart() {
        drawer.classList.remove('open');
        overlay.classList.remove('open');
    }

    cartBtn.addEventListener('click', openCart);
    closeBtn.addEventListener('click', closeCart);
    overlay.addEventListener('click', closeCart);

    // Remove item
    itemsEl.addEventListener('click', function(e) {
        if (e.target.classList.contains('cart-item-remove')) {
            cart.splice(Number(e.target.dataset.index), 1);
            saveCart();
            renderCart();
        }
    });

    function checkoutOnWhatsApp() {
        if (activePaymentProvider() !== 'whatsapp') return;
        if (cart.length === 0) {
            alert('Your cart is empty.');
            return;
        }
        const blocked = soldOutCartMessage(cart);
        if (blocked) {
            showCheckoutError(blocked, 'sold-out');
            return;
        }
        const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
        const message = "Hi FashForge, I'd like to order:\n" +
            'Order ref: ' + makeOrderRef() + '\n' +
            cart.map(orderLine).join('\n') +
            '\nTotal: ' + formatRand(total);
        const url = 'https://wa.me/27672565980?text=' + encodeURIComponent(message);
        console.log('WhatsApp checkout URL:', url);
        const opened = window.open(url, '_blank');
        if (!opened) {
            alert('Allow pop-ups to open WhatsApp and place your order.');
            return;
        }
        try { opened.opener = null; } catch (err) { /* already opened */ }
        cart = [];
        saveCart();
        renderCart();
        closeCart();
    }

    function fieldValue(id) {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    }

    function readCheckoutCustomer() {
        return {
            name: fieldValue('checkout-name'),
            email: fieldValue('checkout-email'),
            mobile: fieldValue('checkout-mobile'),
            street: fieldValue('checkout-street'),
            suburb: fieldValue('checkout-suburb'),
            city: fieldValue('checkout-city'),
            province: fieldValue('checkout-province'),
            postalCode: fieldValue('checkout-postal'),
            note: fieldValue('checkout-note')
        };
    }

    function normaliseMobile(input) {
        let digits = String(input || '').replace(/[\s()-]/g, '');
        if (digits.indexOf('+27') === 0) digits = '0' + digits.slice(3);
        else if (digits.indexOf('27') === 0 && digits.length === 11) digits = '0' + digits.slice(2);
        return /^0[6-8]\d{8}$/.test(digits) ? digits : '';
    }

    function validateCheckoutCustomer(customer) {
        if (customer.name.length < 2) return 'Enter your full name.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) return 'Enter a valid email address.';
        if (!normaliseMobile(customer.mobile)) return 'Enter a South African mobile number.';
        if (customer.street.length < 3) return 'Enter the street address.';
        if (customer.suburb.length < 2) return 'Enter the suburb.';
        if (customer.city.length < 2) return 'Enter the city.';
        if (!customer.province) return 'Select a province.';
        if (!/^\d{4}$/.test(customer.postalCode)) return 'Enter a 4-digit postal code.';
        return '';
    }

    function postToPayfast(processUrl, fields) {
        const allowed = [
            'https://sandbox.payfast.co.za/eng/process',
            'https://www.payfast.co.za/eng/process'
        ];
        if (allowed.indexOf(processUrl) === -1 || !fields) {
            throw new Error('Card payment could not be started. Please try again.');
        }
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = processUrl;
        form.acceptCharset = 'UTF-8';
        Object.keys(fields).forEach(function(name) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = name;
            input.value = fields[name] == null ? '' : String(fields[name]);
            form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
    }

    // Card checkout. The cart stays in this browser until payment-success.html.
    let payfastSubmitting = false;
    async function submitPayfastCheckout() {
        const errorEl = document.getElementById('checkout-error');
        function showError(message) {
            errorEl.hidden = false;
            errorEl.textContent = message;
        }
        if (activePaymentProvider() !== 'payfast') return;
        if (payfastSubmitting) return;
        errorEl.hidden = true;
        errorEl.textContent = '';
        delete errorEl.dataset.reason;
        if (cart.length === 0) {
            showError('Your cart is empty.');
            return;
        }
        const blocked = soldOutCartMessage(cart);
        if (blocked) {
            showCheckoutError(blocked, 'sold-out');
            return;
        }
        const customer = readCheckoutCustomer();
        const problem = validateCheckoutCustomer(customer);
        if (problem) {
            showError(problem);
            return;
        }
        customer.mobile = normaliseMobile(customer.mobile);
        payfastSubmitting = true;
        checkoutBtn.disabled = true;
        const previousLabel = checkoutBtn.textContent;
        checkoutBtn.textContent = 'Sending you to PayFast...';
        try {
            const res = await fetch('/.netlify/functions/payfast-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer: customer,
                    items: cart.map(function(item) {
                        return {
                            id: item.id || '',
                            name: item.name,
                            qty: item.qty,
                            size: item.size || '',
                            sizes: item.sizes || null
                        };
                    })
                })
            });
            const data = await res.json().catch(function() { return {}; });
            if (!res.ok) {
                throw new Error(data.error || 'Card payment could not be started. Please try again.');
            }
            const charged = Number(data.amount);
            const shown = cart.reduce(function(sum, item) { return sum + Number(item.price) * item.qty; }, 0);
            if (!isFinite(charged) || Math.abs(charged - shown) > 0.009) {
                throw new Error('The total could not be confirmed. Please refresh the page and try again.');
            }
            postToPayfast(data.processUrl, data.fields);
        } catch (err) {
            payfastSubmitting = false;
            checkoutBtn.disabled = false;
            checkoutBtn.textContent = previousLabel;
            showError(err.message || 'Card payment could not be started. Please try again.');
        }
    }

    if (payfastOn) {
        document.getElementById('checkout-form').addEventListener('submit', function(e) {
            e.preventDefault();
            submitPayfastCheckout();
        });
    } else if (checkoutBtn && activePaymentProvider() === 'whatsapp') {
        // Checkout -> WhatsApp order. Cart is cleared only after WhatsApp opens.
        checkoutBtn.addEventListener('click', checkoutOnWhatsApp);
    }

    renderCart();

    // ---- Product page: size groups + quantity + add to cart ----

    // Each size group selects independently (one size per piece)
    document.querySelectorAll('.size-group').forEach(group => {
        group.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                group.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
        });
    });

    const qtyInput = document.getElementById('qty');
    if (qtyInput) {
        document.getElementById('qty-minus').addEventListener('click', () => {
            qtyInput.value = Math.max(1, parseInt(qtyInput.value) - 1);
        });
        document.getElementById('qty-plus').addEventListener('click', () => {
            qtyInput.value = parseInt(qtyInput.value) + 1;
        });
    }

    const addBtn = document.getElementById('add-to-cart');
    if (addBtn) {
        insertDeliveryChoice(addBtn);
        const pieceLabels = {};
        addBtn.addEventListener('click', () => {
            if (addBtn.disabled || productSoldOut) return;
            // Collect the chosen size from EACH piece group
            const sizes = {};
            let missing = null;
            document.querySelectorAll('.size-group').forEach(group => {
                const selected = group.querySelector('.size-btn.selected');
                if (selected) {
                    sizes[group.dataset.piece] = selected.dataset.size;
                } else if (!missing) {
                    missing = group.dataset.label || pieceLabels[group.dataset.piece] || 'this piece';
                }
            });

            if (missing) {
                alert('Please select a size for: ' + missing);
                return;
            }

            const sellable = window.lookupFashforgeSellable ? window.lookupFashforgeSellable(catalogue, addBtn) : null;
            const paymentLink = sellable && typeof sellable.paymentLink === 'string' ? sellable.paymentLink.trim() : '';
            // TODO(Mandla): a Stitch Express paymentLink does not receive the chosen size yet.
            if (paymentLink) {
                window.location.assign(paymentLink);
                return;
            }

            const deliveryChoice = document.querySelector('input[name="delivery-method"]:checked');
            if (!deliveryChoice) {
                alert('Please choose door-to-door delivery or a Courier Guy locker.');
                return;
            }

            const parts = [];
            document.querySelectorAll('.size-group').forEach(group => {
                const selected = group.querySelector('.size-btn.selected');
                if (!selected) return;
                const label = PIECE_LABELS[group.dataset.piece] || group.dataset.label || 'Size';
                parts.push(label + ' ' + selected.dataset.size);
            });
            const name = addBtn.dataset.name || 'this piece';
            const sizeText = parts.join(', ');
            const message = "Hi FashForge, I'd like to order " + name + (sizeText ? ' (' + sizeText + ')' : '') + '. Delivery: ' + deliveryChoiceLabel(deliveryChoice.value) + '.';
            const url = 'https://wa.me/27672565980?text=' + encodeURIComponent(message);
            const opened = window.open(url, '_blank', 'noopener');
            if (!opened) {
                alert('Allow pop-ups to open WhatsApp, or message us on +27 67 256 5980.');
            }
        });
    }

});