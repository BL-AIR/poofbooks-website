/* Poof Books: checkout, looked after by Lil Otter (staff, the Mailroom).
   - Square's Web Payments SDK draws the card fields; we never build or style our own card inputs.
   - SANDBOX ONLY for now: Pay checks the card with Square and stops. The card token is never sent
     anywhere until the payments Worker exists. Public sandbox IDs only (poofbooks-data/square/README.md);
     never put an access token in this file.
   - Lil Otter's words are in normal spelling; his recorded voice carries the lisp.
   - Preview other moments with ?demo=cart | backorder | confirmed | problem. */
(function () {
  'use strict';
  var APP_ID = 'sandbox-sq0idb-7HXAqE7ZD7W34CJAug8Lhg';
  var LOCATION_ID = 'LV05GKTGY70ZC';
  var SHOP_EMAIL = 'BigDaddy@poofbooks.com';

  // Lil Otter's lines. Only the greeting has a recording so far; the others get one later (set audio).
  var OTTER = {
    greeting:  { text: '¡Hola, boss! I am Lil Otter, down here in the Mailroom. My job? I take the book you choose, and I send it straight to your door. Wrapped twice, tied with string… very pretty. So! I need your name and your address for the label, and how you like to pay, ¿vale? Fill in the little boxes, then press the big pink button. Yes, boss! I start wrapping.', audio: '/assets/audio/lil-otter-checkout.mp3' },
    cart:      { text: 'Three books? Yes, boss! Excellent choices. I go and find a nice box.' },
    confirmed: { text: 'Got it! Payment is in. Big Daddy will be very happy. Now I wrap.' },
    backorder: { text: 'Ay, this one is still on the boat. As soon as it lands, I send it. Promise.' },
    problem:   { text: 'Something wrong? Tell me everything. I fix it.' }
  };
  // The same moments in plain words (curators off).
  var PLAIN = {
    greeting:  'Fill in your details and delivery address, then pay. We\'ll email your receipt straight away, and again when your order is on its way.',
    cart:      'Here\'s what\'s in your cart. When you\'re ready, go to checkout.',
    confirmed: 'Thank you: your payment has been received and your order is being prepared.',
    backorder: 'One of your books is on back order with our supplier. We\'ll send it as soon as it arrives.',
    problem:   'Something went wrong. Please check your details, or email us and we\'ll sort it out.'
  };

  // Stock wording is always general: never a quantity.
  var STOCK = { available: 'Available with supplier', back: 'On back order with supplier' };

  // Editions the shop sells today. Later this comes from the catalogue API (prices from edition_price).
  var BOOK = { title: 'The Art of Surrender', author: 'Blair Purvis', cover: '/assets/books/art-of-surrender-print.webp', shelf: 'luminous-literature' };
  var EDITIONS = {
    '9781922263988': { book: BOOK, format: 'Paperback, Short & Thick', price: 39.95, stock: 'available' },
    '9781922263971': { book: BOOK, format: 'Paperback, Long & Skinny', price: 39.95, stock: 'available' },
    '9781922263933': { book: BOOK, format: 'Hardback Special Edition', price: 89.95, stock: 'available' },
    '9781922263964': { book: BOOK, format: 'eBook (EPUB)', price: 15.95, stock: 'available' }
  };
  function line(isbn, qty, stock) {
    var e = EDITIONS[isbn]; if (!e) return null;
    return { book: e.book, format: e.format, isbn: isbn, price: e.price, qty: qty || 1, stock: stock || e.stock, adult: !!e.adult };
  }
  // The reader's own cart (cart.js), skipping anything we no longer sell.
  function realCart() {
    if (!window.PoofCart) return [];
    return PoofCart.items().map(function (i) { return line(i.isbn, Number(i.qty)); }).filter(Boolean);
  }
  // Sample orders for the test-mode preview links.
  var CARTS = {
    single: [ line('9781922263988', 1) ],
    three: [ line('9781922263988', 1), line('9781922263971', 1), line('9781922263933', 1) ],
    backorder: [ line('9781922263988', 1), line('9781922263933', 1, 'back') ]
  };
  var usingRealCart = false;

  var CARD_STYLE = {
    '.input-container': { borderColor: '#4A3D6E', borderRadius: '12px', borderWidth: '1.5px' },
    '.input-container.is-focus': { borderColor: '#FF5FA2' },
    '.input-container.is-error': { borderColor: '#FF6B6B' },
    'input': { backgroundColor: '#18122B', color: '#F4EFE6', fontFamily: 'helvetica neue, sans-serif', fontSize: '16px' },
    'input::placeholder': { color: '#9E93BF' },
    'input.is-error': { color: '#FF6B6B' },
    '.message-text': { color: '#CFC6E8' },
    '.message-icon': { color: '#B9A3FF' },
    '.message-text.is-error': { color: '#FF6B6B' },
    '.message-icon.is-error': { color: '#FF6B6B' }
  };

  var $ = function (s) { return document.querySelector(s); };
  var html = document.documentElement;
  var audio = null;
  var cartTotal = 0;

  function aud(n) { return n.toFixed(2); }
  function money(n) { var s = document.createElement('span'); s.className = 'money'; s.setAttribute('data-aud', aud(n)); s.textContent = 'A$' + aud(n); return s; }

  /* ---------- Lil Otter's voice ---------- */
  function stopVoice() {
    if (audio) { audio.pause(); audio = null; }
    var b = $('[data-otter-play]'); if (b) b.setAttribute('aria-pressed', 'false');
  }
  function say(key) {
    stopVoice();
    var line = OTTER[key];
    $('[data-otter-says]').textContent = line.text;
    $('[data-plain-says]').textContent = PLAIN[key];
    var wrap = $('[data-otter-play-wrap]'), btn = $('[data-otter-play]');
    if (line.audio) { btn.setAttribute('data-audio', line.audio); wrap.hidden = false; }
    else { btn.removeAttribute('data-audio'); wrap.hidden = true; }
  }
  function bindVoice() {
    var btn = $('[data-otter-play]');
    btn.addEventListener('click', function () {
      if (audio) { stopVoice(); return; }                     // press again to stop
      if (!html.classList.contains('sound-on')) return;      // Sound off: text only
      var src = btn.getAttribute('data-audio'); if (!src) return;
      document.querySelectorAll('audio').forEach(function (a) { a.pause(); });
      audio = new Audio(src);
      btn.setAttribute('aria-pressed', 'true');
      audio.addEventListener('ended', stopVoice);
      audio.play().catch(stopVoice);                         // never autoplays: only on this click
    });
    // Stop him if Sound or Curators are switched off while he's talking.
    new MutationObserver(function () {
      if (!html.classList.contains('sound-on') || html.classList.contains('no-curators')) stopVoice();
    }).observe(html, { attributes: true, attributeFilter: ['class'] });
  }

  /* ---------- Order summary ---------- */
  function renderCart(cart) {
    var ul = $('[data-lines]'); ul.innerHTML = '';
    var total = 0, adult = false;
    cart.forEach(function (l) {
      total += l.price * l.qty; if (l.adult) adult = true;
      var li = document.createElement('li'); li.className = 'line';
      var img = document.createElement('img'); img.src = l.book.cover; img.width = 800; img.height = 1200; img.alt = '';
      var t = document.createElement('div'); t.className = 'line-text';
      var b = document.createElement('b'); b.textContent = l.book.title;
      var a = document.createElement('span'); a.textContent = l.book.author;
      var f = document.createElement('span'); f.textContent = l.format + ' · Qty ' + l.qty;
      var st = document.createElement('span'); st.className = 'stock' + (l.stock === 'back' ? ' back' : ''); st.textContent = STOCK[l.stock];
      t.append(b, a, f, st);
      var p = money(l.price * l.qty); p.classList.add('line-price');
      if (usingRealCart) {
        var rm = document.createElement('button'); rm.type = 'button'; rm.className = 'line-remove'; rm.textContent = 'Remove';
        rm.setAttribute('aria-label', 'Remove ' + l.book.title + ', ' + l.format);
        rm.addEventListener('click', function () { PoofCart.remove(l.isbn); location.reload(); });
        t.appendChild(rm);
      }
      li.append(img, t, p); ul.appendChild(li);
    });
    $('[data-books-total]').replaceChildren(money(total));
    $('[data-grand-total]').replaceChildren(money(total));
    cartTotal = total;
    $('[data-pay-total]').textContent = aud(total);        // the Pay button always shows the AUD charge
    $('[data-adult]').hidden = !adult;
    return cart.some(function (l) { return l.stock === 'back'; });
  }

  /* ---------- Moments ---------- */
  function showConfirmed(email, scroll) {
    $('[data-form]').hidden = true;
    var d = $('[data-done]'); d.hidden = false;
    if (email) $('[data-done-email]').textContent = email;
    $('[data-title]').textContent = 'Order received';
    say('confirmed');
    if (scroll) $('[data-title]').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function showProblem(detail) {
    say('problem');
    var box = $('[data-status]'); box.innerHTML = '';
    var p = document.createElement('p'); p.className = 'msg err';
    p.append(document.createTextNode((detail ? detail + ' ' : '') + 'If it keeps happening, email '));
    var a = document.createElement('a'); a.href = 'mailto:' + SHOP_EMAIL; a.textContent = SHOP_EMAIL;
    p.append(a, document.createTextNode('.'));
    box.appendChild(p);
  }
  function plainStatus(text, kind) {
    var box = $('[data-status]'); box.innerHTML = '';
    var p = document.createElement('p'); p.className = 'msg ' + (kind || 'ok'); p.textContent = text; box.appendChild(p);
  }

  function checkFields(form) {
    var first = null;
    form.querySelectorAll('input[required]').forEach(function (el) {
      var v = el.value.trim();
      var bad = !v || (el.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
      el.classList.toggle('is-error', bad);
      el.setAttribute('aria-invalid', bad ? 'true' : 'false');
      if (bad && !first) first = el;
    });
    var adult = $('[data-adult]');
    if (!adult.hidden && !form.adult.checked && !first) first = form.adult;
    if (first) first.focus();
    return !first;
  }

  /* ---------- Express checkout: Apple Pay and Google Pay ----------
     The wallet supplies the buyer's name, email and delivery address, so the form isn't needed.
     Delivery is a placeholder until the shipping rates are in. */
  function walletRequest(payments) {
    var amount = aud(cartTotal);
    var shipping = [{ id: 'standard', label: 'Standard post (rate to come)', amount: '0.00' }];
    var lineItems = [{ label: 'Books', amount: amount }, { label: 'Delivery', amount: '0.00' }];
    var req = payments.paymentRequest({
      countryCode: 'AU', currencyCode: 'AUD',
      total: { amount: amount, label: 'Poof Books' },
      lineItems: lineItems,
      requestBillingContact: true,
      requestShippingContact: true,
      shippingOptions: shipping
    });
    // Later: price delivery for the address chosen in the wallet (by weight and size).
    try {
      req.addEventListener('shippingcontactchanged', function () { return { shippingOptions: shipping, lineItems: lineItems, total: { amount: amount, label: 'Poof Books' } }; });
      req.addEventListener('shippingoptionchanged', function () { return { lineItems: lineItems, total: { amount: amount, label: 'Poof Books' } }; });
    } catch (e) { /* older SDK: fixed delivery for now */ }
    return req;
  }

  function adultOk(form) {
    var adult = $('[data-adult]');
    if (adult.hidden || form.adult.checked) return true;
    form.adult.focus();
    plainStatus('Please tick "I\'m 18 or over" first: your order includes a book from Exquisite Erotica.', 'err');
    return false;
  }

  function walletEmail(details) {
    if (!details) return '';
    var s = details.shipping && details.shipping.contact, b = details.billing;
    return (s && s.email) || (b && b.email) || '';
  }

  function payWithWallet(method, name, form) {
    if (!adultOk(form)) return;
    // tokenize() must be the first thing the click does (Apple Pay rejects anything async before it).
    method.tokenize().then(function (result) {
      if (result.status === 'OK') {
        // Live checkout: send result.token, result.details (address and email) and the cart to the payments Worker.
        $('[data-status]').innerHTML = '';
        if (usingRealCart) PoofCart.clear();
        showConfirmed(walletEmail(result.details), true);
      } else if (result.status !== 'Cancel') {
        console.warn('[Poof checkout] ' + name + ' not completed', result.status, JSON.stringify(result.errors));
        showProblem(name + ' didn\'t go through. You can try again, or pay by card below.');
      }
    }).catch(function (e) {
      console.error('[Poof checkout]', e);
      showProblem(name + ' didn\'t go through. You can try again, or pay by card below.');
    });
  }

  async function startWallets(payments, form) {
    var express = $('[data-express]'), any = false;
    try {
      var applePay = await payments.applePay(walletRequest(payments));   // Safari with Apple Pay set up, on a verified domain
      var ab = $('#apple-pay-button');
      ab.hidden = false; any = true;
      ab.addEventListener('click', function (ev) { ev.preventDefault(); payWithWallet(applePay, 'Apple Pay', form); });
    } catch (e) { /* not available on this device or browser */ }
    try {
      var googlePay = await payments.googlePay(walletRequest(payments));
      var gb = $('#google-pay-button');
      gb.hidden = false;
      await googlePay.attach('#google-pay-button', { buttonColor: 'white', buttonSizeMode: 'fill', buttonType: 'long' });
      any = true;
      gb.addEventListener('click', function (ev) { ev.preventDefault(); payWithWallet(googlePay, 'Google Pay', form); });
    } catch (e) { $('#google-pay-button').hidden = true; }
    express.hidden = !any;
  }

  async function startSquare(form) {
    var btn = $('[data-pay]'), loading = $('[data-card-loading]');
    if (!window.Square) { loading.textContent = 'The card box couldn\'t load. Check your connection and refresh the page.'; return; }
    var card, payments;
    try {
      payments = window.Square.payments(APP_ID, LOCATION_ID);
    } catch (e) {
      console.error('[Poof checkout]', e);
      loading.textContent = 'Payments couldn\'t start. Please refresh the page.';
      return;
    }
    startWallets(payments, form);
    try {
      card = await payments.card({ style: CARD_STYLE });
      await card.attach('#card-container');
      loading.hidden = true; btn.disabled = false;
    } catch (e) {
      console.error('[Poof checkout]', e);
      loading.textContent = 'The card box couldn\'t load. Please refresh the page.';
      return;
    }
    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      if (!checkFields(form)) { plainStatus('Please fill in the highlighted boxes.', 'err'); return; }
      btn.disabled = true;
      plainStatus('Checking your card with Square…', 'ok');
      try {
        var result = await card.tokenize();
        if (result.status === 'OK') {
          // Live checkout: send result.token, the cart and the address to the payments Worker here,
          // and only show the confirmation once the Worker says the payment went through.
          $('[data-status]').innerHTML = '';
          if (usingRealCart) PoofCart.clear();
          showConfirmed(form.email.value.trim(), true);
        } else {
          console.warn('[Poof checkout] card not accepted', result.status, JSON.stringify(result.errors));
          showProblem('Square didn\'t accept that card. Check the number, expiry and security code, or try another card.');
        }
      } catch (e) {
        console.error('[Poof checkout]', e);
        showProblem('We couldn\'t reach Square just now.');
      }
      btn.disabled = false;
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    bindVoice();
    var form = $('[data-form]');
    var demo = new URLSearchParams(location.search).get('demo') || '';
    document.querySelectorAll('.test-band .demo a').forEach(function (a) {
      if ((new URL(a.href)).searchParams.get('demo') === (demo || null)) a.setAttribute('aria-current', 'page');
    });

    if (demo === 'cart') {
      renderCart(CARTS.three);
      $('[data-title]').textContent = 'Your cart';
      form.hidden = true;
      var go = document.createElement('p'); go.innerHTML = '<a class="pay" href="?">Go to checkout</a>';
      $('[data-panel]').appendChild(go);
      say('cart');
      return;
    }
    if (demo === 'confirmed') { renderCart(CARTS.single); showConfirmed(''); return; }

    var mine = demo ? [] : realCart();
    usingRealCart = mine.length > 0;
    if (!usingRealCart && !demo) {
      var note = document.createElement('p'); note.className = 'sum-note sample-note';
      note.textContent = 'Sample order (test mode). Press Buy on a book\'s page to see your own cart here.';
      $('.summary h2').after(note);
    }
    var hasBack = renderCart(usingRealCart ? mine : (demo === 'backorder' ? CARTS.backorder : CARTS.single));
    say(hasBack ? 'backorder' : 'greeting');
    if (demo === 'problem') showProblem('');
    startSquare(form);
  });
})();
