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

function ensureSiteNav() {
    var navbar = document.querySelector('.navbar');
    if (!navbar) return;
    var links = navbar.querySelector('.nav-links');
    if (!links) {
        links = document.createElement('ul');
        links.className = 'nav-links';
        var cart = navbar.querySelector('.cart-btn');
        if (cart) navbar.insertBefore(links, cart);
        else navbar.appendChild(links);
    }
    links.innerHTML =
        '<li><a href="index.html">Home</a></li>' +
        '<li><a href="men.html">Men</a></li>' +
        '<li><a href="women.html">Women</a></li>' +
        '<li><a href="kids.html">Kids</a></li>' +
        '<li><a href="brands.html">Brands</a></li>';
    if (!navbar.querySelector('.cart-btn')) {
        var button = document.createElement('button');
        button.className = 'cart-btn';
        button.id = 'cart-btn';
        button.setAttribute('aria-label', 'Open cart');
        button.innerHTML = '<span class="cart-count" id="cart-count">0</span>';
        navbar.appendChild(button);
    }
    if (!navbar.querySelector('.hamburger')) {
        var burger = document.createElement('div');
        burger.className = 'hamburger';
        burger.innerHTML = '<span></span><span></span><span></span>';
        navbar.appendChild(burger);
    }
    var file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    var active = '';
    if (!file || file === 'index.html') active = 'index.html';
    else if (file.indexOf('men') === 0) active = 'men.html';
    else if (file.indexOf('women') === 0) active = 'women.html';
    else if (file.indexOf('kids') === 0) active = 'kids.html';
    else if (file.indexOf('brand') === 0) active = 'brands.html';
    links.querySelectorAll('a').forEach(function(link) {
        var href = link.getAttribute('href');
        if (href === active) {
            link.setAttribute('aria-current', 'page');
        } else {
            link.removeAttribute('aria-current');
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    applySiteDetails();
    ensureSiteNav();

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
// Checkout is enabled only by the server flag. WhatsApp contact is for questions.
// Legacy PayFast handlers are retained separately; storefront purchases use Stitch.
const PAYMENT_PROVIDER = 'disabled';
const ORDERS_PAUSED_NOTICE = 'Checkout temporarily unavailable. Please try again later.';

function activePaymentProvider() {
    if (typeof window !== 'undefined' && window.FASHFORGE && window.FASHFORGE.checkoutEnabled === true) return 'stitch';
    return 'disabled';
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

// Product purchase helpers. Shared by the catalogue's product and outfit template.
async function loadCheckoutFlag() {
    // Fail closed even if an old local flag or a previous response enabled checkout.
    if (window.FASHFORGE) {
        window.FASHFORGE.checkoutEnabled = false;
        window.FASHFORGE.checkoutMode = null;
    }
    try {
        const response = await fetch('/api/site-config', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
        if (!response.ok) return;
        const config = await response.json();
        if (typeof config.checkoutEnabled === 'boolean' && window.FASHFORGE) {
            window.FASHFORGE.checkoutEnabled = config.checkoutEnabled;
            window.FASHFORGE.checkoutMode = ['test', 'live'].includes(config.checkoutMode) ? config.checkoutMode : null;
        }
    } catch { /* Static hosting/network failure keeps checkout disabled. */ }
}

function productCartItems(catalogue, id, sizes, qty) {
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) throw new Error('Choose a quantity from 1 to 20.');
    const products = catalogue && catalogue.products || [];
    const outfit = (catalogue && catalogue.outfits || []).find(item => item.id === id);
    const product = products.find(item => item.id === id);
    const selections = outfit
        ? (outfit.pieces || []).map(piece => ({ product: products.find(p => p.stockId === piece.stockId), size: sizes[piece.key] }))
        : [{ product: product, size: Object.values(sizes)[0] || '' }];
    if (!selections.length) throw new Error('This item is unavailable for checkout.');
    return selections.map(selection => {
        const p = selection.product;
        if (!p || p.sellAlone !== true || p.inStock === false || (Array.isArray(p.sizes) && !p.sizes.length)) {
            throw new Error('This item is unavailable for checkout.');
        }
        if (Array.isArray(p.sizes) && !p.sizes.includes(selection.size)) throw new Error('Please select an available size for: ' + p.name);
        return {
            id: p.id, name: p.name, brand: p.brand || '', size: selection.size || '', qty: qty,
            // Display only. submitStitchCheckout sends just id, size and qty.
            price: p.price
        };
    });
}

function bindProductPurchase(button, catalogue, checkoutEnabled) {
    const feedback = document.createElement('p');
    feedback.id = 'product-purchase-feedback';
    feedback.className = 'product-purchase-feedback';
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');
    button.insertAdjacentElement('afterend', feedback);
    if (!checkoutEnabled) {
        button.disabled = true;
        button.textContent = 'Checkout temporarily unavailable';
        button.setAttribute('aria-disabled', 'true');
    } else if (!button.disabled) button.textContent = 'Add to cart';

    function selection() {
        const sizes = {};
        document.querySelectorAll('.product-info-col .size-group').forEach(group => {
            const selected = group.querySelector('.size-btn.selected');
            if (!selected) throw new Error('Please select a size for: ' + (group.dataset.label || 'this item'));
            sizes[group.dataset.piece] = selected.dataset.size;
        });
        const qtyInput = document.getElementById('qty');
        const qty = qtyInput ? Number(qtyInput.value) : 1;
        if (!Number.isInteger(qty) || qty < 1 || qty > 20) throw new Error('Choose a quantity from 1 to 20.');
        return { sizes, qty };
    }
    function showError(error) {
        feedback.setAttribute('role', 'alert');
        feedback.textContent = error.message;
    }
    button.addEventListener('click', function() {
        if (button.disabled) return;
        try {
            const chosen = selection();
            if (checkoutEnabled) {
                const lines = productCartItems(catalogue, button.dataset.outfitId || button.dataset.id, chosen.sizes, chosen.qty);
                lines.forEach(line => window.addToCart(line));
                feedback.setAttribute('role', 'status');
                feedback.textContent = 'Added to cart. Review your items in the cart to check out.';
                button.classList.add('added');
            }
        } catch (error) { showError(error); }
    });

}
// End product purchase helpers.

document.addEventListener('DOMContentLoaded', async function() {

    const checkoutFlagReady = loadCheckoutFlag();
    let catalogue = null;
    try {
        const response = await fetch('products.json');
        if (response.ok) catalogue = await response.json();
    } catch (err) {
        catalogue = null;
    }
    await checkoutFlagReady;
    if (catalogue && window.renderFashforgeCatalogue) {
        (catalogue.products || []).forEach(function(product) {
            if (product.stockId == null) return;
            PIECE_STOCK.pieces[product.stockId] = { sizes: Array.isArray(product.sizes) ? product.sizes.slice() : [] };
            if (product.name) SINGLE_PIECE_IDS[product.name] = product.stockId;
        });
        (catalogue.outfits || []).forEach(function(outfit) {
            OUTFIT_PIECE_IDS[outfit.id] = (outfit.pieces || []).map(function(piece) { return piece.stockId; });
        });
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

    // Short labels for legacy cart sizes.
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
    const stitchOn = paymentProvider === 'stitch';
    const checkoutOn = payfastOn || stitchOn;
    let stitchSubmitting = false;
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
                ${stitchOn ? (window.FASHFORGE.checkoutMode === 'test' ? '<p>Test checkout only. No orders will be fulfilled. Use test details.</p>' : '') + '<div class="form-group"><label for="checkout-delivery">Delivery in South Africa</label><select id="checkout-delivery"><option value="door">Door-to-door</option><option value="locker">Courier Guy locker</option></select></div><p>For locker delivery, enter the locker address below.</p>' : ''}
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
        <aside class="cart-drawer${checkoutOn ? ' is-checkout' : ''}" id="cart-drawer" data-payment-provider="${paymentProvider}">
            <div class="cart-drawer-header">
                <h3>Your Cart</h3>
                <button class="cart-close" id="cart-close" aria-label="Close cart">&times;</button>
            </div>
            <div class="cart-drawer-body">
                <div class="cart-items" id="cart-items"></div>
                ${checkoutOn ? checkoutFormHtml() : ''}
            </div>
            <div class="cart-drawer-footer">
                ${checkoutOn ? '<p class="cart-delivery-note">' + (window.FASHFORGE && window.FASHFORGE.freeDeliveryLine ? window.FASHFORGE.freeDeliveryLine() : 'Free delivery on orders of R2,000 or more.') + '</p>' : ''}
                <div class="cart-total-row">
                    <span>Total</span>
                    <strong id="cart-total">R0.00</strong>
                </div>
                <p class="checkout-error" id="checkout-error" role="alert" hidden></p>
                ${ordersDisabled
                    ? '<p class="orders-paused" role="status">' + ORDERS_PAUSED_NOTICE + '</p><button class="btn-checkout is-paused" id="checkout-btn" type="button" disabled>Checkout temporarily unavailable</button>'
                    : '<button class="btn-checkout" id="checkout-btn" type="' + (checkoutOn ? 'submit' : 'button') + '"' + (checkoutOn ? ' form="checkout-form"' : '') + '>' + (stitchOn ? (window.FASHFORGE.checkoutMode === 'test' ? 'Checkout (test)' : 'Checkout') : payfastOn ? 'Pay by card' : 'Checkout temporarily unavailable') + '</button>'}
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
    window.addEventListener('fashforge:order-paid', function() {
        cart = [];
        renderCart();
    });

    // Turn { top: 'M', jogger: 'L', shoe: '9' } into a display string
    function formatSizes(item, plain) {
        if (item.sizes) {
            const parts = Object.entries(item.sizes)
                .map(([piece, size]) => (PIECE_LABELS[piece] || piece) + ' ' + size);
            return plain ? parts.join(', ') : parts.join(' &middot; ');
        }
        return item.size || ''; // old cart items (backwards compatible)
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
        const fee = stitchOn && cart.length ? stitchDeliveryFee(total) : 0;
        totalEl.textContent = formatRand(total + fee);
        if (stitchOn) {
            checkoutBtn.disabled = stitchSubmitting || !cart.length || !!stitchCartProblem();
            const note = drawer.querySelector('.cart-delivery-note');
            if (note) note.textContent = 'Delivery: ' + formatRand(fee) + '. ' + window.FASHFORGE.freeDeliveryLine();
        }

        const blocked = stitchOn ? stitchCartProblem() : soldOutCartMessage(cart);
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

    function stitchDeliveryFee(subtotal) {
        const rules = window.FASHFORGE.delivery;
        if (subtotal >= rules.freeFrom) return 0;
        return fieldValue('checkout-delivery') === 'locker' ? rules.locker : rules.doorToDoor;
    }

    function stitchCartProblem() {
        if (!catalogue || !Array.isArray(catalogue.products)) return 'The catalogue could not load. Refresh before checking out.';
        for (const item of cart) {
            const product = catalogue.products.find(p => p.id === item.id && p.sellAlone);
            if (!product || product.inStock === false || (Array.isArray(product.sizes) && !product.sizes.length)) return 'An item is unavailable. Remove it from your cart.';
            if (Array.isArray(product.sizes) && !product.sizes.includes(item.size)) return 'Choose an available size for ' + product.name + '. Remove it and add it again with a size.';
            if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 20) return 'Quantity must be between 1 and 20.';
        }
        return '';
    }

    async function submitStitchCheckout() {
        if (stitchSubmitting || activePaymentProvider() !== 'stitch') return;
        const problem = !cart.length ? 'Your cart is empty.' : stitchCartProblem();
        if (problem) { showCheckoutError(problem); return; }
        const form = document.getElementById('checkout-form');
        if (!form.reportValidity()) return;
        const customer = readCheckoutCustomer();
        if (customer.name.length < 3 || customer.name.length > 40) {
            showCheckoutError('Enter your full name (3–40 characters).'); return;
        }
        const invalid = validateCheckoutCustomer(customer);
        if (invalid) { showCheckoutError(invalid); return; }
        customer.country = 'ZA';
        stitchSubmitting = true;
        checkoutBtn.disabled = true;
        checkoutBtn.textContent = 'Opening secure checkout…';
        showCheckoutError('');
        try {
            const response = await fetch('/api/checkout', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer: customer, deliveryMethod: fieldValue('checkout-delivery'),
                    items: cart.map(item => ({ id: item.id, size: item.size || '', qty: item.qty }))
                })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Checkout could not be started.');
            const target = new URL(data.redirectUrl);
            if (target.origin !== 'https://express.stitch.money' || target.username || target.password) throw new Error('Invalid checkout link.');
            const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.qty, 0);
            if (data.amount !== Math.round((subtotal + stitchDeliveryFee(subtotal)) * 100)) throw new Error('Prices have changed. Refresh and add your items again before checking out.');
            window.location.assign(target.href);
        } catch (error) {
            showCheckoutError(error.message || 'Checkout could not be started.');
            stitchSubmitting = false;
            checkoutBtn.disabled = false;
            checkoutBtn.textContent = window.FASHFORGE.checkoutMode === 'test' ? 'Checkout (test)' : 'Checkout';
        }
    }

    if (stitchOn) {
        document.getElementById('checkout-delivery').addEventListener('change', renderCart);
        document.getElementById('checkout-form').addEventListener('submit', function(event) {
            event.preventDefault();
            submitStitchCheckout();
        });
    }
    if (payfastOn) {
        document.getElementById('checkout-form').addEventListener('submit', function(e) {
            e.preventDefault();
            submitPayfastCheckout();
        });
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
    if (addBtn) bindProductPurchase(addBtn, catalogue, activePaymentProvider() === 'stitch');

});
