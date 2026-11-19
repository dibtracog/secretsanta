/* Secret Santa theme – shared storefront behaviour (cart, product page, countdown). */
(function () {
  'use strict';

  var theme = window.theme || {};
  var strings = theme.strings || {};
  var routes = theme.routes || { root: '/', cart: '/cart', cartAdd: '/cart/add', cartChange: '/cart/change' };

  /* ---------- Money ---------- */
  function formatMoney(cents, format) {
    if (typeof cents === 'string') cents = cents.replace('.', '');
    format = format || theme.moneyFormat || '{{amount}}';
    var match = format.match(/\{\{\s*(\w+)\s*\}\}/);
    if (!match) return String(cents);

    function withDelimiters(number, precision, thousands, decimal) {
      if (isNaN(number) || number === null) return '0';
      var fixed = (number / 100).toFixed(precision);
      var parts = fixed.split('.');
      var whole = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands);
      return whole + (parts[1] ? decimal + parts[1] : '');
    }

    var value;
    switch (match[1]) {
      case 'amount_no_decimals': value = withDelimiters(cents, 0, ',', '.'); break;
      case 'amount_with_comma_separator': value = withDelimiters(cents, 2, '.', ','); break;
      case 'amount_no_decimals_with_comma_separator': value = withDelimiters(cents, 0, '.', ','); break;
      case 'amount_with_apostrophe_separator': value = withDelimiters(cents, 2, "'", '.'); break;
      default: value = withDelimiters(cents, 2, ',', '.');
    }
    return format.replace(/\{\{\s*\w+\s*\}\}/, value).replace(/<[^>]*>/g, '');
  }

  /* ---------- Toast ---------- */
  var toastTimer;
  function showToast(html) {
    var toast = document.querySelector('[data-toast]');
    if (!toast) return;
    toast.innerHTML = html;
    toast.hidden = false;
    requestAnimationFrame(function () { toast.classList.add('is-visible'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('is-visible');
      setTimeout(function () { toast.hidden = true; }, 300);
    }, 4000);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- Cart ---------- */
  function refreshCartCount() {
    return fetch(routes.cart + '.js', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        document.querySelectorAll('[data-cart-count]').forEach(function (el) {
          el.textContent = cart.item_count;
          el.hidden = cart.item_count === 0;
        });
        return cart;
      });
  }

  function handleAddResponse(response) {
    return response.json().then(function (data) {
      if (!response.ok) {
        throw new Error(data.description || data.message || 'Could not add to cart');
      }
      return data;
    });
  }

  function addedToast(title) {
    showToast(
      '<strong>' + escapeHtml(strings.added || 'Added to your cart') + '</strong>' +
      (title ? '<span>' + escapeHtml(title) + '</span>' : '') +
      '<a href="' + routes.cart + '">' + escapeHtml(strings.viewCart || 'View cart') + '</a>'
    );
  }

  /** Add items to the cart. items: [{ id, quantity, properties }] */
  function addToCart(items) {
    return fetch(routes.cartAdd + '.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: items })
    })
      .then(handleAddResponse)
      .then(function (data) {
        refreshCartCount();
        return data;
      });
  }

  document.addEventListener('submit', function (event) {
    var form = event.target.closest('[data-product-form]');
    if (!form) return;
    event.preventDefault();

    var button = form.querySelector('[type="submit"]');
    var label = button ? button.innerHTML : '';
    if (button) {
      button.disabled = true;
      button.textContent = strings.adding || 'Adding…';
    }

    fetch(routes.cartAdd + '.js', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new FormData(form)
    })
      .then(handleAddResponse)
      .then(function (item) {
        refreshCartCount();
        addedToast(item.product_title || item.title);
      })
      .catch(function (err) { showToast('<strong>' + escapeHtml(err.message) + '</strong>'); })
      .finally(function () {
        if (button) {
          button.disabled = false;
          button.innerHTML = label;
        }
      });
  });

  /* Gift wrap toggle on the cart page */
  document.addEventListener('change', function (event) {
    var toggle = event.target.closest('[data-gift-wrap]');
    if (!toggle) return;
    toggle.disabled = true;
    var id = Number(toggle.getAttribute('data-gift-wrap'));
    var request = toggle.checked
      ? fetch(routes.cartAdd + '.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [{ id: id, quantity: 1 }] })
        })
      : fetch(routes.cartChange + '.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: String(id), quantity: 0 })
        });
    request.finally(function () { window.location.reload(); });
  });

  /* ---------- Product page: variants & gallery ---------- */
  function initProduct(section) {
    var variantsEl = section.querySelector('[data-variants]');
    var variants = variantsEl ? JSON.parse(variantsEl.textContent) : [];
    var idInput = section.querySelector('[data-variant-id]');
    var priceEl = section.querySelector('[data-price]');
    var compareEl = section.querySelector('[data-compare-price]');
    var saveEl = section.querySelector('[data-save-badge]');
    var button = section.querySelector('[data-add-button]');
    var mainImg = section.querySelector('.product-main-img');

    function setMainImage(src, alt) {
      if (!mainImg || !src) return;
      mainImg.removeAttribute('srcset');
      mainImg.src = src;
      if (alt) mainImg.alt = alt;
    }

    section.querySelectorAll('[data-thumb]').forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        section.querySelectorAll('[data-thumb]').forEach(function (t) { t.classList.remove('is-active'); });
        thumb.classList.add('is-active');
        setMainImage(thumb.getAttribute('data-thumb'), thumb.getAttribute('data-alt'));
      });
    });

    var optionInputs = section.querySelectorAll('[data-option-index]');
    if (!optionInputs.length || !variants.length) return;

    function selectedOptions() {
      var values = [];
      optionInputs.forEach(function (input) {
        if (input.checked) values[Number(input.getAttribute('data-option-index'))] = input.value;
      });
      return values;
    }

    function update() {
      var options = selectedOptions();
      var variant = variants.find(function (v) {
        return v.options.every(function (opt, i) { return opt === options[i]; });
      });

      if (!variant) {
        if (button) {
          button.disabled = true;
          button.textContent = strings.unavailable || 'Unavailable';
        }
        return;
      }

      if (idInput) idInput.value = variant.id;
      if (priceEl) priceEl.textContent = formatMoney(variant.price);
      var onSale = variant.compare_at_price && variant.compare_at_price > variant.price;
      if (compareEl) {
        compareEl.hidden = !onSale;
        if (onSale) compareEl.textContent = formatMoney(variant.compare_at_price);
      }
      if (saveEl) {
        saveEl.hidden = !onSale;
        if (onSale) {
          var pct = Math.round(((variant.compare_at_price - variant.price) * 100) / variant.compare_at_price);
          saveEl.textContent = saveEl.getAttribute('data-template').replace('__PCT__', pct);
        }
      }
      if (button) {
        button.disabled = !variant.available;
        button.textContent = variant.available ? strings.addToCart || 'Add to cart' : strings.soldOut || 'Sold out';
      }
      if (variant.featured_image) setMainImage(variant.featured_image.src, variant.featured_image.alt);

      var url = new URL(window.location.href);
      url.searchParams.set('variant', variant.id);
      window.history.replaceState({}, '', url.toString());
    }

    optionInputs.forEach(function (input) { input.addEventListener('change', update); });
  }

  /* ---------- Countdown ---------- */
  function initCountdown(el) {
    var target = new Date(el.getAttribute('data-countdown')).getTime();
    if (isNaN(target)) {
      el.hidden = true;
      return;
    }
    var parts = {
      days: el.querySelector('[data-days]'),
      hours: el.querySelector('[data-hours]'),
      minutes: el.querySelector('[data-minutes]'),
      seconds: el.querySelector('[data-seconds]')
    };
    var done = el.querySelector('[data-countdown-done]');
    var grid = el.querySelector('[data-countdown-grid]');

    function pad(n) { return n < 10 ? '0' + n : String(n); }

    function tick() {
      var diff = Math.floor((target - Date.now()) / 1000);
      if (diff <= 0) {
        if (grid) grid.hidden = true;
        if (done) done.hidden = false;
        clearInterval(timer);
        return;
      }
      parts.days.textContent = Math.floor(diff / 86400);
      parts.hours.textContent = pad(Math.floor((diff % 86400) / 3600));
      parts.minutes.textContent = pad(Math.floor((diff % 3600) / 60));
      parts.seconds.textContent = pad(diff % 60);
    }

    var timer = setInterval(tick, 1000);
    tick();
  }

  /* ---------- Boot ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-product-section]').forEach(initProduct);
    document.querySelectorAll('[data-countdown]').forEach(initCountdown);
  });

  window.SecretSantaTheme = {
    formatMoney: formatMoney,
    addToCart: addToCart,
    addedToast: addedToast,
    showToast: showToast,
    escapeHtml: escapeHtml,
    refreshCartCount: refreshCartCount
  };
})();
