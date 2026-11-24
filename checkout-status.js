(function () {
    'use strict';
    const message = document.getElementById('order-message');
    const heading = document.getElementById('order-heading');
    const total = document.getElementById('order-total');
    const retry = document.getElementById('order-retry');
    const refresh = document.getElementById('order-refresh');
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('ref') || params.get('reference');
    const referencePattern = /^FF-(?:TEST-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    const delays = [2000, 4000, 8000, 12000, 20000, 30000, 30000];
    let attempts = 0;
    let running = false;
    let cartCleared = false;
    function clearPaidCart() {
        if (cartCleared) return;
        cartCleared = true;
        try { localStorage.removeItem('fashforge_cart'); } catch { /* Storage can be disabled. */ }
        window.dispatchEvent(new Event('fashforge:order-paid'));
    }
    async function poll() {
        if (running) return;
        running = true;
        refresh.hidden = true;
        let finished = false;
        try {
            const response = await fetch('/api/order-status?ref=' + encodeURIComponent(reference), {
                cache: 'no-store', signal: AbortSignal.timeout(15000)
            });
            const data = await response.json();
            if (!response.ok) throw new Error('Status unavailable');
            if (!['pending', 'paid', 'failed', 'cancelled'].includes(data.status) || !Number.isSafeInteger(data.total)) throw new Error('Invalid status');
            if (cartCleared && data.status !== 'paid') throw new Error('Waiting for status propagation');
            total.textContent = 'Order total: ' + new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(data.total / 100);
            if (data.status === 'paid') {
                heading.textContent = 'Thank you!';
                const email = response.headers.get('X-Order-Confirmation');
                message.textContent = "Payment successful, thank you!" + (email === 'sent' ? " We've emailed your confirmation." : email === 'skipped' ? ' Your payment is confirmed. Please contact us if you need a confirmation email.' : " We're preparing your confirmation email.");
                retry.hidden = true;
                clearPaidCart();
                finished = email === 'sent' || email === 'skipped';
            } else if (data.status === 'failed' || data.status === 'cancelled') {
                heading.textContent = 'Please try again';
                message.textContent = "Payment didn't go through. Your items are still in your cart.";
                retry.hidden = false;
                finished = true;
            } else if (!cartCleared) {
                message.textContent = "We're confirming your payment. This may take a moment.";
            }
        } catch {
            if (!cartCleared) message.textContent = "We're confirming your payment. Please check again in a moment.";
        } finally {
            running = false;
        }
        if (!finished && attempts < delays.length) {
            setTimeout(poll, delays[attempts++]);
        } else if (!finished) {
            refresh.hidden = false;
        }
    }
    refresh.addEventListener('click', function () { attempts = 0; poll(); });
    if (!referencePattern.test(reference || '')) {
        message.textContent = "We couldn't find your order reference. Please contact us for help.";
        refresh.hidden = true;
        return;
    }
    poll();
})();
