/* Poof Books: shop and search measurement (5 Nov 2026).
   Pushes Google Analytics 4 ecommerce and search events to the dataLayer; Google Tag Manager sends them to GA4
   (and only as far as the visitor's cookie choice allows: see consent.js). Also marks the same moments in
   Microsoft Clarity, when Clarity is running, so recordings can be filtered by them.

   The funnel:  view_item_list (a shelf)  ->  select_item (a book clicked on the shelf, in search or in the finder)
                ->  view_item (Bookapedia page)  ->  add_to_cart (Buy)  ->  begin_checkout (checkout page)
                ->  add_shipping_info (Continue to payment)  ->  add_payment_info (Pay)  ->  purchase (thank-you page)
   Searches:    search         the quick search ("Know what you want?"): term, type (isbn / title / author /
                               title_author / none) and number of results; a book clicked from it is select_item
                               with item_list_id "quick-search".
                finder_search  Big Daddy's finder ("Kinda know what you want?"): how many words were typed and how
                               many books matched. What the reader typed is NOT sent (the finder promises it stays in
                               his browser). A book clicked from it is select_item with item_list_id "finder".
   Items are works: item_id = the book page slug, item_name = title, item_brand = author, item_category = shelf,
   item_variant = format (in the cart). Prices in Australian dollars.
   Loaded by cart.js on every page that has the cart. checkout.js and thanks.js call PoofTrack.* directly. */
(function () {
  'use strict';
  if (window.PoofTrack) return;
  var dl = window.dataLayer = window.dataLayer || [];
  var SHELVES = { 'faghetti-westerns': 'Faghetti Westerns', 'rollicking-romances': 'Rollicking Romances',
    'conniving-crimes': 'Conniving Crimes', 'exquisite-erotica': 'Exquisite Erotica', 'fabulous-fables': 'Fabulous Fables',
    'luminous-literature': 'Luminous Literature', 'supernova-adventures': 'Supernova Adventures',
    'no-nonsense-non-fiction': 'No Nonsense Non-Fiction' };
  var AOS = { '9781922263988': 'Paperback, Short & Thick', '9781922263971': 'Paperback, Long & Skinny', '9781922263933': 'Hardback Special Edition' };
  var AOS_PRICE = { '9781922263988': 39.95, '9781922263971': 39.95, '9781922263933': 89.95 };

  function clip(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) : s; }
  function clarity(name) { try { if (typeof window.clarity === 'function') window.clarity('event', name); } catch (e) {} }
  function push(event, ecommerce, extra) {
    if (ecommerce) dl.push({ ecommerce: null });           // GA4: clear the previous ecommerce object first
    var o = { event: event };
    if (ecommerce) o.ecommerce = ecommerce;
    if (extra) Object.keys(extra).forEach(function (k) { if (extra[k] !== undefined && extra[k] !== '') o[k] = extra[k]; });
    dl.push(o);
  }
  function pathShelf(p) { var s = (p || location.pathname).split('/')[1] || ''; return SHELVES[s] ? s : ''; }
  function slugOf(u) { var m = /\/books\/([^/?#]+)/.exec(u || ''); return m ? m[1] : ''; }

  // Editions the checkout can sell, from the site build: isbn -> { t title, a author, f format, p price, u page }.
  var sellP = null;
  function sellable() {
    if (!sellP) sellP = fetch('/assets/data/sellable.json').then(function (r) { return r.ok ? r.json() : {}; }, function () { return {}; });
    return sellP;
  }
  // isbn -> book page slug, remembered on Bookapedia pages so cart and order items match the pages' item ids.
  var SLUGS_KEY = 'poof-track-slugs';
  function slugs() { try { return JSON.parse(localStorage.getItem(SLUGS_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function rememberSlug(isbn, slug, shelf) {
    try { var m = slugs(); m[isbn] = shelf ? slug + '|' + shelf : slug; var k = Object.keys(m); if (k.length > 300) delete m[k[0]];
      localStorage.setItem(SLUGS_KEY, JSON.stringify(m)); } catch (e) {}
  }
  function cartItem(sell, isbn, qty, shelf) {
    var s = sell[isbn] || {}, mem = (slugs()[isbn] || '').split('|');
    shelf = shelf || mem[1] || '';
    var it = { item_id: slugOf(s.u) || mem[0] || (AOS[isbn] ? 'the-art-of-surrender' : isbn), item_name: s.t || (AOS[isbn] ? 'The Art of Surrender' : isbn),
      item_brand: s.a || (AOS[isbn] ? 'Blair Purvis' : undefined), item_variant: s.f || AOS[isbn], price: s.p != null ? s.p : AOS_PRICE[isbn],
      quantity: qty || 1 };
    if (shelf) it.item_category = SHELVES[shelf] || shelf;
    Object.keys(it).forEach(function (k) { if (it[k] === undefined) delete it[k]; });
    return it;
  }
  function sum(items) { return Math.round(items.reduce(function (n, i) { return n + (i.price || 0) * (i.quantity || 1); }, 0) * 100) / 100; }
  function cartItems() { return sellable().then(function (sell) { return (window.PoofCart ? PoofCart.items() : []).map(function (i) { return cartItem(sell, i.isbn, Number(i.qty)); }); }); }

  // A book card on a shelf, in the finder or in the showcase.
  function cardItem(a, idx, listId) {
    var tEl = a.querySelector('.t, b'), mEl = a.querySelector('.m');
    var it = { item_id: slugOf(a.getAttribute('href')), item_name: clip(a.getAttribute('data-title') || (tEl ? tEl.textContent : a.textContent), 100) };
    var au = a.getAttribute('data-author') || (mEl ? clip(mEl.textContent, 100) : ''); if (au) it.item_brand = au;
    var pr = parseFloat(a.getAttribute('data-price')); if (!isNaN(pr)) it.price = pr;
    if (SHELVES[listId]) it.item_category = SHELVES[listId];
    if (idx != null) it.index = idx;
    return it;
  }
  function listName(id) { return SHELVES[id] || { 'quick-search': 'Quick search', 'finder': 'Book finder', 'cabin': 'The Cabin' }[id] || id; }

  // ---- Quick search: one event per search, sent once the reader pauses (or picks a book, or leaves the box) ----
  var qs = { term: '', type: '', n: 0, sent: '', t: null, loc: '' };
  function sendSearch() {
    clearTimeout(qs.t);
    if (!qs.term || qs.term === qs.sent) return;
    qs.sent = qs.term;
    push('search', null, { search_term: clip(qs.term, 100), search_type: qs.type, search_results: qs.n, search_location: qs.loc });
    if (!qs.n) clarity('search_no_results');
  }

  // ---- Finder: one event per description, after a pause ----
  var fd = { words: 0, n: 0, sent: '', t: null, key: '' };
  function finderCount(root) { return root ? root.querySelectorAll('a.book:not([hidden])').length : 0; }
  function sendFinder() {
    clearTimeout(fd.t);
    if (!fd.words || fd.key === fd.sent) return;
    fd.sent = fd.key;
    push('finder_search', null, { finder_words: fd.words, search_results: fd.n });
    clarity(fd.n ? 'finder_search' : 'finder_no_results');
  }

  window.PoofTrack = {
    // search.js, after each result list: raw query, its type and how many books showed.
    quickSearch: function (raw, type, n) {
      qs.term = String(raw || '').trim(); qs.type = type; qs.n = n;
      qs.loc = location.pathname === '/the-cabin/' || location.pathname === '/' ? 'cabin' : location.pathname.replace(/\//g, '') || 'home';
      clearTimeout(qs.t);
      if (qs.term) qs.t = setTimeout(sendSearch, 1500);
    },
    quickSearchDone: sendSearch,
    // checkout.js: "Continue to payment" pressed with this delivery option.
    shipping: function (label, cents) {
      cartItems().then(function (items) {
        if (!items.length) return;
        push('add_shipping_info', { currency: 'AUD', value: sum(items), shipping_tier: label || '', items: items });
      });
    },
    // checkout.js: Pay pressed (card or wallet).
    payment: function (kind) {
      cartItems().then(function (items) {
        if (!items.length) return;
        push('add_payment_info', { currency: 'AUD', value: sum(items), payment_type: kind || 'card', items: items });
      });
    },
    // thanks.js: the paid order from the payments Worker (once per order).
    purchase: function (o) {
      if (!o || !o.ref) return;
      var key = 'poof-tracked-' + o.ref;
      try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1'); } catch (e) {}
      sellable().then(function (sell) {
        var items = (o.items || []).map(function (l) {
          var it = cartItem(sell, l.isbn, Number(l.qty) || 1);
          if (l.title) it.item_name = l.title;
          if (l.format) it.item_variant = l.format;
          if (typeof l.price === 'number') it.price = l.price;
          return it;
        });
        push('purchase', { transaction_id: o.ref, currency: 'AUD', value: o.total || sum(items), shipping: typeof o.delivery === 'number' ? o.delivery : 0,
          items: items }, { order_test: o.test || /^TEST-/.test(o.ref) ? 'yes' : undefined,
          paid_currency: o.charged && o.charged.currency ? o.charged.currency : undefined });
        clarity('purchase');
      });
    }
  };

  function init() {
    var path = location.pathname, shelf = pathShelf(path);

    // A shelf: view_item_list with the first 12 books as they are shown.
    if (shelf) {
      var cards = Array.prototype.slice.call(document.querySelectorAll('a.book[data-title]:not([hidden])'));
      if (!cards.length) cards = Array.prototype.slice.call(document.querySelectorAll('a.book:not([hidden])'));
      cards = cards.slice(0, 12);
      push('view_item_list', { item_list_id: shelf, item_list_name: SHELVES[shelf], items: cards.map(function (a, i) { return cardItem(a, i, shelf); }) });
    }

    // A Bookapedia page: view_item, priced at its cheapest edition we sell.
    var bslug = slugOf(path);
    if (bslug && document.getElementById('book-title')) {
      var cur = document.querySelector('nav a[aria-current="page"]'), cshelf = cur ? pathShelf(cur.getAttribute('href')) : '';
      var au = document.querySelector('.author');
      var isbns = Array.prototype.map.call(document.querySelectorAll('[data-buy]'), function (b) { return b.getAttribute('data-buy'); });
      isbns.forEach(function (i) { rememberSlug(i, bslug, cshelf); });
      sellable().then(function (sell) {
        var prices = isbns.map(function (i) { return sell[i] ? sell[i].p : AOS_PRICE[i]; }).filter(function (p) { return typeof p === 'number'; });
        var it = { item_id: bslug, item_name: clip(document.getElementById('book-title').textContent, 100) };
        if (au) it.item_brand = clip(au.textContent.replace(/^\s*by\s+/i, ''), 100);
        if (cshelf) it.item_category = SHELVES[cshelf];
        if (prices.length) it.price = Math.min.apply(null, prices);
        push('view_item', { currency: 'AUD', value: it.price || 0, items: [it] }, { buyable: isbns.length ? 'yes' : 'no' });
      });
      // Buy: add_to_cart for that edition.
      document.addEventListener('click', function (ev) {
        var b = ev.target.closest && ev.target.closest('[data-buy]'); if (!b) return;
        var isbn = b.getAttribute('data-buy');
        sellable().then(function (sell) {
          var it = cartItem(sell, isbn, 1, cshelf);
          push('add_to_cart', { currency: 'AUD', value: it.price || 0, items: [it] });
          clarity('add_to_cart');
        });
      }, true);
    }

    // The checkout with books in the cart: begin_checkout (once per page view).
    if (path === '/checkout/' && !/[?&]demo=/.test(location.search) && window.PoofCart && PoofCart.count() > 0) {
      cartItems().then(function (items) {
        if (!items.length) return;
        push('begin_checkout', { currency: 'AUD', value: sum(items), items: items });
        clarity('begin_checkout');
      });
    }

    // A book clicked anywhere it's listed: select_item, with the list it came from.
    document.addEventListener('click', function (ev) {
      var a = ev.target.closest && ev.target.closest('a[href*="/books/"]'); if (!a || slugOf(path)) return;
      var listId, idx = null, extra = {};
      if (a.closest('.qs-list')) {
        listId = 'quick-search'; sendSearch(); extra.search_term = clip(qs.term, 100); extra.search_type = qs.type;
        idx = Array.prototype.indexOf.call(a.closest('.qs-list').children, a.closest('li'));
      } else if (a.closest('[data-finder]')) {
        listId = 'finder'; sendFinder(); extra.finder_words = fd.words || 0;
      } else listId = shelf || (path === '/the-cabin/' || path === '/' ? 'cabin' : path.replace(/^\/|\/$/g, '') || 'home');
      if (idx == null && a.classList.contains('book')) {
        var sib = a.parentNode ? Array.prototype.filter.call(a.parentNode.children, function (x) { return x.matches && x.matches('a.book') && !x.hidden; }) : [];
        idx = sib.indexOf(a);
      }
      var it = cardItem(a, idx >= 0 ? idx : null, listId);
      if (!it.item_name || it.item_name.length < 2) { var b = a.querySelector('b'); if (b) it.item_name = clip(b.textContent, 100); }
      push('select_item', { item_list_id: listId, item_list_name: listName(listId), items: [it] }, extra);
    }, true);

    // Quick search: leaving the box counts as the end of a search.
    document.addEventListener('focusout', function (ev) { if (ev.target.closest && ev.target.closest('[data-quick-search]')) setTimeout(sendSearch, 300); });

    // Finder: after each re-score (finder.js fires poof:want), count the matches once the reader pauses.
    var froot = document.querySelector('[data-finder]');
    if (froot) {
      document.addEventListener('poof:want', function () {
        var inp = Array.prototype.filter.call(document.querySelectorAll('.want-input'), function (i) { return i.offsetParent; })[0] || document.querySelector('.want-input');
        var q = inp ? inp.value.trim() : '';
        fd.words = q ? q.split(/\s+/).length : 0; fd.key = q;
        clearTimeout(fd.t);
        if (!q) return;
        fd.t = setTimeout(function () { fd.n = finderCount(froot); sendFinder(); }, 1500);
      });
    }
    window.addEventListener('pagehide', function () { sendSearch(); if (froot && fd.key && fd.key !== fd.sent) { fd.n = finderCount(froot); sendFinder(); } });
  }
  // track.js loads after the page (cart.js adds it), so the page may already be ready.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
