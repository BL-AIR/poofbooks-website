/* Poof Books: the trolley in the header, with a pink count of items in the cart.
   The cart lives on the reader's device (localStorage "poof-cart": [{ isbn, qty }]).
   Other scripts use window.PoofCart:
     PoofCart.add(isbn, qty)   add copies of an edition (qty defaults to 1)
     PoofCart.setQty(isbn, n)  set the copies of an edition (0 removes it; at most 10)
     PoofCart.items()          the cart as a list
     PoofCart.count()          total number of items
     PoofCart.clear()          empty it (after an order is placed)
   Every change fires a "poof:cart" event on document, and the badge follows it (and other tabs). */
(function () {
  'use strict';
  var KEY = 'poof-cart';

  function read() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function write(items) {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {}
    document.dispatchEvent(new CustomEvent('poof:cart', { detail: { count: count(items) } }));
  }
  function count(items) {
    return (items || read()).reduce(function (n, i) { return n + (Number(i.qty) > 0 ? Number(i.qty) : 0); }, 0);
  }

  window.PoofCart = {
    items: read,
    count: function () { return count(); },
    add: function (isbn, qty) {
      var items = read(), q = qty > 0 ? qty : 1, hit = items.filter(function (i) { return i.isbn === isbn; })[0];
      if (hit) hit.qty = (Number(hit.qty) || 0) + q; else items.push({ isbn: String(isbn), qty: q });
      write(items);
    },
    remove: function (isbn) { write(read().filter(function (i) { return i.isbn !== String(isbn); })); },
    setQty: function (isbn, qty) {                         // 0 or less removes the line; capped at 10 (the payments Worker's limit)
      var q = Math.min(10, Math.floor(Number(qty) || 0));
      if (q <= 0) { this.remove(isbn); return; }
      var items = read(), hit = items.filter(function (i) { return i.isbn === String(isbn); })[0];
      if (hit) hit.qty = q; else items.push({ isbn: String(isbn), qty: q });
      write(items);
    },
    clear: function () { write([]); }
  };

  var TROLLEY = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M2.5 3.5h2.6l2.3 11.2a1.6 1.6 0 0 0 1.6 1.3h8.4a1.6 1.6 0 0 0 1.6-1.2l1.6-6.8H6.1"></path>' +
    '<circle cx="9.5" cy="20" r="1.5"></circle><circle cx="17.5" cy="20" r="1.5"></circle></svg>';

  document.addEventListener('DOMContentLoaded', function () {
    var gear = document.querySelector('.site-header .gear');
    if (!gear) return;

    // Header tools sit together on the right: currency, trolley, gear (currency.js adds itself first).
    var tools = gear.closest('.hdr-tools');
    if (!tools) {
      tools = document.createElement('div');
      tools.className = 'hdr-tools';
      gear.parentNode.insertBefore(tools, gear);
      tools.appendChild(gear);
    }
    var a = document.createElement('a');
    a.className = 'cart-btn';
    a.href = '/checkout/';
    a.innerHTML = TROLLEY + '<span class="cart-count" hidden></span>';
    tools.insertBefore(a, gear);
    if (location.pathname === '/checkout/') a.setAttribute('aria-current', 'page');

    var badge = a.querySelector('.cart-count');
    function paint() {
      var n = count();
      badge.hidden = n === 0;
      badge.textContent = n > 99 ? '99+' : String(n);
      var label = n === 0 ? 'Your cart is empty' : 'Your cart: ' + n + (n === 1 ? ' item' : ' items');
      a.setAttribute('aria-label', label);
      a.title = label;
    }
    paint();
    document.addEventListener('poof:cart', paint);
    window.addEventListener('storage', function (e) { if (e.key === KEY) paint(); });   // another tab changed it
  });
})();
