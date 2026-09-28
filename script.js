// ============================================
// STYLEIT - Main JavaScript
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

    // Contact form demo
    const contactForm = document.querySelector('.contact-form form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            alert('Thank you for your message!');
            this.reset();
        });
    }

});

// ============================================
// SHOPPING CART (paste at the BOTTOM of script.js)
// NOTE: if you pasted the previous cart code, delete that
// old block first (from its header comment to the end of file)
// ============================================
document.addEventListener('DOMContentLoaded', function() {

    const cartBtn = document.getElementById('cart-btn');
    if (!cartBtn) return; // page has no cart button, do nothing

    const CART_KEY = 'styleit_cart';
    let cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');

    // Labels for each piece of the set (used in the cart display)
    const PIECE_LABELS = { top: 'Top', jogger: 'Jogger', shoe: 'Shoe' };

    // ---- Inject cart drawer + overlay into the page ----
    document.body.insertAdjacentHTML('beforeend', `
        <div class="cart-overlay" id="cart-overlay"></div>
        <aside class="cart-drawer" id="cart-drawer">
            <div class="cart-drawer-header">
                <h3>Your Cart</h3>
                <button class="cart-close" id="cart-close" aria-label="Close cart">&times;</button>
            </div>
            <div class="cart-items" id="cart-items"></div>
            <div class="cart-drawer-footer">
                <div class="cart-total-row">
                    <span>Total</span>
                    <strong id="cart-total">R0.00</strong>
                </div>
                <button class="btn-checkout" id="checkout-btn">Checkout</button>
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

    function saveCart() {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
    }

    function formatRand(amount) {
        return 'R' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    // Turn { top: 'M', jogger: 'L', shoe: '9' } into a display string
    function formatSizes(item) {
        if (item.sizes) {
            return Object.entries(item.sizes)
                .map(([piece, size]) => PIECE_LABELS[piece] + ' ' + size)
                .join(' &middot; ');
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
                        <h4>${item.name}</h4>
                        <p>${formatSizes(item)} &nbsp;&middot;&nbsp; Qty: ${item.qty}</p>
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
    }

    window.addToCart = function(product) {
        // Same product + same sizes for all pieces? Increase quantity instead of a new line
        const existing = cart.find(item =>
            item.id === product.id &&
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

    // Checkout (demo)
    checkoutBtn.addEventListener('click', function() {
        if (cart.length === 0) {
            alert('Your cart is empty.');
            return;
        }
        alert('Thank you for your order! This is a demo checkout.');
        cart = [];
        saveCart();
        renderCart();
        closeCart();
    });

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
        addBtn.addEventListener('click', () => {
            // Collect the chosen size from EACH piece group
            const sizes = {};
            let missing = null;
            document.querySelectorAll('.size-group').forEach(group => {
                const selected = group.querySelector('.size-btn.selected');
                if (selected) {
                    sizes[group.dataset.piece] = selected.dataset.size;
                } else if (!missing) {
                    missing = group.dataset.piece;
                }
            });

            if (missing) {
                const labels = { top: 'Boxy top', jogger: 'Black wide leg graphic jogger', shoe: 'Chunky lace up skater sneaker' };
                alert('Please select a size for: ' + labels[missing]);
                return;
            }

            addToCart({
                id: 'streetwear-set-1',
                name: 'Boxy Top Streetwear Set',
                price: 1050,
                sizes: sizes,      // e.g. { top: 'M', jogger: 'L', shoe: '9' }
                qty: parseInt(qtyInput.value)
            });

            addBtn.textContent = 'Added to Cart \u2713';
            addBtn.classList.add('added');
            setTimeout(() => {
                addBtn.innerHTML = 'Add to Cart &mdash; R1,050.00';
                addBtn.classList.remove('added');
            }, 2000);
        });
    }

});