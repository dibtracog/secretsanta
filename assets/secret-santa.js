/* Secret Santa matchmaker – runs entirely in the browser on the store's own products.
 *
 * How products are matched: tag products in Shopify admin with
 *   vibe-<archetype>   e.g. vibe-mischief, vibe-cuddle (see ARCHETYPES below)
 *   gift-<use>         gift-desk, gift-bedtime, gift-keepsake, gift-nostalgia
 *   christmas          small festive bonus
 * Untagged products still appear, ranked by budget fit.
 */
(function () {
  'use strict';

  var ARCHETYPES = {
    mischief: { label: 'Mischief Maker', emoji: '😈', caption: 'Probably the reason everyone needs a little extra patience.', pick: 'a partner-in-crime for their next prank' },
    cuddle: { label: 'Cuddle Lover', emoji: '🤗', caption: 'Soft-hearted, affectionate and always spreading warmth.', pick: 'made for big, warm hugs' },
    adventure: { label: 'Adventure Seeker', emoji: '🧭', caption: 'Always ready for the next spontaneous plan.', pick: 'brave enough to tag along on every adventure' },
    sunshine: { label: 'Sunshine Personality', emoji: '☀️', caption: 'Lights up every room with contagious positivity.', pick: 'every bit as cheerful as they are' },
    sleepy: { label: 'Cozy Sleepyhead', emoji: '😴', caption: 'Firmly believes every afternoon deserves a power nap.', pick: 'the perfect nap companion' },
    social: { label: 'Social Butterfly', emoji: '🦋', caption: 'Knows everyone and never misses a celebration.', pick: 'guaranteed to start a conversation' },
    dreamer: { label: 'The Dreamer', emoji: '✨', caption: 'Lives half in reality, half in a pastel wonderland.', pick: 'straight out of a daydream' },
    perfectionist: { label: 'The Perfectionist', emoji: '📋', caption: 'Colour-coded calendars, zero chaos tolerated.', pick: 'neat, tidy and desk-ready' },
    foodie: { label: 'Certified Foodie', emoji: '🍓', caption: 'Mood instantly improves the moment snacks arrive.', pick: 'sweet enough to snack on (please don’t)' },
    drama: { label: 'Drama Magnet', emoji: '🎭', caption: 'Every coffee run somehow turns into a plot twist.', pick: 'full of personality, just like them' }
  };

  var USES = {
    desk: { label: 'desk buddy', boost: 'sunshine' },
    bedtime: { label: 'bedtime hug', boost: 'sleepy' },
    keepsake: { label: 'festive keepsake', boost: 'dreamer' },
    nostalgia: { label: 'nostalgic throwback', boost: 'mischief' }
  };

  var RELATIONSHIP_BOOST = { Partner: 'cuddle', Colleague: 'perfectionist', Boss: 'perfectionist', Sibling: 'mischief', Friend: 'social' };

  var CARD_LABELS = ['Best match', 'Also a great fit', 'Wildcard pick'];

  function init(root) {
    var T = window.SecretSantaTheme;
    var esc = T ? T.escapeHtml : function (s) { return String(s); };
    var products = JSON.parse(root.querySelector('[data-ss-products]').textContent || '[]');
    var config = JSON.parse(root.querySelector('[data-ss-config]').textContent || '{}');
    var budgets = config.budgets || [];

    var form = root.querySelector('[data-ss-form]');
    var steps = Array.prototype.slice.call(root.querySelectorAll('[data-ss-step]'));
    var progressBar = root.querySelector('[data-ss-progress]');
    var stepCount = root.querySelector('[data-ss-step-count]');
    var backBtn = root.querySelector('[data-ss-back]');
    var nextBtn = root.querySelector('[data-ss-next]');
    var quizPanel = root.querySelector('[data-ss-quiz]');
    var results = root.querySelector('[data-ss-results]');
    var current = 0;
    var state = null;

    /* ---------- Step navigation ---------- */
    function stepIsValid(step) {
      var min = Number(step.getAttribute('data-min') || 0);
      if (min) return step.querySelectorAll('input[type="checkbox"]:checked').length >= min;
      var radios = step.querySelectorAll('input[type="radio"][required]');
      if (radios.length) return Array.prototype.some.call(radios, function (r) { return r.checked; });
      return true;
    }

    function render() {
      steps.forEach(function (step, i) {
        step.hidden = i !== current;
        step.classList.toggle('is-active', i === current);
      });
      var isLast = current === steps.length - 1;
      backBtn.hidden = current === 0;
      nextBtn.textContent = isLast ? nextBtn.getAttribute('data-finish-label') : nextBtn.getAttribute('data-next-label');
      nextBtn.disabled = !stepIsValid(steps[current]);
      progressBar.style.width = ((current + 1) / steps.length) * 100 + '%';
      stepCount.textContent = 'Step ' + (current + 1) + ' of ' + steps.length;
    }

    function go(index) {
      current = Math.max(0, Math.min(steps.length - 1, index));
      render();
      var legend = steps[current].querySelector('legend');
      if (legend) legend.focus({ preventScroll: true });
    }

    backBtn.addEventListener('click', function () { go(current - 1); });

    nextBtn.addEventListener('click', function () {
      if (!stepIsValid(steps[current])) return;
      if (current === steps.length - 1) finish();
      else go(current + 1);
    });

    form.addEventListener('change', function (event) {
      var step = steps[current];
      var input = event.target;
      var max = Number(step.getAttribute('data-max') || 0);
      if (max && input.type === 'checkbox' && input.checked) {
        if (step.querySelectorAll('input[type="checkbox"]:checked').length > max) {
          input.checked = false;
          step.classList.remove('shake');
          void step.offsetWidth;
          step.classList.add('shake');
        }
      }
      nextBtn.disabled = !stepIsValid(step);
      if (input.type === 'radio' && step.hasAttribute('data-autoadvance') && current < steps.length - 1) {
        setTimeout(function () { go(current + 1); }, 280);
      }
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      nextBtn.click();
    });

    /* ---------- Personality scoring ---------- */
    function readAnswers() {
      var data = new FormData(form);
      return {
        name: (data.get('name') || '').toString().trim().slice(0, 40),
        relationship: (data.get('relationship') || 'Friend').toString(),
        traits: data.getAll('traits').map(String),
        scene: (data.get('scene') || '').toString(),
        use: (data.get('use') || '').toString(),
        budget: Number(data.get('budget') || 0)
      };
    }

    function scoreArchetypes(answers) {
      var scores = {};
      Object.keys(ARCHETYPES).forEach(function (k) { scores[k] = 0; });
      answers.traits.forEach(function (value) {
        value.split(',').forEach(function (k) { if (k in scores) scores[k] += 3; });
      });
      if (answers.scene in scores) scores[answers.scene] += 2;
      if (USES[answers.use]) scores[USES[answers.use].boost] += 1;
      var rel = RELATIONSHIP_BOOST[answers.relationship];
      if (rel) scores[rel] += 0.5;
      return scores;
    }

    function topTraits(scores, name) {
      var seed = (name || '').length;
      var ranked = Object.keys(scores)
        .sort(function (a, b) { return scores[b] - scores[a]; })
        .slice(0, 3);
      var best = scores[ranked[0]] || 1;
      return ranked.map(function (key, i) {
        var pct = Math.round(66 + (scores[key] / best) * 26 + ((seed + i * 3) % 6)) - i * 4;
        if (i === 0) pct = Math.max(pct, 90);
        return { key: key, pct: Math.max(55, Math.min(98, pct)), info: ARCHETYPES[key] };
      });
    }

    /* ---------- Product matching ---------- */
    function productVibes(product) {
      return product.tags
        .filter(function (t) { return t.toLowerCase().indexOf('vibe-') === 0; })
        .map(function (t) { return t.toLowerCase().slice(5); });
    }

    function scoreProduct(product, scores, use) {
      var tags = product.tags.map(function (t) { return t.toLowerCase(); });
      var s = 0;
      productVibes(product).forEach(function (v) { s += (scores[v] || 0) * 10; });
      if (use && tags.indexOf('gift-' + use) !== -1) s += 14;
      if (tags.indexOf('christmas') !== -1) s += 3;
      return s;
    }

    function rankProducts(budgetIndex) {
      var band = budgets[budgetIndex] || { min: 0, max: Infinity };
      var max = band.max === null ? Infinity : band.max;
      var list = products
        .filter(function (p) { return p.available; })
        .map(function (p) {
          return {
            product: p,
            score: scoreProduct(p, state.scores, state.answers.use),
            inBudget: p.price >= band.min && p.price <= max,
            distance: p.price < band.min ? band.min - p.price : p.price > max ? p.price - max : 0
          };
        });

      var anyInBudget = list.some(function (c) { return c.inBudget; });
      // Nothing fits: blend personality score with how close the price is to the budget.
      // `distance` is in cents, so every 2 currency units away costs one point.
      list.forEach(function (c) { c.rank = anyInBudget ? c.score : c.score - c.distance / 200; });
      list.sort(function (a, b) {
        if (anyInBudget && a.inBudget !== b.inBudget) return a.inBudget ? -1 : 1;
        return b.rank - a.rank || a.product.price - b.product.price;
      });
      return { list: list, anyInBudget: anyInBudget };
    }

    function reasonFor(product, use) {
      var vibes = productVibes(product);
      var shared = state.traits.filter(function (t) { return vibes.indexOf(t.key) !== -1; });
      if (shared.length) {
        return 'Picked for their ' + shared[0].info.label + ' side: ' + shared[0].info.pick + '.';
      }
      if (USES[use]) return 'A sweet all-rounder that makes a lovely ' + USES[use].label + '.';
      return 'A crowd-pleaser that suits almost every Secret Santa.';
    }

    /* ---------- Rendering results ---------- */
    function renderTraits() {
      var t = state.traits;
      var who = state.answers.name ? esc(state.answers.name) : 'Your Secret Santa';
      root.querySelector('[data-ss-headline]').innerHTML =
        who + ' is ' + t[0].pct + '% ' + esc(t[0].info.label) + '!';
      root.querySelector('[data-ss-subline]').textContent =
        'With a healthy ' + t[1].pct + '% ' + t[1].info.label + ' and ' + t[2].pct + '% ' + t[2].info.label +
        '. We think we’ve found their plush twin.';
      root.querySelector('[data-ss-traits]').innerHTML = t
        .map(function (trait) {
          return (
            '<div class="ss-trait">' +
              '<div class="ss-trait-top"><span class="ss-trait-emoji" aria-hidden="true">' + trait.info.emoji + '</span>' +
              '<span class="ss-trait-pct">' + trait.pct + '%</span></div>' +
              '<h4>' + esc(trait.info.label) + '</h4>' +
              '<p>' + esc(trait.info.caption) + '</p>' +
              '<div class="ss-meter"><span style="width:' + trait.pct + '%"></span></div>' +
            '</div>'
          );
        })
        .join('');
    }

    function renderBudgetSwitch() {
      root.querySelector('[data-ss-budget-switch]').innerHTML = budgets
        .map(function (b, i) {
          return '<button type="button" class="chip' + (i === state.budget ? ' is-active' : '') +
            '" data-budget-index="' + i + '" aria-pressed="' + (i === state.budget) + '">' + esc(b.label) + '</button>';
        })
        .join('');
    }

    function renderMatches() {
      var ranked = rankProducts(state.budget);
      state.ranked = ranked.list;
      var note = root.querySelector('[data-ss-budget-note]');
      note.hidden = ranked.anyInBudget || !ranked.list.length;

      var container = root.querySelector('[data-ss-matches]');
      if (!ranked.list.length) {
        container.innerHTML = '<p class="ss-empty">Add some products to your store and they’ll show up here as matches.</p>';
        return;
      }

      var count = Math.min(3, ranked.list.length);
      var bestScore = ranked.list[0].score || 1;
      var picks = [];
      for (var i = 0; i < count; i++) {
        picks.push(ranked.list[(state.offset + i) % ranked.list.length]);
      }
      state.picks = picks;

      container.innerHTML = picks
        .map(function (c, i) {
          var p = c.product;
          var pct = Math.max(62, Math.min(99, Math.round(70 + (27 * c.score) / Math.max(bestScore, 1)) - i * 2));
          c.pct = pct;
          var img = p.image
            ? '<img src="' + esc(p.image) + '" alt="' + esc(p.title) + '" loading="lazy" width="600" height="600">'
            : '<div class="ss-match-noimg" aria-hidden="true">🎁</div>';
          var compare = p.compare > p.price ? ' <s>' + esc(p.compareLabel) + '</s>' : '';
          return (
            '<article class="ss-match' + (i === 0 ? ' is-best' : '') + '">' +
              '<header class="ss-match-head"><span>' + CARD_LABELS[i] + '</span><span>' + pct + '% match</span></header>' +
              '<a href="' + esc(p.url) + '" class="ss-match-img">' + img + '</a>' +
              '<div class="ss-match-body">' +
                '<h4><a href="' + esc(p.url) + '">' + esc(p.title) + '</a></h4>' +
                '<p class="price">' + esc(p.priceLabel) + compare + (c.inBudget ? '' : ' <span class="ss-tag">Outside budget</span>') + '</p>' +
                '<p class="ss-reason">' + esc(reasonFor(p, state.answers.use)) + '</p>' +
                '<div class="ss-match-actions">' +
                  '<button type="button" class="button" data-ss-add="' + p.id + '">Add to cart</button>' +
                  '<a class="button button-ghost" href="' + esc(p.url) + '">Details</a>' +
                '</div>' +
              '</div>' +
            '</article>'
          );
        })
        .join('');
    }

    function renderAll() {
      renderTraits();
      renderBudgetSwitch();
      renderMatches();
      var share = root.querySelector('[data-ss-whatsapp]');
      if (share) {
        var t = state.traits;
        var text =
          'I just decoded my Secret Santa! 🎅\nApparently they’re ' + t[0].pct + '% ' + t[0].info.label + ', ' +
          t[1].pct + '% ' + t[1].info.label + ' and ' + t[2].pct + '% ' + t[2].info.label +
          '.\nFind your Secret Santa’s plush twin: ' + window.location.origin + window.location.pathname;
        share.href = 'https://wa.me/?text=' + encodeURIComponent(text);
      }
    }

    function finish() {
      var answers = readAnswers();
      var budgetIndex = budgets.findIndex(function (b) { return b.id === answers.budget; });
      var scores = scoreArchetypes(answers);
      state = {
        answers: answers,
        scores: scores,
        traits: topTraits(scores, answers.name),
        budget: budgetIndex === -1 ? 0 : budgetIndex,
        offset: 0
      };
      renderAll();
      quizPanel.hidden = true;
      results.hidden = false;
      results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /* ---------- Result actions ---------- */
    results.addEventListener('click', function (event) {
      var budgetBtn = event.target.closest('[data-budget-index]');
      if (budgetBtn) {
        state.budget = Number(budgetBtn.getAttribute('data-budget-index'));
        state.offset = 0;
        renderBudgetSwitch();
        renderMatches();
        return;
      }

      if (event.target.closest('[data-ss-another]')) {
        if (state.ranked && state.ranked.length > 3) {
          state.offset = (state.offset + 3) % state.ranked.length;
          renderMatches();
        }
        return;
      }

      var addBtn = event.target.closest('[data-ss-add]');
      if (addBtn && T) {
        var id = Number(addBtn.getAttribute('data-ss-add'));
        var label = addBtn.textContent;
        addBtn.disabled = true;
        addBtn.textContent = 'Adding…';
        var who = state.answers.name || state.answers.relationship;
        T.addToCart([{ id: id, quantity: 1, properties: { 'Secret Santa for': who } }])
          .then(function (data) {
            var item = data.items && data.items[0];
            T.addedToast(item ? item.product_title : '');
          })
          .catch(function (err) { T.showToast('<strong>' + esc(err.message) + '</strong>'); })
          .finally(function () {
            addBtn.disabled = false;
            addBtn.textContent = label;
          });
        return;
      }

      if (event.target.closest('[data-ss-card]')) {
        downloadCard();
        return;
      }

      if (event.target.closest('[data-ss-restart]')) {
        form.reset();
        state = null;
        results.hidden = true;
        quizPanel.hidden = false;
        go(0);
        quizPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    /* ---------- Shareable card (canvas) ---------- */
    function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
      var words = text.split(' ');
      var line = '';
      words.forEach(function (word) {
        var test = line ? line + ' ' + word : word;
        if (ctx.measureText(test).width > maxWidth && line) {
          ctx.fillText(line, x, y);
          line = word;
          y += lineHeight;
        } else {
          line = test;
        }
      });
      ctx.fillText(line, x, y);
      return y + lineHeight;
    }

    function drawCard(image) {
      var css = getComputedStyle(document.documentElement);
      var red = css.getPropertyValue('--color-primary').trim() || '#b91c1c';
      var green = css.getPropertyValue('--color-secondary').trim() || '#14532d';
      var gold = css.getPropertyValue('--color-gold').trim() || '#fbbf24';

      var canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1350;
      var ctx = canvas.getContext('2d');

      var grad = ctx.createLinearGradient(0, 0, 1080, 1350);
      grad.addColorStop(0, red);
      grad.addColorStop(1, green);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1080, 1350);

      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      for (var i = 0; i < 40; i++) {
        ctx.beginPath();
        ctx.arc((i * 263) % 1080, (i * 431) % 1350, 4 + (i % 5) * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = gold;
      ctx.font = '700 40px Fraunces, Georgia, serif';
      ctx.fillText('MY SECRET SANTA IS…', 540, 120);

      var t = state.traits;
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 72px Fraunces, Georgia, serif';
      ctx.fillText(t[0].pct + '% ' + t[0].info.label, 540, 215);
      ctx.font = '600 44px Nunito, sans-serif';
      ctx.fillText(t[1].pct + '% ' + t[1].info.label + '  ·  ' + t[2].pct + '% ' + t[2].info.label, 540, 285);

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(190, 340, 700, 700, 40);
      else ctx.rect(190, 340, 700, 700);
      ctx.fill();
      if (image) {
        ctx.save();
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(215, 365, 650, 650, 28);
        else ctx.rect(215, 365, 650, 650);
        ctx.clip();
        ctx.drawImage(image, 215, 365, 650, 650);
        ctx.restore();
      } else {
        ctx.font = '240px sans-serif';
        ctx.fillText('🎁', 540, 780);
      }

      var pick = state.picks && state.picks[0];
      ctx.fillStyle = gold;
      ctx.font = '700 36px Fraunces, Georgia, serif';
      ctx.fillText('THEIR PLUSH TWIN', 540, 1110);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 52px Fraunces, Georgia, serif';
      wrapText(ctx, pick ? pick.product.title : 'A cuddly surprise', 540, 1175, 900, 60);

      ctx.font = '600 30px Nunito, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(config.shopName || '', 540, 1305);

      return canvas;
    }

    function saveCanvas(canvas) {
      try {
        var link = document.createElement('a');
        link.download = 'my-secret-santa.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        return true;
      } catch (e) {
        return false;
      }
    }

    function downloadCard() {
      var pick = state.picks && state.picks[0];
      if (!pick || !pick.product.image) {
        saveCanvas(drawCard(null));
        return;
      }
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        if (!saveCanvas(drawCard(img))) saveCanvas(drawCard(null));
      };
      img.onerror = function () { saveCanvas(drawCard(null)); };
      img.src = pick.product.image;
    }

    render();
  }

  function boot() {
    document.querySelectorAll('[data-ss-root]').forEach(init);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
