/* Poof Books: order thank-you page, voiced by Lil Otter.
   Reached only from a successful payment: checkout.js puts the order in sessionStorage ("poof-last-order")
   and comes here. Without it, the page sends the visitor back to checkout.
   ?demo=1 shows a sample order (test mode only; remove with the test band at go-live). */
(function () {
  'use strict';
  var html = document.documentElement, audio = null;
  function $(s) { return document.querySelector(s); }
  function money(n) { var s = document.createElement('span'); s.className = 'money'; s.setAttribute('data-aud', n.toFixed(2)); s.textContent = 'A$' + n.toFixed(2); return s; }

  var SAMPLE = {
    ref: 'TEST-SAMPLE', test: true, email: 'boss@example.com', name: 'Sample Reader',
    address: ['1 Sample Street', 'Melbourne VIC 3000', 'Australia'], paidWith: 'Visa ending 1111',
    items: [{ title: 'The Art of Surrender', author: 'Blair Purvis', cover: '/assets/books/art-of-surrender-print.webp', format: 'Paperback, Short & Thick', qty: 1, price: 39.95 }],
    booksTotal: 39.95, delivery: null, total: 39.95
  };

  function read() {
    try { return JSON.parse(sessionStorage.getItem('poof-last-order') || 'null'); } catch (e) { return null; }
  }

  /* Lil Otter's voice: never autoplays; only on the button, only with Sound on. */
  function stopVoice() {
    if (audio) { audio.pause(); audio = null; }
    var b = $('[data-otter-play]'); if (b) b.setAttribute('aria-pressed', 'false');
  }
  function bindVoice() {
    var btn = $('[data-otter-play]'); if (!btn) return;
    btn.addEventListener('click', function () {
      if (audio) { stopVoice(); return; }
      if (!html.classList.contains('sound-on')) return;
      audio = new Audio(btn.getAttribute('data-audio'));
      btn.setAttribute('aria-pressed', 'true');
      audio.addEventListener('ended', stopVoice);
      audio.play().catch(stopVoice);
    });
    new MutationObserver(function () {
      if (!html.classList.contains('sound-on') || html.classList.contains('no-curators')) stopVoice();
    }).observe(html, { attributes: true, attributeFilter: ['class'] });
  }

  function fill(o) {
    if (o.email) document.querySelectorAll('[data-email]').forEach(function (el) { el.textContent = o.email; });
    $('[data-ref]').textContent = o.ref;
    var ul = $('[data-lines]');
    (o.items || []).forEach(function (l) {
      var li = document.createElement('li'); li.className = 'line';
      var img = document.createElement('img'); img.src = l.cover; img.width = 800; img.height = 1200; img.alt = '';
      var t = document.createElement('div'); t.className = 'line-text';
      var b = document.createElement('b'); b.textContent = l.title;
      var a = document.createElement('span'); a.textContent = l.author;
      var f = document.createElement('span'); f.textContent = l.format + ' · Qty ' + l.qty;
      t.append(b, a, f);
      var p = money(l.price * l.qty); p.classList.add('line-price');
      li.append(img, t, p); ul.appendChild(li);
    });
    $('[data-books-total]').replaceChildren(money(o.booksTotal || 0));
    var d = $('[data-delivery]');
    if (typeof o.delivery === 'number') d.replaceChildren(money(o.delivery));
    else d.innerHTML = '<span class="gap-inline">rates to come</span>';
    $('[data-total]').replaceChildren(money(o.total || 0));
    var ad = $('[data-address]');
    [o.name].concat(o.address || []).filter(Boolean).forEach(function (x, i) {
      if (i) ad.appendChild(document.createElement('br'));
      ad.appendChild(document.createTextNode(x));
    });
    if (!ad.textContent) ad.textContent = 'From your wallet';
    $('[data-paid-with]').textContent = o.paidWith || 'Card';
    $('[data-order]').hidden = false;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var demo = new URLSearchParams(location.search).get('demo');
    var order = demo ? SAMPLE : read();
    if (!order) { location.replace('/checkout/'); return; }   // no payment, no thank-you page
    bindVoice();
    fill(order);
  });
})();
