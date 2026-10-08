// ============================================
// FashForge - Main JavaScript
// ============================================

document.addEventListener('DOMContentLoaded', function() {

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

    // Scroll reveal animation
    const revealElements = document.querySelectorAll('.reveal');

    const revealOnScroll = () => {
        revealElements.forEach(el => {
            const windowHeight = window.innerHeight;
            const elementTop = el.getBoundingClientRect().top;
            const revealPoint = 150;

            if (elementTop < windowHeight - revealPoint) {
                el.classList.add('active');
            }
        });
    };

    window.addEventListener('scroll', revealOnScroll);
    revealOnScroll();

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

    // Contact form -> WhatsApp (name + message, plus any subject/email the visitor typed)
    const contactForm = document.querySelector('.contact-form form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const name = (document.getElementById('name').value || '').trim();
            const message = (document.getElementById('message').value || '').trim();
            if (!name || !message) {
                alert('Please add your name and a message.');
                return;
            }
            const subject = (document.getElementById('subject').value || '').trim();
            const email = (document.getElementById('email').value || '').trim();
            let text = "Hi FashForge, my name is " + name + ".";
            if (subject) text += "\nSubject: " + subject;
            if (email) text += "\nEmail: " + email;
            text += "\n\n" + message;
            const url = 'https://wa.me/27672565980?text=' + encodeURIComponent(text);
            console.log('WhatsApp contact URL:', url);
            const opened = window.open(url, '_blank');
            if (!opened) {
                alert('Allow pop-ups to open WhatsApp and send your message.');
                return;
            }
            try { opened.opener = null; } catch (err) { /* already opened */ }
            this.reset();
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
// One place to turn card payments on.
// 'whatsapp' keeps Order on WhatsApp. This is the safe default until
// the live PayFast account is verified.
// 'payfast' replaces that button with the card checkout form.
// There is no WhatsApp order button while this is 'payfast'.
// The contact form still uses WhatsApp either way.
// ============================================
const PAYMENT_PROVIDER = 'whatsapp';

function activePaymentProvider() {
    if (PAYMENT_PROVIDER === 'payfast') return 'payfast';
    if (PAYMENT_PROVIDER !== 'whatsapp') {
        console.warn('PAYMENT_PROVIDER must be whatsapp or payfast. Staying on WhatsApp.');
    }
    return 'whatsapp';
}

// In-stock sizes only, keyed by piece id. Edit this list and the matching
// STOCK entry in netlify/lib/catalogue.js together. sizes: [] means sold out.
// Restock by putting sizes back. There is no separate sold-out flag.
// Do not add brand prices here.
const PIECE_STOCK = {
    pieces: {
        1: { name: 'Boxy top', sizes: ['XXS', 'XS', 'S', 'M', 'L'] },
        2: { name: 'Wide leg graphic jogger', sizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL'] },
        3: { name: 'Chunky skater sneaker', sizes: ['7', '8'] },
        4: { name: 'Total Diva Regular T-Shirt', sizes: ['XS', 'S', 'M', 'L', 'XL'] },
        5: { name: 'Slim Leg Turn Up Barbi Pant in Stone', sizes: ['XS'] },
        6: { name: 'adidas Originals Firebird denim pants', sizes: ['XS', 'S'] },
        7: { name: 'Tinley Sneakers', sizes: ['3', '5', '6', '7', '8'] },
        8: { name: 'Fancy Button Linen Look Wrap Top', sizes: ['XXS'] },
        9: { name: 'Culotte Linen Look Pant', sizes: ['XS', 'S'] },
        10: { name: 'Aloisa Knit Cardigan', sizes: ['One size fits most'] },
        11: { name: 'Aloisa Knit Pants', sizes: ['One size fits most'] },
        12: { name: 'Noella Sneakers', sizes: ['6', '7', '8'] },
        13: { name: 'Sleeveless Double Breasted Knit Top', sizes: ['XXS'] },
        14: { name: 'I Need You Corset', sizes: [] },
        15: { name: 'Sadie Wide Leg Jeans', sizes: [] },
        16: { name: 'Clause Boots', sizes: ['5'] }
    }
};

// Piece ids for each outfit, and for pieces sold on their own.
// Outfit cards use data-outfit-id. Piece cards use data-piece-id.
// Sold out when any of those pieces has sizes: [].
const OUTFIT_PIECE_IDS = {
    'FF-M-001': [1, 2, 3],
    'FF-W-001': [4, 5],
    'FF-W-002': [4, 6, 7],
    'FF-W-003': [8, 9],
    'FF-W-004': [10, 11, 12],
    'FF-W-005': [13, 5],
    'FF-W-006': [14, 15, 16]
};

const SINGLE_PIECE_IDS = {
    'Boxy Top': 1,
    'Black Wide Leg Graphic Jogger': 2,
    'Chunky Lace Up Skater Sneaker': 3
};

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

document.addEventListener('DOMContentLoaded', function() {

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

    // Outfit ID format: FF-<M|W|K>-<NNN> (M men, W women, K kids), e.g. FF-M-001.
    // Set data-outfit-id on the product's Add to Cart button. The next free number
    // in that department is the next ID (FF-M-002, FF-W-007, FF-K-001, ...).
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

    const payfastOn = activePaymentProvider() === 'payfast';

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
        <aside class="cart-drawer${payfastOn ? ' is-checkout' : ''}" id="cart-drawer" data-payment-provider="${payfastOn ? 'payfast' : 'whatsapp'}">
            <div class="cart-drawer-header">
                <h3>Your Cart</h3>
                <button class="cart-close" id="cart-close" aria-label="Close cart">&times;</button>
            </div>
            <div class="cart-drawer-body">
                <div class="cart-items" id="cart-items"></div>
                ${payfastOn ? checkoutFormHtml() : ''}
            </div>
            <div class="cart-drawer-footer">
                ${payfastOn ? '<p class="cart-delivery-note">Free delivery on orders over R4,000.</p>' : ''}
                <div class="cart-total-row">
                    <span>Total</span>
                    <strong id="cart-total">R0.00</strong>
                </div>
                <p class="checkout-error" id="checkout-error" role="alert" hidden></p>
                <button class="btn-checkout" id="checkout-btn" type="${payfastOn ? 'submit' : 'button'}"${payfastOn ? ' form="checkout-form"' : ''}>${payfastOn ? 'Pay by card' : 'Order on WhatsApp'}</button>
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
    } else {
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
        const defaultLabel = addBtn.innerHTML;
        const pieceLabels = {
            top: 'Boxy top',
            jogger: 'Black wide leg graphic jogger',
            shoe: 'Chunky lace up skater sneaker'
        };
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

            const outfitId = (addBtn.getAttribute('data-outfit-id') || '').trim();
            const price = Number(addBtn.dataset.price || 1050);
            const product = {
                name: addBtn.dataset.name || 'Boxy Top Streetwear Set',
                brand: addBtn.dataset.brand || 'THE FIX',
                price: price,
                qty: parseInt(qtyInput.value, 10)
            };
            // A single piece stores one size. The full set stores a size per piece.
            if (addBtn.dataset.singleSize === 'true') {
                product.size = Object.values(sizes)[0] || '';
            } else {
                product.sizes = sizes; // e.g. { top: 'M', jogger: 'L', shoe: '9' }
            }
            // Only store a real outfit ID. Missing or legacy ids must not block checkout.
            if (OUTFIT_ID_RE.test(outfitId)) product.id = outfitId;
            addToCart(product);

            addBtn.textContent = 'Added to Cart \u2713';
            addBtn.classList.add('added');
            setTimeout(() => {
                addBtn.innerHTML = defaultLabel;
                addBtn.classList.remove('added');
            }, 2000);
        });
    }

});