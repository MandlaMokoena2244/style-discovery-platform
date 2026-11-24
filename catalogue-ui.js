// Renders listing grids and the generic product page from products.json.
// Adding a product is one entry in that file. Pages with data-catalogue-* fill themselves.

(function() {
    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatRand(amount) {
        return 'R' + Number(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    function styleLabel(style) {
        return String(style || '').replace(/-/g, ' ').replace(/\b\w/g, function(c) {
            return c.toUpperCase();
        });
    }

    function genderLabel(gender) {
        if (gender === 'men') return 'Men';
        if (gender === 'women') return 'Women';
        if (gender === 'kids') return 'Kids';
        return gender || '';
    }

    function productByStock(products, stockId) {
        for (let i = 0; i < products.length; i++) {
            if (Number(products[i].stockId) === Number(stockId)) return products[i];
        }
        return null;
    }

    function outfitInStock(outfit, products) {
        if (!outfit.pieces || !outfit.pieces.length) return !!outfit.inStock;
        return outfit.pieces.every(function(piece) {
            const product = productByStock(products, piece.stockId);
            return product && Array.isArray(product.sizes) && product.sizes.length > 0;
        });
    }

    function hrefFor(item) {
        if (item.page) return item.page;
        return 'product.html?id=' + encodeURIComponent(item.id);
    }

    function imageHtml(images, alt, lazy) {
        const list = Array.isArray(images) ? images : [];
        const webp = list.filter(function(src) { return /\.webp($|\?)/i.test(src); })[0];
        const fallback = list.filter(function(src) { return !/\.webp($|\?)/i.test(src); })[0] || list[0] || '';
        const loading = lazy ? ' loading="lazy"' : '';
        const safeAlt = escapeHtml(alt);
        const safeFallback = escapeHtml(fallback);
        if (!fallback) return '';
        if (webp) {
            return '<picture><source srcset="' + escapeHtml(webp) + '" type="image/webp">' +
                '<img src="' + safeFallback + '" alt="' + safeAlt + '"' + loading + '></picture>';
        }
        return '<img src="' + safeFallback + '" alt="' + safeAlt + '"' + loading + '>';
    }

    function emptyHtml(title, text) {
        return '<div class="catalogue-empty">' +
            '<h2>' + escapeHtml(title || 'New pieces coming soon') + '</h2>' +
            '<p>' + escapeHtml(text || 'Follow us on Instagram for the first drop.') + '</p>' +
            '<p><a href="https://www.instagram.com/fashforge_official_account/" target="_blank" rel="noopener noreferrer">@fashforge_official_account</a></p>' +
            '</div>';
    }

    function outfitCard(outfit, products) {
        const brand = outfit.brand ? 'Brand' + (String(outfit.brand).indexOf(' and ') !== -1 ? 's' : '') + ': ' + outfit.brand : '';
        return '<a href="' + escapeHtml(hrefFor(outfit)) + '" class="item-card outfit-card" data-outfit-id="' + escapeHtml(outfit.id) + '">' +
            (outfit.tag ? '<span class="item-tag">' + escapeHtml(outfit.tag) + '</span>' : '') +
            imageHtml(outfit.images, outfit.imageAlt || outfit.title, true) +
            '<div class="item-info">' +
            (brand ? '<p class="item-brand">' + escapeHtml(brand) + '</p>' : '') +
            '<h3>' + escapeHtml(outfit.title) + '</h3>' +
            '<p class="item-id">' + escapeHtml(outfit.id) + '</p>' +
            '<p class="item-price">' + formatRand(outfit.totalPrice) + '</p>' +
            '</div></a>';
    }

    function listAttr(values) {
        return escapeHtml((Array.isArray(values) ? values : []).join('|'));
    }

    function productImages(item) {
        if (item && Array.isArray(item.images) && item.images.length) return item.images;
        if (item && item.image) return [item.image];
        return [];
    }

    function imageAltAt(item, index, fallback) {
        const alts = item && Array.isArray(item.imageAlts) ? item.imageAlts : [];
        return alts[index] || (index === 0 && item && item.imageAlt) || fallback;
    }

    function cardFrame(product) {
        const images = productImages(product);
        let html = '<div class="piece-frame">' +
            imageHtml(images.slice(0, 1), product.imageAlt || product.name, true);
        if (images.length > 1) {
            html += '<img class="card-hover-image" src="' + escapeHtml(images[1]) + '" alt="" aria-hidden="true">';
        }
        return html + '</div>';
    }

    function galleryHtml(item, name) {
        const images = productImages(item);
        if (!images.length) return '';
        const thumbs = images.map(function(src, index) {
            const alt = imageAltAt(item, index, name + ', photo ' + (index + 1));
            return '<button type="button" class="gallery-thumb' + (index === 0 ? ' is-active' : '') + '"' +
                ' data-src="' + escapeHtml(src) + '" data-alt="' + escapeHtml(alt) + '"' +
                ' aria-label="' + escapeHtml(alt) + '" aria-pressed="' + (index === 0 ? 'true' : 'false') + '">' +
                '<img src="' + escapeHtml(src) + '" alt="">' +
                '</button>';
        }).join('');
        const mainAlt = imageAltAt(item, 0, name);
        return '<div class="product-gallery" data-product-gallery>' +
            '<div class="gallery-stage" tabindex="0">' +
            (images.length > 1
                ? '<button type="button" class="gallery-nav gallery-prev" aria-label="Previous photo">&#8249;</button>' +
                  '<button type="button" class="gallery-nav gallery-next" aria-label="Next photo">&#8250;</button>'
                : '') +
            '<img class="gallery-main" src="' + escapeHtml(images[0]) + '" alt="' + escapeHtml(mainAlt) + '">' +
            '</div>' +
            (images.length > 1 ? '<div class="gallery-thumbs">' + thumbs + '</div>' : '') +
            '</div>';
    }

    function bindGallery(root) {
        const gallery = root.querySelector('[data-product-gallery]');
        if (!gallery) return;
        const main = gallery.querySelector('.gallery-main');
        const stage = gallery.querySelector('.gallery-stage');
        const thumbs = Array.prototype.slice.call(gallery.querySelectorAll('.gallery-thumb'));
        if (!main || !thumbs.length) return;
        let index = 0;
        let touchX = null;
        function show(next) {
            index = (next + thumbs.length) % thumbs.length;
            const thumb = thumbs[index];
            main.src = thumb.getAttribute('data-src');
            main.alt = thumb.getAttribute('data-alt') || '';
            thumbs.forEach(function(button, i) {
                const on = i === index;
                button.classList.toggle('is-active', on);
                button.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
            thumb.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
        thumbs.forEach(function(button, i) {
            button.addEventListener('click', function() { show(i); });
        });
        const prev = gallery.querySelector('.gallery-prev');
        const next = gallery.querySelector('.gallery-next');
        if (prev) prev.addEventListener('click', function() { show(index - 1); });
        if (next) next.addEventListener('click', function() { show(index + 1); });
        stage.addEventListener('keydown', function(event) {
            if (event.key === 'ArrowRight') { event.preventDefault(); show(index + 1); }
            if (event.key === 'ArrowLeft') { event.preventDefault(); show(index - 1); }
        });
        stage.addEventListener('touchstart', function(event) {
            touchX = event.changedTouches[0].clientX;
        }, { passive: true });
        stage.addEventListener('touchend', function(event) {
            if (touchX == null) return;
            const delta = event.changedTouches[0].clientX - touchX;
            touchX = null;
            if (Math.abs(delta) < 40) return;
            show(delta < 0 ? index + 1 : index - 1);
        }, { passive: true });
    }

    function pieceCard(product) {
        const extra = product.cardClass ? ' ' + product.cardClass : '';
        return '<a href="' + escapeHtml(hrefFor(product)) + '" class="item-card piece-card' + extra + '"' +
            ' data-piece-id="' + escapeHtml(product.stockId) + '"' +
            ' data-department="' + escapeHtml(product.department || '') + '"' +
            ' data-product-category="' + escapeHtml(product.productCategory || '') + '"' +
            ' data-subcategory="' + escapeHtml(product.subcategory || '') + '"' +
            ' data-sizes="' + listAttr(product.sizes) + '"' +
            ' data-colours="' + listAttr(product.colours) + '"' +
            ' data-price="' + escapeHtml(product.price) + '"' +
            ' data-store="' + escapeHtml(product.brand || '') + '">' +
            cardFrame(product) +
            '<div class="item-info">' +
            '<p class="item-brand">by ' + escapeHtml(product.brand) + '</p>' +
            '<h3>' + escapeHtml(product.name) + '</h3>' +
            '<p class="item-price">' + formatRand(product.price) + '</p>' +
            '</div></a>';
    }

    function renderGrids(catalogue) {
        const products = catalogue.products || [];
        const outfits = catalogue.outfits || [];
        document.querySelectorAll('[data-catalogue-grid]').forEach(function(grid) {
            const kind = grid.dataset.kind || 'outfit';
            const gender = grid.dataset.gender || '';
            const style = grid.dataset.style || '';
            let html = '';
            if (kind === 'piece') {
                const brand = grid.dataset.brand || '';
                const departments = (grid.dataset.department || '').split(',').map(function(value) {
                    return value.trim();
                }).filter(Boolean);
                const pieces = products.filter(function(product) {
                    if (product.sellAlone === false) return false;
                    if (product.price == null) return false;
                    if (brand) {
                        if (product.brand !== brand) return false;
                    } else if (!departments.length && product.placement === 'brand') {
                        return false;
                    }
                    if (departments.length) {
                        if (departments.indexOf(product.department) === -1) return false;
                    } else if (gender && product.category !== gender) {
                        return false;
                    }
                    if (style && product.style !== style) return false;
                    return true;
                });
                html = pieces.map(pieceCard).join('');
            } else {
                const matches = outfits.filter(function(outfit) {
                    if (gender && outfit.gender !== gender) return false;
                    if (style && outfit.style !== style) return false;
                    return true;
                });
                html = matches.map(function(outfit) { return outfitCard(outfit, products); }).join('');
            }
            if (!html) {
                html = emptyHtml(grid.dataset.emptyTitle, grid.dataset.emptyText);
            }
            grid.innerHTML = html;
        });
    }

    function renderTrending(catalogue) {
        const mount = document.querySelector('[data-catalogue-trending]');
        if (!mount) return;
        const outfits = (catalogue.outfits || []).filter(function(outfit) { return outfit.trending; });
        const groups = [];
        outfits.forEach(function(outfit) {
            const key = outfit.gender + '|' + outfit.style;
            let group = null;
            for (let i = 0; i < groups.length; i++) {
                if (groups[i].key === key) group = groups[i];
            }
            if (!group) {
                group = { key: key, gender: outfit.gender, style: outfit.style, stylePage: outfit.stylePage, items: [] };
                groups.push(group);
            }
            group.items.push(outfit);
        });
        if (!groups.length) {
            mount.innerHTML = emptyHtml('New outfits coming soon', 'Follow us on Instagram for the first drop.');
            return;
        }
        mount.innerHTML = groups.map(function(group) {
            const title = genderLabel(group.gender) + ' ' + styleLabel(group.style);
            const heading = group.stylePage
                ? '<a href="' + escapeHtml(group.stylePage) + '">' + escapeHtml(title) + '</a>'
                : escapeHtml(title);
            const single = group.items.length === 1 ? ' single' : '';
            return '<div class="trending-group' + single + '">' +
                '<h3 class="trending-style-name">' + heading + '</h3>' +
                '<div class="items-grid">' +
                group.items.map(function(outfit) { return outfitCard(outfit, catalogue.products || []); }).join('') +
                '</div></div>';
        }).join('');
    }

    function renderStyles(catalogue) {
        const products = catalogue.products || [];
        document.querySelectorAll('[data-catalogue-styles]').forEach(function(grid) {
            const gender = grid.dataset.gender || '';
            const seen = {};
            const styles = [];
            (catalogue.outfits || []).forEach(function(outfit) {
                if (gender && outfit.gender !== gender) return;
                const key = outfit.style + '|' + (outfit.stylePage || '');
                if (seen[key]) {
                    seen[key].count += 1;
                    if (!outfitInStock(outfit, products)) seen[key].soldOut = true;
                    return;
                }
                seen[key] = {
                    style: outfit.style,
                    stylePage: outfit.stylePage,
                    image: (outfit.images || []).filter(function(src) { return !/\.webp($|\?)/i.test(src); })[0] || (outfit.images || [])[0],
                    count: 1,
                    outfitId: outfit.id,
                    soldOut: !outfitInStock(outfit, products)
                };
                styles.push(seen[key]);
            });
            if (!styles.length) {
                grid.innerHTML = emptyHtml(grid.dataset.emptyTitle || 'New outfits coming soon', grid.dataset.emptyText || '');
                return;
            }
            grid.innerHTML = styles.map(function(style) {
                const countLabel = style.count === 1 ? 'One full outfit' : style.count + ' full outfits';
                const sold = style.count === 1 && style.soldOut ? ' data-outfit-id="' + escapeHtml(style.outfitId) + '"' : '';
                const image = style.image ? ' style="background-image: url(\'' + escapeHtml(style.image) + '\')"' : '';
                const href = style.stylePage || '#';
                return '<a href="' + escapeHtml(href) + '" class="style-card photo-tile"' + sold + '>' +
                    '<div class="style-card-image"' + image + '></div>' +
                    '<div class="style-card-overlay"></div>' +
                    '<div class="style-card-content"><h3>' + escapeHtml(styleLabel(style.style)) + '</h3><p>' + escapeHtml(countLabel) + '</p></div>' +
                    '</a>';
            }).join('');
            if (grid.dataset.emptyText && styles.length) {
                const note = document.createElement('p');
                note.className = 'drops-note';
                note.textContent = grid.dataset.emptyText;
                grid.insertAdjacentElement('afterend', note);
            }
        });
    }

    function renderBrands(catalogue) {
        const grid = document.querySelector('[data-catalogue-brands]');
        if (!grid) return;
        const names = [];
        (catalogue.products || []).forEach(function(product) {
            if (product.brand && names.indexOf(product.brand) === -1) names.push(product.brand);
        });
        if (!names.length) {
            grid.innerHTML = emptyHtml('New outfits coming soon', 'Partner brands will be listed here when new outfits are added.');
            return;
        }
        grid.innerHTML = names.map(function(name) {
            return '<article class="brand-card"><h3>' + escapeHtml(name) + '</h3>' +
                '<p>Pieces and outfits styled by FashForge.</p></article>';
        }).join('');
    }

    function sizeButtons(piece, key) {
        return '<h4 class="product-subheading">' + escapeHtml(piece.label || 'Piece') + ': select size</h4>' +
            '<div class="size-buttons size-group" data-piece="' + escapeHtml(key) + '" data-piece-id="' + escapeHtml(piece.stockId) + '" data-label="' + escapeHtml(piece.label || 'this piece') + '"></div>';
    }

    function renderProductPage(catalogue) {
        const mount = document.querySelector('[data-catalogue-product]');
        if (!mount) return;
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id') || '';
        const products = catalogue.products || [];
        const outfit = (catalogue.outfits || []).filter(function(item) { return item.id === id; })[0];
        const product = products.filter(function(item) { return item.id === id; })[0];
        const item = outfit || product;
        if (!item) {
            mount.innerHTML = '<div class="product-missing"><h1>We could not find that piece</h1><p><a href="index.html">Back to FashForge</a></p></div>';
            document.title = 'Not found | FashForge';
            return;
        }
        const isOutfit = !!outfit;
        const name = isOutfit ? outfit.title : product.name;
        const price = isOutfit ? outfit.totalPrice : product.price;
        const brand = item.brand || '';
        document.title = name + ' by ' + brand + ' | FashForge';
        const description = item.description || (name + ' by ' + brand + '.');
        const meta = document.querySelector('meta[name="description"]');
        if (meta) meta.setAttribute('content', description);
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.setAttribute('content', name + ' by ' + brand + ' | FashForge');
        const ogDescription = document.querySelector('meta[property="og:description"]');
        if (ogDescription) ogDescription.setAttribute('content', description);
        const canonical = document.querySelector('link[rel="canonical"]');
        if (canonical) canonical.setAttribute('href', 'https://fashforge.co.za/product.html?id=' + encodeURIComponent(id));

        let sizes = '';
        if (isOutfit) {
            sizes = outfit.pieces.map(function(piece) {
                return sizeButtons(piece, piece.key);
            }).join('');
        } else if (product.stockId != null) {
            sizes = sizeButtons({ label: product.name, stockId: product.stockId }, product.label ? product.label.toLowerCase() : 'size');
        }

        const dataOutfit = isOutfit ? ' data-outfit-id="' + escapeHtml(outfit.id) + '"' : '';
        const dataSingle = isOutfit ? '' : ' data-single-size="true"';
        const brandPages = {
            'Indie Nation': 'brand-indie-nation.html',
            'LilyCo': 'brand-lilyco.html',
            'DE TIAMO': 'brand-de-tiamo.html'
        };
        const back = brandPages[brand] || (isOutfit ? outfit.stylePage : '') || (product && product.category === 'women' ? 'women.html' : product && product.category === 'kids' ? 'kids.html' : 'men.html');

        mount.innerHTML =
            '<div class="product-detail-inner">' +
            '<div class="product-image-col">' +
            (isOutfit && outfit.tag ? '<span class="item-tag">' + escapeHtml(outfit.tag) + '</span>' : '') +
            galleryHtml(item, name) +
            '</div>' +
            '<div class="product-info-col">' +
            (isOutfit ? '<p class="outfit-id">Outfit ID: ' + escapeHtml(outfit.id) + '</p>' : '') +
            '<p class="product-brand">by ' + escapeHtml(brand) + '</p>' +
            '<h1 class="product-name">' + escapeHtml(name) + '</h1>' +
            '<p class="product-price">' + formatRand(price) + '</p>' +
            ( !isOutfit && product.colours && product.colours.length
                ? '<p class="product-note">Colours: ' + escapeHtml(product.colours.join(', ')) + '</p>'
                : '' ) +
            '<p class="product-note">' + escapeHtml(description) + '</p>' +
            '<div class="product-divider"></div>' +
            sizes +
            '<h4 class="product-subheading">Quantity</h4>' +
            '<div class="qty-selector">' +
            '<button class="qty-btn" id="qty-minus" type="button">&minus;</button>' +
            '<input type="text" id="qty" value="1" readonly>' +
            '<button class="qty-btn" id="qty-plus" type="button">+</button>' +
            '</div>' +
            '<button class="btn-add-cart" id="add-to-cart" type="button"' + dataOutfit + dataSingle +
            (window.FASHFORGE && window.FASHFORGE.checkoutEnabled === true ? '' : ' disabled aria-disabled="true"') + ' data-id="' + escapeHtml(item.id) + '" data-name="' + escapeHtml(name) + '" data-brand="' + escapeHtml(brand) + '" data-price="' + escapeHtml(price) + '">' +
            (window.FASHFORGE && window.FASHFORGE.checkoutEnabled === true ? 'Add to cart' : 'Checkout temporarily unavailable') + '</button>' +
            '<p class="product-note"><a href="' + escapeHtml(back) + '">Back to ' + escapeHtml(brand || 'the collection') + '</a></p>' +
            '</div></div>';
        bindGallery(mount);
    }

    window.renderFashforgeCatalogue = function(catalogue) {
        if (!catalogue) return;
        renderGrids(catalogue);
        renderTrending(catalogue);
        renderStyles(catalogue);
        renderBrands(catalogue);
        renderProductPage(catalogue);
        document.dispatchEvent(new CustomEvent('fashforge:catalogue', { detail: catalogue }));
    };

    window.lookupFashforgeSellable = function(catalogue, button) {
        if (!catalogue || !button) return null;
        const outfitId = (button.getAttribute('data-outfit-id') || '').trim();
        if (outfitId) {
            const outfits = catalogue.outfits || [];
            for (let i = 0; i < outfits.length; i++) {
                if (outfits[i].id === outfitId) return outfits[i];
            }
        }
        const name = button.dataset.name || '';
        const products = catalogue.products || [];
        for (let j = 0; j < products.length; j++) {
            if (products[j].name === name) return products[j];
        }
        return null;
    };
})();
