/* Poof Books: checkout, looked after by Lil Otter (staff, the Mailroom).
   - Stripe (since 5 Nov 2026, replacing Square): Elements on the Checkout Sessions API. Our page keeps the cart,
     details, address and delivery; Stripe draws only the payment box and the currency selector (Adaptive Pricing:
     cross-border customers can pay in their own currency, with the amount shown before they pay).
   - Flow: "Continue to payment" -> the payments Worker prices everything and opens a Checkout Session -> the Payment
     Element appears -> "Pay" confirms with Stripe -> Stripe returns to /checkout/thanks/?session_id=...
   - Only the PUBLISHABLE key lives here (pk_...). Never put a secret key in this file.
   - Lil Otter's words are in normal spelling; his recorded voice carries the lisp.
   - Preview other moments with ?demo=cart | backorder | confirmed | problem. */
(function () {
  'use strict';
  // Stripe publishable key (public by design). pk_test_... in the sandbox, pk_live_... at go-live.
  var STRIPE_PK = 'pk_test_51UIp5DRarfJlhaAL3wOkVFjL3Cd2lmOoTr8H1gYJaATLA7Tygil51E0kYsiKVPCP0aFh2MKnGhzCEae42VOsjN7z003UUDAMY2';
  var SESSION_URL = 'https://poofbooks-pay.big--daddy.workers.dev/v1/stripe/session';
  var SHOP_EMAIL = 'BigDaddy@poofbooks.com';
  // Payments Worker: prices the cart itself, charges Square, saves the order and sends Lil Otter's receipt.
  var PAY_URL = 'https://poofbooks-pay.big--daddy.workers.dev/v1/checkout';
  // Delivery options for the cart and address: priced by the same Worker (Australia Post for books we post ourselves,
  // A$0 for supplier drop-ships until their rates are in). The Worker prices delivery again when it charges.
  var SHIP_URL = 'https://poofbooks-pay.big--daddy.workers.dev/v1/shipping';
  // Address lookup: Google Places (New). A browser key, public by design: Google only accepts it from poofbooks.com
  // and only for Maps JavaScript + Places (New); daily caps and an A$1 budget alert are set in Google Cloud (project
  // poof-books, 2 Nov 2026). Loaded only when the customer starts typing an address.
  var PLACES_KEY = 'AIzaSyC9ze8f8niiOvE_0XzcYp-MQPFEPgURlFs';

  // Lil Otter's lines. Each with `audio` has an approved recording (eleven_v3); the words match it.
  var OTTER = {
    greeting:  { text: '¡Hola, boss! I am Lil Otter, down here in the Mailroom. My job? I take the book you choose, and I send it straight to your door. Wrapped twice, tied with string… very pretty. So! I need your name and your address for the label, and how you like to pay, ¿vale? Fill in the little boxes, then press the big pink button. Yes, boss! I start wrapping.', audio: '/assets/audio/lil-otter-checkout.mp3' },
    cart_one:   { text: 'One book? Excellent choice, boss! I go and find a nice box.', audio: '/assets/audio/lil-otter-cart-one.mp3' },
    cart_many:  { text: 'So many books! Excellent choices, boss. I go and find a bigger box.', audio: '/assets/audio/lil-otter-cart-many.mp3' },
    cart_gifts: { text: 'You want so many? Must be gifts. I find a ribbon.', audio: '/assets/audio/lil-otter-cart-gifts.mp3' },
    confirmed: { text: 'Got it, boss! Your payment is in, and Big Daddy is very very happy. Now I wrap.', audio: '/assets/audio/lil-otter-confirmed.mp3' },
    backorder: { text: '¡Hola, boss! Good news, and a little bit of waiting news. One of your books is still on the boat from the publisher. The moment it lands, I wrap it twice and send it to you. Promise. So, fill in the little boxes and press the big pink button. Yes, boss!', audio: '/assets/audio/lil-otter-backorder.mp3' },
    problem:   { text: 'Ay, boss! Something go clunk, but do not worry, nothing is charged. Check the card number, the date and the little code on the back, or try another card. Still no good? Write to me, I fix it.', audio: '/assets/audio/lil-otter-problem.mp3' },
    empty:     { text: 'You! There is nothing in your box, boss. You only came down here to admire my hairy chest, no? Go, go! Back up to the shelves and pick a book. ¡Vamos, vamos! Vamoose!', audio: '/assets/audio/lil-otter-empty.mp3' }
  };
  // The same moments in plain words (curators off).
  var PLAIN = {
    greeting:  'Fill in your details and delivery address, then pay. We\'ll email your receipt straight away, and again when your order is on its way.',
    cart_one:   'Here\'s what\'s in your cart. When you\'re ready, go to checkout.',
    cart_many:  'Here\'s what\'s in your cart. When you\'re ready, go to checkout.',
    cart_gifts: 'Here\'s what\'s in your cart. When you\'re ready, go to checkout.',
    confirmed: 'Thank you: your payment has been received and your order is being prepared.',
    backorder: 'One of your books is on back order with our supplier. We\'ll send it as soon as it arrives.',
    problem:   'Something went wrong. Please check your details, or email us and we\'ll sort it out.',
    empty:     'Your cart is empty. Browse the shelves and press Buy beside a format to add a book.'
  };

  // Stock wording is always general: never a quantity.
  var STOCK = { available: 'Available with supplier', back: 'On back order with supplier' };

  // Editions the shop sells today. Later this comes from the catalogue API (prices from edition_price).
  var BOOK = { title: 'The Art of Surrender', author: 'Blair Purvis', cover: '/assets/books/art-of-surrender-print.webp', shelf: 'luminous-literature' };
  var EDITIONS = {
    '9781922263988': { book: BOOK, format: 'Paperback, Short & Thick', price: 39.95, stock: 'available' },
    '9781922263971': { book: BOOK, format: 'Paperback, Long & Skinny', price: 39.95, stock: 'available' },
    '9781922263933': { book: BOOK, format: 'Hardback Special Edition', price: 89.95, stock: 'available' }
  };
  // Every other edition we can sell comes from the site build (assets/data/sellable.json, 31 Oct 2026): books Ingram can
  // supply. s = 'available' or 'back' (Ingram has it on back order: Lil Otter's 'still on the boat').
  var SELL = {};
  var NO_COVER = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="#2A2140"/></svg>');
  function fromSell(isbn) {
    var s = SELL[isbn]; if (!s) return null;
    return { book: { title: s.t, author: s.a || '', cover: s.c || NO_COVER, shelf: '' }, format: s.f, price: s.p, stock: s.s === 'back' ? 'back' : 'available', adult: !!s.x };
  }
  function line(isbn, qty, stock) {
    var e = EDITIONS[isbn] || fromSell(isbn); if (!e) return null;
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
  var currentCart = [];
  // Delivery: the options the Worker last gave for this cart and address, and the customer's choice.
  var ship = { options: [], choice: 'standard', key: '', needPostcode: false, error: '', pending: null };
  function shipCents() {
    var o = ship.options.filter(function (x) { return x.id === ship.choice; })[0] || ship.options[0];
    return o ? o.cents : null;
  }
  function shipOption() { return ship.options.filter(function (x) { return x.id === ship.choice; })[0] || ship.options[0] || null; }

  function aud(n) { return n.toFixed(2); }
  // Always Australian dollars here (no data-aud, so the header's currency guide leaves it alone): the order box shows what
  // we charge; Stripe offers the customer's own currency at payment.
  function money(n) { var s = document.createElement('span'); s.className = 'money'; s.textContent = 'A$' + aud(n); return s; }

  /* ---------- Lil Otter's voice ---------- */
  function stopVoice() {
    if (audio) { audio.pause(); audio = null; }
    var b = $('[data-otter-play]'); if (b) b.setAttribute('aria-pressed', 'false');
  }
  // Which cart line fits: several copies of any one book → gifts; several different books → bigger box; else one book.
  function cartKey(cart) {
    if (cart.some(function (l) { return l.qty > 1; })) return 'cart_gifts';
    return cart.length > 1 ? 'cart_many' : 'cart_one';
  }
  // Lil Otter says one moment, optionally led by his reaction to the cart (leadKey, e.g. 'cart_gifts').
  // Both lines show in his speech box; one press of the play button plays them back to back.
  function say(key, leadKey) {
    stopVoice();
    var lines = [leadKey && OTTER[leadKey], OTTER[key]].filter(Boolean);
    var box = $('[data-otter-says]'); box.textContent = '';
    lines.forEach(function (l, i) {
      if (lines.length === 1) { box.textContent = l.text; return; }
      var p = document.createElement('span'); p.className = 'say-line'; p.textContent = l.text;
      if (i) box.appendChild(document.createElement('br')), box.appendChild(document.createElement('br'));
      box.appendChild(p);
    });
    $('[data-plain-says]').textContent = PLAIN[key];          // plain wording: the moment only, no cart chatter
    var srcs = lines.map(function (l) { return l.audio; }).filter(Boolean);
    var wrap = $('[data-otter-play-wrap]'), btn = $('[data-otter-play]');
    if (srcs.length) { btn.setAttribute('data-audio', srcs.join('|')); wrap.hidden = false; }
    else { btn.removeAttribute('data-audio'); wrap.hidden = true; }
  }
  function bindVoice() {
    var btn = $('[data-otter-play]');
    btn.addEventListener('click', function () {
      if (audio) { stopVoice(); return; }                     // press again to stop
      if (!html.classList.contains('sound-on')) return;      // Sound off: text only
      var list = (btn.getAttribute('data-audio') || '').split('|').filter(Boolean); if (!list.length) return;
      document.querySelectorAll('audio').forEach(function (a) { a.pause(); });
      btn.setAttribute('aria-pressed', 'true');
      (function playFrom(i) {                                 // never autoplays: only on this click
        audio = new Audio(list[i]);
        audio.addEventListener('ended', function () { if (i + 1 < list.length && audio) playFrom(i + 1); else stopVoice(); });
        audio.play().catch(stopVoice);
      })(0);
    });
    // Stop him if Sound or Curators are switched off while he's talking.
    new MutationObserver(function () {
      if (!html.classList.contains('sound-on') || html.classList.contains('no-curators')) stopVoice();
    }).observe(html, { attributes: true, attributeFilter: ['class'] });
  }

  /* ---------- Order summary ---------- */
  var MAX_QTY = 10;                                          // the payments Worker accepts up to 10 of one edition
  var walletRequests = [];                                   // Apple Pay / Google Pay requests, updated when the cart changes
  // Redraw after a quantity change or removal, without reloading (the customer's typed details stay put).
  function refreshCart() {
    var mine = realCart();
    if (!mine.length) { showEmpty(); return; }
    var hasBack = renderCart(mine);
    say(hasBack ? 'backorder' : 'greeting', cartKey(mine));
    var form = $('[data-form]'); if (form) quoteDelivery(formAddr(form));
  }
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
      var f = document.createElement('span'); f.textContent = usingRealCart ? l.format : l.format + ' · Qty ' + l.qty;
      var st = document.createElement('span'); st.className = 'stock' + (l.stock === 'back' ? ' back' : ''); st.textContent = STOCK[l.stock];
      t.append(b, a, f, st);
      var p = money(l.price * l.qty); p.classList.add('line-price');
      if (usingRealCart) {
        // Quantity stepper (1 to MAX_QTY) and Remove. Changes redraw the order in place, so typed details stay.
        var q = document.createElement('div'); q.className = 'qty';
        var minus = document.createElement('button'); minus.type = 'button'; minus.className = 'qty-btn'; minus.textContent = '−';
        minus.setAttribute('aria-label', 'One fewer: ' + l.book.title + ', ' + l.format);
        var n = document.createElement('output'); n.className = 'qty-n'; n.textContent = l.qty;
        n.setAttribute('aria-label', 'Quantity ' + l.qty);
        var plus = document.createElement('button'); plus.type = 'button'; plus.className = 'qty-btn'; plus.textContent = '+';
        plus.setAttribute('aria-label', 'One more: ' + l.book.title + ', ' + l.format);
        minus.disabled = l.qty <= 1; plus.disabled = l.qty >= MAX_QTY;
        minus.addEventListener('click', function () { PoofCart.setQty(l.isbn, l.qty - 1); refreshCart(); });
        plus.addEventListener('click', function () { PoofCart.setQty(l.isbn, l.qty + 1); refreshCart(); });
        var rm = document.createElement('button'); rm.type = 'button'; rm.className = 'line-remove'; rm.textContent = 'Remove';
        rm.setAttribute('aria-label', 'Remove ' + l.book.title + ', ' + l.format);
        rm.addEventListener('click', function () { PoofCart.remove(l.isbn); refreshCart(); });
        q.append(minus, n, plus, rm);
        t.appendChild(q);
      }
      li.append(img, t, p); ul.appendChild(li);
    });
    $('[data-books-total]').replaceChildren(money(total));
    cartTotal = total;
    currentCart = cart;
    showTotals();
    $('[data-adult]').hidden = !adult;
    return cart.some(function (l) { return l.stock === 'back'; });
  }

  /* ---------- Address lookup (Google Places) ----------
     Type in Address → pick a suggestion → street, suburb, state, postcode and country fill in.
     Typing by hand always still works; nothing is sent to Google until three characters are typed. */
  var places = null, placesLoading = null;
  function loadPlaces() {
    if (places) return Promise.resolve(places);
    if (placesLoading) return placesLoading;
    placesLoading = new Promise(function (resolve, reject) {
      window.__poofPlacesReady = function () {
        google.maps.importLibrary('places').then(function (lib) { places = lib; resolve(lib); }, reject);
      };
      var sc = document.createElement('script');
      sc.src = 'https://maps.googleapis.com/maps/api/js?key=' + PLACES_KEY + '&v=weekly&loading=async&callback=__poofPlacesReady';
      sc.async = true; sc.onerror = reject;
      document.head.appendChild(sc);
    }).catch(function (e) { console.warn('[Poof checkout] address lookup unavailable', e); placesLoading = null; throw e; });
    return placesLoading;
  }
  function bindAddressLookup(form) {
    var input = form.line1, token = null, timer = null, seq = 0, active = -1, items = [];
    var list = document.createElement('ul'); list.className = 'addr-suggest'; list.hidden = true;
    list.id = 'addr-suggest'; list.setAttribute('role', 'listbox');
    input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-controls', 'addr-suggest');
    input.parentNode.appendChild(list);
    function close() { list.hidden = true; list.innerHTML = ''; items = []; active = -1; }
    function highlight(i) {
      active = i;
      [].forEach.call(list.children, function (li, j) { li.setAttribute('aria-selected', j === i ? 'true' : 'false'); });
    }
    input.addEventListener('input', function () {
      clearTimeout(timer);
      var q = input.value.trim();
      if (q.length < 3) { close(); return; }
      timer = setTimeout(function () {
        var mine = ++seq;
        loadPlaces().then(function (lib) {
          if (!token) token = new lib.AutocompleteSessionToken();
          return lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: q, sessionToken: token, includedRegionCodes: [form.country.value.toLowerCase()],
            includedPrimaryTypes: ['street_address', 'premise', 'subpremise', 'route']
          });
        }).then(function (r) {
          if (mine !== seq) return;
          items = (r.suggestions || []).map(function (x) { return x.placePrediction; }).filter(Boolean).slice(0, 5);
          list.innerHTML = '';
          if (!items.length) { close(); return; }
          items.forEach(function (p, i) {
            var li = document.createElement('li'); li.setAttribute('role', 'option'); li.textContent = p.text.text;
            li.addEventListener('mousedown', function (ev) { ev.preventDefault(); pick(i); });
            list.appendChild(li);
          });
          list.hidden = false; highlight(-1);
        }).catch(function () { close(); });
      }, 250);
    });
    input.addEventListener('keydown', function (ev) {
      if (list.hidden) return;
      if (ev.key === 'ArrowDown') { ev.preventDefault(); highlight(Math.min(active + 1, items.length - 1)); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); highlight(Math.max(active - 1, 0)); }
      else if (ev.key === 'Enter' && active >= 0) { ev.preventDefault(); pick(active); }
      else if (ev.key === 'Escape') close();
    });
    input.addEventListener('blur', function () { setTimeout(close, 150); });
    function pick(i) {
      var p = items[i]; if (!p) return;
      close();
      var place = p.toPlace();
      place.fetchFields({ fields: ['addressComponents'] }).then(function () {
        token = null;                                        // the session ends with this details call
        var c = {};
        (place.addressComponents || []).forEach(function (a) { a.types.forEach(function (t) { c[t] = a; }); });
        var long = function (t) { return c[t] ? c[t].longText : ''; }, short = function (t) { return c[t] ? c[t].shortText : ''; };
        var street = [long('street_number'), long('route')].filter(Boolean).join(' ');
        form.line1.value = (long('subpremise') ? long('subpremise') + '/' : '') + street || form.line1.value;
        form.city.value = long('locality') || long('postal_town') || long('sublocality') || long('administrative_area_level_2') || form.city.value;
        form.state.value = short('administrative_area_level_1') || form.state.value;
        form.postcode.value = long('postal_code') || form.postcode.value;
        var cc = short('country');
        if (cc && form.country.querySelector('option[value="' + cc + '"]')) form.country.value = cc;
        ['line1', 'city', 'state', 'postcode'].forEach(function (n) { form[n].classList.remove('is-error'); });
        form.postcode.dispatchEvent(new Event('input'));    // re-price delivery for the new postcode
        (form.line2.value ? form.postcode : form.line2).focus();
      }).catch(function (e) { console.warn('[Poof checkout] address details failed', e); });
    }
  }

  /* ---------- Delivery ---------- */
  // Books + delivery, on the summary, the Pay button and the wallet sheets.
  function showTotals() {
    var c = shipCents(), d = $('[data-delivery-total]');
    if (d) {
      if (c != null) d.replaceChildren(money(c / 100));
      else d.innerHTML = '<span class="gap-inline">' + (ship.needPostcode ? 'enter your postcode' : ship.error ? 'to be confirmed' : 'working it out…') + '</span>';
    }
    var grand = cartTotal + (c || 0) / 100;
    $('[data-grand-total]').replaceChildren(money(grand));
    var pt = $('[data-pay-total]'); if (pt) pt.textContent = aud(grand);
    var t = { amount: aud(grand), label: 'Poof Books' };
    walletRequests.forEach(function (r) {
      try { r.update({ total: t, lineItems: [{ label: 'Books', amount: aud(cartTotal) }, { label: 'Delivery', amount: aud((c || 0) / 100) }] }); } catch (e) { /* older SDK */ }
    });
  }
  function renderShip() {
    var box = $('.ship'); if (!box) return;
    box.innerHTML = '';
    if (ship.needPostcode || ship.error || !ship.options.length) {
      var p = document.createElement('p'); p.className = 'ship-wait';
      p.textContent = ship.error || (ship.needPostcode ? 'Enter your postcode and we\'ll show the delivery price.' : 'Working out delivery…');
      box.appendChild(p);
    }
    ship.options.forEach(function (o) {
      var lab = document.createElement('label'); lab.className = 'ship-opt';
      var r = document.createElement('input'); r.type = 'radio'; r.name = 'ship'; r.value = o.id; r.checked = o.id === (shipOption() || {}).id;
      r.addEventListener('change', function () { ship.choice = o.id; showTotals(); });
      var t = document.createElement('span'), b = document.createElement('b'), sm = document.createElement('small');
      b.textContent = o.label;
      sm.textContent = o.id === 'express' ? 'Tracked, faster.' : o.cents === 0 ? 'Sent straight from our supplier.' : 'Tracked. Priced by weight and size.';
      t.append(b, sm);
      lab.append(r, t, money(o.cents / 100)); box.appendChild(lab);
    });
    showTotals();
  }
  // Ask the Worker for delivery options. Resolves when the options on screen are current for this cart and address.
  function quoteDelivery(addr) {
    if (!currentCart.length) return Promise.resolve();
    var items = currentCart.map(function (l) { return { isbn: l.isbn, qty: l.qty }; });
    var key = JSON.stringify([items, addr.postcode || '', addr.country || 'AU']);
    if (key === ship.key && ship.options.length && !ship.pending) return Promise.resolve();
    if (key === ship.key && ship.pending) return ship.pending;
    ship.key = key; ship.error = '';
    var p = fetch(SHIP_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: items, address: addr }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (key !== ship.key) return;                        // a newer address has been typed since
        if (!x.ok || !x.j.ok) { ship.options = []; ship.needPostcode = false; ship.error = (x.j && x.j.error) || 'We couldn\'t work out delivery just now.'; }
        else { ship.options = x.j.options || []; ship.needPostcode = !!x.j.needPostcode; }
      }, function () { if (key === ship.key) { ship.options = []; ship.error = 'We couldn\'t reach our delivery calculator. Check your connection.'; } })
      .then(function () { if (key === ship.key) { ship.pending = null; renderShip(); } });
    ship.pending = p;
    renderShip();
    return p;
  }
  function formAddr(form) { return { postcode: form.postcode.value.trim(), country: form.country.value }; }
  function bindDelivery(form) {
    var t = null;
    function again() { clearTimeout(t); t = setTimeout(function () { quoteDelivery(formAddr(form)); }, 400); }
    form.postcode.addEventListener('input', again);
    form.country.addEventListener('change', again);
    quoteDelivery(formAddr(form));
  }

  // One button to empty the cart; asks once ("Tap again to empty") so it can't happen by accident.
  function addEmptyButton() {
    var h = $('.summary h2'), wrap = document.createElement('div'), btn = document.createElement('button'), t = null;
    wrap.className = 'sum-head'; h.parentNode.insertBefore(wrap, h); wrap.appendChild(h);
    btn.type = 'button'; btn.className = 'empty-cart'; btn.textContent = 'Empty cart';
    wrap.appendChild(btn);
    btn.addEventListener('click', function () {
      if (btn.dataset.armed) { PoofCart.clear(); location.reload(); return; }
      btn.dataset.armed = '1'; btn.textContent = 'Tap again to empty';
      clearTimeout(t);
      t = setTimeout(function () { delete btn.dataset.armed; btn.textContent = 'Empty cart'; }, 4000);
    });
  }

  // Nothing in the cart: Lil Otter shoos the visitor back upstairs to the curators' grid in the Cabin.
  function showEmpty() {
    var box = $('.summary');
    box.querySelectorAll('[data-lines], .totals, .sum-note, [data-fx-note]').forEach(function (el) { el.hidden = true; });
    var p = document.createElement('p'); p.className = 'empty-note'; p.textContent = 'Your cart is empty.';
    var a = document.createElement('a'); a.className = 'pay back-to-shelves'; a.href = '/the-cabin/#curators'; a.textContent = 'Back to the shelves';
    box.append(p, a);
    $('[data-panel]').hidden = true;
    html.classList.add('cart-empty');
    say('empty');
  }

  /* ---------- Moments ---------- */
  /* ---------- Hand-over to the thank-you page ----------
     The order summary goes to /checkout/thanks/ in sessionStorage (this browser tab only), so that page
     only works straight after a payment. Live checkout: ref becomes Square's receipt number from the Worker. */
  function makeRef() {
    var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = '';
    for (var i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)];
    return 'TEST-' + r;                       // sandbox only: no real order exists yet
  }
  function buildOrder(email, name, address, paidWith) {
    return {
      ref: makeRef(), test: true, placedAt: new Date().toISOString(),
      email: email || '', name: name || '', address: address || [], paidWith: paidWith || '',
      items: currentCart.map(function (l) { return { title: l.book.title, author: l.book.author, cover: l.book.cover, format: l.format, qty: l.qty, price: l.price, stock: l.stock }; }),
      booksTotal: cartTotal, delivery: shipCents() == null ? null : shipCents() / 100, total: cartTotal + (shipCents() || 0) / 100
    };
  }
  function formAddress(form) {
    var sel = form.country, country = sel.options[sel.selectedIndex].text;
    return [form.line1.value, form.line2.value, [form.city.value, form.state.value, form.postcode.value].filter(Boolean).join(' '), country]
      .map(function (x) { return (x || '').trim(); }).filter(Boolean);
  }
  function walletAddress(details) {
    var c = details && details.shipping && details.shipping.contact;
    if (!c) return { name: '', lines: [] };
    var lines = (c.addressLines || []).concat([[c.city, c.state, c.postalCode].filter(Boolean).join(' '), c.countryCode || '']);
    return { name: [c.givenName, c.familyName].filter(Boolean).join(' '), lines: lines.map(function (x) { return (x || '').trim(); }).filter(Boolean) };
  }
  function cardLabel(details) {
    var c = details && details.card;
    if (!c) return 'Card';
    var brand = (c.brand || 'Card').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, function (m) { return m.toUpperCase(); });
    return brand + (c.last4 ? ' ending ' + c.last4 : '');
  }
  // Send the token and the order to the payments Worker. Resolves with the Worker's order, or throws an Error
  // whose message is safe to show the customer.
  function newKey() {
    try { return crypto.randomUUID(); } catch (e) { return 'k' + Date.now() + Math.random().toString(36).slice(2); }
  }
  async function payViaWorker(payload) {
    payload.items = currentCart.map(function (l) { return { isbn: l.isbn, qty: l.qty }; });
    payload.curators = !html.classList.contains('no-curators');
    payload.idempotencyKey = newKey();
    if (!payload.deliveryOption) { var o = shipOption(); if (o) { payload.deliveryOption = o.id; payload.deliveryCents = o.cents; } }
    var res, data;
    try {
      res = await fetch(PAY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      data = await res.json();
    } catch (e) {
      throw new Error('We couldn\'t reach our payment service just now. You have not been charged.');
    }
    if (data && data.code === 'DELIVERY_CHANGED' && data.delivery) { ship.options = data.delivery.options || []; renderShip(); }
    if (!res.ok || !data.ok) throw new Error(data && data.error ? data.error : 'The payment didn\'t go through. You have not been charged.');
    return data;
  }
  // The thank-you page's order, from the Worker's reply (its prices and order number), with covers from the cart.
  function orderFromWorker(w) {
    return {
      ref: w.ref, test: !!w.test, placedAt: new Date().toISOString(),
      email: w.email, name: w.name, address: w.address || [], paidWith: w.paidWith,
      items: (w.items || []).map(function (i) {
        var c = currentCart.filter(function (l) { return l.isbn === i.isbn; })[0];
        return { title: i.title, author: c ? c.book.author : '', cover: c ? c.book.cover : '', format: i.format, qty: i.qty, price: i.price };
      }),
      booksTotal: w.booksTotal, delivery: w.delivery, total: w.total
    };
  }

  // A sample order (test-mode preview, no real cart) is never charged or emailed. Say so plainly rather than
  // pretending it went through.
  function sampleOnly() {
    plainStatus('This is only a sample order, so nothing was charged and no email was sent. To test a real order, add a book with its Buy button and come back to checkout.', 'err');
  }

  function goThanks(order) {
    try {
      sessionStorage.setItem('poof-last-order', JSON.stringify(order));
      location.href = '/checkout/thanks/';
    } catch (e) {
      showConfirmed(order.email, true);       // storage blocked: confirm on this page instead
    }
  }

  function showConfirmed(email, scroll) {
    $('[data-form]').hidden = true;
    $('.co-box').hidden = true;                 // the order is placed: no more "Your order" box
    var d = $('[data-done]'); d.hidden = false;
    if (email) document.querySelectorAll('[data-done-email]').forEach(function (el) { el.textContent = email; });
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

  var walletRequests = [];          // (Square wallets are gone: Stripe's Payment Element shows Apple Pay / Google Pay itself)
  function adultOk(form) {
    var adult = $('[data-adult]');
    if (adult.hidden || form.adult.checked) return true;
    form.adult.focus();
    plainStatus('Please tick "I\'m 18 or over" first: your order includes a book from Exquisite Erotica.', 'err');
    return false;
  }


  /* ---------- Stripe: Payment Element + Currency Selector ---------- */
  var APPEAR_DARK = { theme: 'night', variables: { colorPrimary: '#FF5FA2', colorBackground: '#18122B', colorText: '#F4EFE6',
    colorTextSecondary: '#CFC6E8', colorDanger: '#FF6B6B', borderRadius: '12px', fontFamily: 'DM Sans, system-ui, sans-serif' },
    rules: { '.Input': { border: '1.5px solid #4A3D6E' }, '.Input:focus': { borderColor: '#FF5FA2' } } };
  var APPEAR_LIGHT = { theme: 'stripe', variables: { colorPrimary: '#C2185B', colorBackground: '#FFFFFF', colorText: '#18122B',
    colorDanger: '#C62828', borderRadius: '12px', fontFamily: 'DM Sans, system-ui, sans-serif' } };
  var pay = { stripe: null, checkout: null, actions: null, key: '', els: [] };
  function payKey(form) {
    return JSON.stringify([currentCart.map(function (l) { return [l.isbn, l.qty]; }), (shipOption() || {}).id, shipCents(),
      ['given', 'family', 'email', 'line1', 'line2', 'city', 'state', 'postcode', 'country'].map(function (n) { return form[n].value.trim(); }),
      !!(form.adult && form.adult.checked), html.classList.contains('no-curators')]);
  }
  function resetPayment(form, why) {
    if (!pay.checkout) return;
    pay.els.forEach(function (e) { try { e.destroy(); } catch (x) {} });
    pay.els = []; pay.checkout = null; pay.actions = null; pay.key = '';
    $('[data-pay-box]').hidden = true; $('[data-wallets]').hidden = true;
    var btn = $('[data-pay]'); btn.disabled = false; btn.textContent = 'Continue to payment';
    if (why) plainStatus(why, 'ok');
  }
  function chargeText(session) {
    try { return session.total.total.amount; } catch (e) { return ''; }
  }
  async function openPayment(form) {
    var btn = $('[data-pay]');
    if (!STRIPE_PK || !window.Stripe) { plainStatus('Payments aren\'t switched on yet. You have not been charged.', 'err'); return; }
    plainStatus('Opening the payment box…', 'ok');
    var o = shipOption(), res, data;
    try {
      res = await fetch(SESSION_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        items: currentCart.map(function (l) { return { isbn: l.isbn, qty: l.qty }; }),
        curators: !html.classList.contains('no-curators'), adult: !!(form.adult && form.adult.checked),
        email: form.email.value.trim(), given: form.given.value.trim(), family: form.family.value.trim(),
        address: { line1: form.line1.value, line2: form.line2.value, city: form.city.value, state: form.state.value, postcode: form.postcode.value, country: form.country.value },
        deliveryOption: o && o.id, deliveryCents: o && o.cents }) });
      data = await res.json();
    } catch (e) { showProblem('We couldn\'t reach our payment service just now. You have not been charged.'); return; }
    if (data && data.code === 'DELIVERY_CHANGED' && data.delivery) { ship.options = data.delivery.options || []; renderShip(); }
    if (!res.ok || !data.ok) { showProblem(data && data.error ? data.error : 'The payment box couldn\'t open. You have not been charged.'); return; }
    try {
      pay.stripe = pay.stripe || window.Stripe(STRIPE_PK);
      pay.checkout = pay.stripe.initCheckoutElementsSdk({
        clientSecret: data.clientSecret,
        adaptivePricing: { allowed: true },
        elementsOptions: { appearance: html.classList.contains('lm') ? APPEAR_LIGHT : APPEAR_DARK }
      });
      var cur = pay.checkout.createCurrencySelectorElement(); cur.mount('#currency-selector');
      // Apple Pay / Google Pay / Link buttons: the address is already on the form and delivery priced, so the
      // wallet only pays (Stripe can't reprice delivery from a wallet's address with Checkout Sessions).
      var wallets = $('[data-wallets]'); wallets.hidden = true;
      var ece = pay.checkout.createExpressCheckoutElement({
        buttonType: { applePay: 'buy', googlePay: 'buy' },
        buttonTheme: { applePay: html.classList.contains('lm') ? 'black' : 'white' },
        buttonHeight: 48
      });
      ece.on('availablepaymentmethodschange', function (ev) { wallets.hidden = !(ev && ev.paymentMethods); });
      ece.mount('#express-checkout');
      var pe = pay.checkout.createPaymentElement(); pe.mount('#payment-element');
      pay.els = [cur, ece, pe];
      var loaded = await pay.checkout.loadActions();
      if (loaded.type !== 'success') throw new Error('loadActions ' + loaded.type);
      pay.actions = loaded.actions;
      ece.on('confirm', async function (ev) {
        if (payKey(form) !== pay.key) { resetPayment(form, 'Your order changed, so press Continue to payment again.'); return; }
        plainStatus('Taking payment…', 'ok');
        try {
          var r = await pay.actions.confirm({ expressCheckoutConfirmEvent: ev });
          if (r && r.type === 'error') showProblem((r.error && r.error.message) ? r.error.message + ' You have not been charged.' : 'The payment didn\'t go through. You have not been charged.');
        } catch (e) { console.error('[Poof checkout]', e); showProblem('The payment didn\'t go through. You have not been charged.'); }
      });
      pay.key = payKey(form);
      var show = function (session) { var t = chargeText(session); btn.textContent = t ? 'Pay ' + t : 'Pay'; };
      show(pay.actions.getSession());
      pay.checkout.on('change', function (session) { show(session); });
      $('[data-pay-box]').hidden = false; $('[data-status]').innerHTML = '';
      $('[data-pay-box]').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      console.error('[Poof checkout]', e);
      showProblem('The payment box couldn\'t open. Please refresh the page. You have not been charged.');
      resetPayment(form);
    }
  }
  async function confirmPayment(form) {
    var btn = $('[data-pay]'); btn.disabled = true;
    plainStatus('Taking payment…', 'ok');
    try {
      var r = await pay.actions.confirm();          // on success Stripe goes to /checkout/thanks/?session_id=...
      if (r && r.type === 'error') {
        showProblem((r.error && r.error.message) ? r.error.message + ' You have not been charged.' : 'The payment didn\'t go through. You have not been charged.');
        btn.disabled = false;
      }
    } catch (e) {
      console.error('[Poof checkout]', e);
      showProblem('The payment didn\'t go through. You have not been charged.');
      btn.disabled = false;
    }
  }
  function startStripe(form) {
    var btn = $('[data-pay]');
    btn.disabled = false; btn.textContent = 'Continue to payment';
    // Anything that changes the order after the payment box opened closes it again, so the amount is never stale.
    form.addEventListener('input', function (ev) { if (pay.checkout && !ev.target.closest('[data-pay-box]')) resetPayment(form, 'Your order changed, so press Continue to payment again.'); });
    form.addEventListener('change', function (ev) { if (pay.checkout && !ev.target.closest('[data-pay-box]')) resetPayment(form, 'Your order changed, so press Continue to payment again.'); });
    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      if (pay.checkout && pay.actions && pay.key === payKey(form)) { confirmPayment(form); return; }
      if (!checkFields(form)) {
        var names = { given: 'first name', family: 'last name', email: 'email address', line1: 'street address', city: 'suburb or town', postcode: 'postcode' };
        var missing = [].filter.call(form.querySelectorAll('input.is-error'), function (el) { return names[el.name]; }).map(function (el) { return names[el.name]; });
        plainStatus(missing.length ? 'Nearly there: please fill in your ' + missing.join(', ') + ' (highlighted above).' : 'Please fill in the highlighted boxes.', 'err');
        return;
      }
      if (!adultOk(form)) return;
      btn.disabled = true;
      var before = shipCents();
      await quoteDelivery(formAddr(form));
      if (ship.error || shipCents() == null) { plainStatus(ship.error || 'Please check your postcode: we need it to work out delivery.', 'err'); btn.disabled = false; return; }
      if (before !== shipCents()) { plainStatus('Delivery is now A$' + aud(shipCents() / 100) + '. Please check the total and press Continue again.', 'err'); btn.disabled = false; return; }
      if (!usingRealCart) { sampleOnly(); btn.disabled = false; return; }
      await openPayment(form);
      btn.disabled = false;
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    fetch('/assets/data/sellable.json', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (j) { SELL = j || {}; }, function () { SELL = {}; })
      .then(start);
  });
  function start() {
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
      say(cartKey(CARTS.three));
      return;
    }
    if (demo === 'confirmed') { location.replace('/checkout/thanks/?demo=1'); return; }

    var mine = demo ? [] : realCart();
    usingRealCart = mine.length > 0;
    if (demo === 'empty' || (!usingRealCart && !demo)) { showEmpty(); return; }
    if (demo === 'sample') {
      var note = document.createElement('p'); note.className = 'sum-note sample-note';
      note.textContent = 'Sample order (test mode). Press Buy on a book\'s page to see your own cart here.';
      $('.summary h2').after(note);
    }
    var hasBack = renderCart(usingRealCart ? mine : (demo === 'backorder' ? CARTS.backorder : CARTS.single));
    if (usingRealCart) addEmptyButton();
    say(hasBack ? 'backorder' : 'greeting', usingRealCart ? cartKey(mine) : null);
    if (demo === 'problem') showProblem('');
    if (usingRealCart) bindDelivery(form);
    else { ship.options = [{ id: 'standard', label: 'Standard post', cents: 0 }]; renderShip(); }   // sample orders: no quote
    bindAddressLookup(form);
    startStripe(form);
  }
})();
