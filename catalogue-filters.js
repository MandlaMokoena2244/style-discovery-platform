// Shared catalogue filters. A page opts in with [data-catalogue-filters].
// data-filter-brand limits the options to one brand (a brand page).
// data-filter-sections lists which groups to show. Add "store" on a
// mixed page such as Men, Women, or Kids. Brand pages leave Store out.
(function() {
    var SECTION_ORDER = ['department', 'category', 'subcategory', 'size', 'colour', 'price', 'store'];
    var SECTION_LABELS = {
        department: 'Department',
        category: 'Category',
        subcategory: 'Subcategory',
        size: 'Size',
        colour: 'Colour',
        price: 'Price',
        store: 'Store'
    };
    var DEPARTMENT_ORDER = ['Men', 'Women', 'Kids', 'Unisex'];
    var CATEGORY_ORDER = ['Clothing', 'Footwear', 'Accessories'];
    var SUBCATEGORY_ORDER = ['Shorts', 'T-shirts', 'Caps', 'Dresses', 'Pants', 'Tops', 'Sets', 'Slippers', 'Shoes', 'Earrings'];
    var SIZE_ORDER = ['One size', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL', 'XXXL'];
    var PRICE_BANDS = [
        { id: '0-200', label: 'Under R200', min: 0, max: 200 },
        { id: '200-400', label: 'R200 – R399', min: 200, max: 400 },
        { id: '400-600', label: 'R400 – R599', min: 400, max: 600 },
        { id: '600-', label: 'R600 and over', min: 600, max: Infinity }
    ];

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function unique(values) {
        var seen = {};
        var list = [];
        values.forEach(function(value) {
            if (!value || seen[value]) return;
            seen[value] = true;
            list.push(value);
        });
        return list;
    }

    function byOrder(order) {
        return function(a, b) {
            var ai = order.indexOf(a);
            var bi = order.indexOf(b);
            if (ai === -1 && bi === -1) return a < b ? -1 : a > b ? 1 : 0;
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
        };
    }

    function sectionsFor(root) {
        var raw = (root.dataset.filterSections || '').split(',');
        var wanted = raw.map(function(item) { return item.trim(); }).filter(Boolean);
        if (!wanted.length) {
            return ['department', 'category', 'subcategory', 'size', 'colour', 'price'];
        }
        return wanted.filter(function(key) { return SECTION_ORDER.indexOf(key) !== -1; });
    }

    function productsFor(root, catalogue) {
        var brand = root.dataset.filterBrand || '';
        var departments = (root.dataset.filterDepartments || '').split(',').map(function(value) {
            return value.trim();
        }).filter(Boolean);
        return (catalogue.products || []).filter(function(product) {
            if (product.sellAlone === false || product.price == null) return false;
            if (brand && product.brand !== brand) return false;
            if (departments.length && departments.indexOf(product.department) === -1) return false;
            return true;
        });
    }

    function optionsFor(section, products) {
        if (section === 'price') {
            return PRICE_BANDS.filter(function(band) {
                return products.some(function(product) {
                    return product.price >= band.min && product.price < band.max;
                });
            }).map(function(band) {
                return { value: band.id, label: band.label };
            });
        }
        var values = [];
        products.forEach(function(product) {
            if (section === 'department') values.push(product.department);
            else if (section === 'category') values.push(product.productCategory);
            else if (section === 'subcategory') values.push(product.subcategory);
            else if (section === 'size') values = values.concat(product.sizes || []);
            else if (section === 'colour') values = values.concat(product.colours || []);
            else if (section === 'store') values.push(product.brand);
        });
        var order = section === 'department' ? DEPARTMENT_ORDER
            : section === 'category' ? CATEGORY_ORDER
            : section === 'subcategory' ? SUBCATEGORY_ORDER
            : section === 'size' ? SIZE_ORDER
            : [];
        return unique(values).sort(byOrder(order)).map(function(value) {
            return { value: value, label: value };
        });
    }

    function chevron() {
        return '<svg class="filter-chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
            '<path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>' +
            '</svg>';
    }

    function groupHtml(section, options) {
        var checks = options.map(function(option) {
            var id = 'filter-' + section + '-' + option.value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            return '<label class="filter-option" for="' + escapeHtml(id) + '">' +
                '<input type="checkbox" id="' + escapeHtml(id) + '" data-filter-key="' + escapeHtml(section) + '" value="' + escapeHtml(option.value) + '">' +
                '<span>' + escapeHtml(option.label) + '</span>' +
                '</label>';
        }).join('');
        return '<div class="filter-group">' +
            '<button type="button" class="filter-group-toggle" aria-expanded="false" aria-controls="filter-panel-' + section + '">' +
            '<span>' + escapeHtml(SECTION_LABELS[section] || section) + '</span>' +
            chevron() +
            '</button>' +
            '<div class="filter-group-panel" id="filter-panel-' + section + '" hidden>' + checks + '</div>' +
            '</div>';
    }

    function selected(root, key) {
        return Array.prototype.map.call(
            root.querySelectorAll('input[data-filter-key="' + key + '"]:checked'),
            function(input) { return input.value; }
        );
    }

    function inBand(price, bandId) {
        var band = null;
        PRICE_BANDS.forEach(function(item) {
            if (item.id === bandId) band = item;
        });
        if (!band) return false;
        return price >= band.min && price < band.max;
    }

    function cardMatches(card, root) {
        function list(name) {
            var raw = card.getAttribute(name) || '';
            return raw ? raw.split('|') : [];
        }
        function allows(key, value) {
            var chosen = selected(root, key);
            if (!chosen.length) return true;
            return chosen.indexOf(value) !== -1;
        }
        function allowsAny(key, values) {
            var chosen = selected(root, key);
            if (!chosen.length) return true;
            return values.some(function(value) { return chosen.indexOf(value) !== -1; });
        }
        if (!allows('department', card.dataset.department || '')) return false;
        if (!allows('category', card.dataset.productCategory || '')) return false;
        if (!allows('subcategory', card.dataset.subcategory || '')) return false;
        if (!allows('store', card.dataset.store || '')) return false;
        if (!allowsAny('size', list('data-sizes'))) return false;
        if (!allowsAny('colour', list('data-colours'))) return false;
        var prices = selected(root, 'price');
        if (prices.length) {
            var amount = Number(card.dataset.price);
            if (!prices.some(function(bandId) { return inBand(amount, bandId); })) return false;
        }
        return true;
    }

    function apply(root) {
        var cards = root.querySelectorAll('.piece-card');
        var shown = 0;
        Array.prototype.forEach.call(cards, function(card) {
            var match = cardMatches(card, root);
            card.classList.toggle('is-filtered-out', !match);
            if (match) shown += 1;
        });
        var count = root.querySelector('[data-filter-count]');
        if (count) count.textContent = shown === 1 ? '1 piece' : shown + ' pieces';
        var none = root.querySelector('[data-filter-none]');
        if (none) none.hidden = shown !== 0 || cards.length === 0;
        var clear = root.querySelector('[data-filter-clear]');
        if (clear) clear.hidden = false;
    }

    function closeDrawer(root) {
        root.classList.remove('is-filter-open');
        var backdrop = root.querySelector('[data-filter-backdrop]');
        if (backdrop) backdrop.hidden = true;
        document.body.classList.remove('filter-drawer-open');
    }

    function openDrawer(root) {
        root.classList.add('is-filter-open');
        var backdrop = root.querySelector('[data-filter-backdrop]');
        if (backdrop) backdrop.hidden = false;
        document.body.classList.add('filter-drawer-open');
    }

    function build(root, catalogue) {
        var products = productsFor(root, catalogue);
        var toolbar = root.querySelector('[data-filter-toolbar]');
        var panel = root.querySelector('[data-filter-panel]');
        var groups = root.querySelector('[data-filter-groups]');
        if (!products.length || !panel || !groups) {
            if (toolbar) toolbar.hidden = true;
            if (panel) panel.hidden = true;
            closeDrawer(root);
            return;
        }
        var html = '';
        sectionsFor(root).forEach(function(section) {
            var options = optionsFor(section, products);
            if (!options.length) return;
            html += groupHtml(section, options);
        });
        groups.innerHTML = html;
        panel.hidden = !html;
        if (toolbar) toolbar.hidden = !html;
        groups.querySelectorAll('.filter-group-toggle').forEach(function(button) {
            button.addEventListener('click', function() {
                var open = button.getAttribute('aria-expanded') === 'true';
                var region = document.getElementById(button.getAttribute('aria-controls'));
                button.setAttribute('aria-expanded', open ? 'false' : 'true');
                if (region) region.hidden = open;
            });
        });
        groups.addEventListener('change', function() { apply(root); });
        var clear = root.querySelector('[data-filter-clear]');
        if (clear) {
            clear.addEventListener('click', function() {
                groups.querySelectorAll('input[type="checkbox"]').forEach(function(input) {
                    input.checked = false;
                });
                apply(root);
            });
        }
        var opener = root.querySelector('[data-filter-open]');
        var closer = root.querySelector('[data-filter-close]');
        var backdrop = root.querySelector('[data-filter-backdrop]');
        if (opener) opener.addEventListener('click', function() { openDrawer(root); });
        if (closer) closer.addEventListener('click', function() { closeDrawer(root); });
        if (backdrop) backdrop.addEventListener('click', function() { closeDrawer(root); });
        apply(root);
    }

    document.addEventListener('fashforge:catalogue', function(event) {
        document.querySelectorAll('[data-catalogue-filters]').forEach(function(root) {
            build(root, event.detail || { products: [] });
        });
    });
})();
