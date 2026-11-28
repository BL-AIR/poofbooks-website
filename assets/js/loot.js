/* Poof Loot: the gift card page, /gift-cards/ (28 Nov 2026).
   Backend: poofbooks-pay (Claude Code), README "Poof Loot gift cards". Decisions: PROJECT-LOG.md → Decisions → Gift cards.
   - Shown only on devices with the till open (cart.js adds html.till-open), when GET /v1/giftcard/config says on and
     available (Australian visitors; courtesy only: the Worker's card-country check is the real lock).
   - Recipient name and email and a send date are required before payment (Blair, 28 Nov 2026). "Send it to me" uses
     the buyer's own name and email as the recipient; the send date is still required.
   - Privacy: nothing about the buyer, recipient, amount or message goes to analytics or the dataLayer. Nothing is
     stored on the device except the sale source (poof-src, same as the book checkout).
   - Turnstile tokens are single-use: the widget is reset after every use. */
(function () {
  'use strict';
  var STRIPE_PK = 'pk_test_51UIp5DRarfJlhaAL3wOkVFjL3Cd2lmOoTr8H1gYJaATLA7Tygil51E0kYsiKVPCP0aFh2MKnGhzCEae42VOsjN7z003UUDAMY2';
  var TURNSTILE_SITEKEY = '0x4AAAAAAGT_ZwXdP5gYx3AD';
  var html = document.documentElement;
  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }

  /* ---------- dates in Melbourne ---------- */
  function melbToday() {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  }
  function plusYear(d) { return (Number(d.slice(0, 4)) + 1) + d.slice(4); }
  function niceDate(d) {
    try { return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(d + 'T00:00:00Z')); }
    catch (e) { return d; }
  }
  function dollars(cents) { return '$' + Math.round(cents / 100); }

  /* ---------- sale source (same rule as the book checkout) ---------- */
  function noteSource() {
    try {
      var q = new URLSearchParams(location.search);
      var src = (q.get('utm_source') || '').toLowerCase(), med = (q.get('utm_medium') || '').toLowerCase(), term = (q.get('utm_term') || '').toLowerCase();
      var plat = '';
      if (src === 'app' && (med === 'ios' || med === 'android')) plat = med;
      else if (src === 'poofbooks_app') plat = term === 'android' ? 'android' : 'ios';
      if (plat) localStorage.setItem('poof-src', JSON.stringify({ s: plat, t: Date.now() }));
    } catch (e) {}
  }
  function saleSource() {
    try {
      var c = JSON.parse(localStorage.getItem('poof-src') || 'null');
      if (c && (c.s === 'ios' || c.s === 'android') && Date.now() - c.t < 7 * 864e5) return c.s;
    } catch (e) {}
    return 'website';
  }

  /* ---------- Turnstile ---------- */
  var ts = { id: null, token: '', waiters: [] };
  function tsRender() {
    if (ts.id !== null || !window.turnstile || !document.getElementById('loot-ts')) return;
    ts.id = window.turnstile.render('#loot-ts', {
      sitekey: TURNSTILE_SITEKEY, action: 'giftcard', appearance: 'interaction-only',
      theme: html.classList.contains('lm') ? 'light' : 'dark',
      callback: function (t) { ts.token = t; ts.waiters.splice(0).forEach(function (f) { f(t); }); },
      'expired-callback': function () { ts.token = ''; },
      'error-callback': function () { ts.token = ''; }
    });
  }
  window.poofTurnstileReady = tsRender;
  function tsToken() {
    tsRender();
    if (ts.token) return Promise.resolve(ts.token);
    return new Promise(function (res) {
      ts.waiters.push(res);
      setTimeout(function () { var k = ts.waiters.indexOf(res); if (k >= 0) { ts.waiters.splice(k, 1); res(''); } }, 15000);
    });
  }
  function tsUsed() { ts.token = ''; try { if (ts.id !== null) window.turnstile.reset(ts.id); } catch (e) {} }

  /* ---------- page state ---------- */
  var form, statusEl, payBtn;
  var pay = { stripe: null, checkout: null, actions: null, key: '', els: [] };
  function say(msg, kind) { statusEl.textContent = msg || ''; statusEl.className = 'loot-status' + (kind ? ' ' + kind : ''); }

  function amountCents() {
    var r = $('input[name="amount"]:checked', form);
    if (!r) return 0;
    if (r.value !== 'custom') return Number(r.value);
    var d = Number(String($('#loot-custom').value).trim());
    return Number.isInteger(d) && d >= 20 && d <= 300 ? d * 100 : 0;
  }
  function sendToMe() { return $('#loot-me').checked; }
  function refreshCustomCard() {
    var d = Number(String($('#loot-custom').value).trim());
    $('[data-custom-value]').textContent = (Number.isInteger(d) && d >= 20 && d <= 300) ? '$' + d + ' Book Bucks' : 'Your choice';
  }
  function refreshSummary() {
    var c = amountCents(), when = $('#loot-date').value, who = sendToMe() ? 'you' : ($('#loot-rname').value.trim() || 'them');
    var t = $('[data-summary]');
    if (!c) { t.hidden = true; return; }
    t.hidden = false;
    $('[data-sum-amount]').textContent = dollars(c) + ' Book Bucks';
    $('[data-sum-who]').textContent = who;
    $('[data-sum-when]').textContent = when ? (when === melbToday() ? 'today, as soon as it\'s paid' : niceDate(when) + ', 8 am Melbourne time') : 'choose a date';
  }

  function fields() {
    return {
      buyerName: $('#loot-bname').value.trim(), buyerEmail: $('#loot-bemail').value.trim(),
      recipientName: $('#loot-rname').value.trim(), recipientEmail: $('#loot-remail').value.trim(),
      message: $('#loot-msg').value.trim(), deliverOn: $('#loot-date').value
    };
  }
  function okEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e); }
  function check() {
    var f = fields(), bad = [], today = melbToday();
    $all('.is-error', form).forEach(function (el) { el.classList.remove('is-error'); });
    function mark(id, label) { $(id).classList.add('is-error'); bad.push(label); }
    if (!amountCents()) { bad.push('an amount ($20 to $300, whole dollars)'); if ($('#a-custom').checked) $('#loot-custom').classList.add('is-error'); }
    if (!sendToMe()) {
      if (!f.recipientName) mark('#loot-rname', 'their name');
      if (!okEmail(f.recipientEmail)) mark('#loot-remail', 'their email address');
    }
    if (!f.deliverOn || f.deliverOn < today || f.deliverOn > plusYear(today)) mark('#loot-date', 'a send date from today to a year from now');
    if (!f.buyerName) mark('#loot-bname', 'your name');
    if (!okEmail(f.buyerEmail)) mark('#loot-bemail', 'your email address');
    if (bad.length) { say('Nearly there: please add ' + bad.join(', ') + '.', 'err'); return false; }
    return true;
  }
  function payKey() { var f = fields(); return JSON.stringify([amountCents(), sendToMe(), f.buyerName, f.buyerEmail, f.recipientName, f.recipientEmail, f.message, f.deliverOn]); }

  function resetPayment(why) {
    if (!pay.checkout) return;
    pay.els.forEach(function (e) { try { e.destroy(); } catch (x) {} });
    pay.els = []; pay.checkout = null; pay.actions = null; pay.key = '';
    $('[data-paybox]').hidden = true;
    payBtn.disabled = false; payBtn.textContent = 'Continue to payment';
    if (why) say(why, 'ok');
  }

  var APPEAR_DARK = { theme: 'night', variables: { colorPrimary: '#FF5FA2', colorBackground: '#18122B', colorText: '#F4EFE6',
    colorTextSecondary: '#CFC6E8', colorDanger: '#FF6B6B', borderRadius: '12px', fontFamily: 'DM Sans, system-ui, sans-serif' },
    rules: { '.Input': { border: '1.5px solid #4A3D6E' }, '.Input:focus': { borderColor: '#FF5FA2' } } };
  var APPEAR_LIGHT = { theme: 'stripe', variables: { colorPrimary: '#C2185B', colorBackground: '#FFFFFF', colorText: '#18122B',
    colorDanger: '#C62828', borderRadius: '12px', fontFamily: 'DM Sans, system-ui, sans-serif' } };

  async function openPayment() {
    if (!window.Stripe) { say('Payments aren\'t available just now. You have not been charged.', 'err'); return; }
    payBtn.disabled = true;
    say('Opening the payment box…', 'ok');
    var f = fields(), me = sendToMe(), res, data;
    var human = await tsToken();
    try {
      res = await fetch('/v1/giftcard/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        amountCents: amountCents(), buyerName: f.buyerName, buyerEmail: f.buyerEmail,
        recipientName: me ? f.buyerName : f.recipientName, recipientEmail: me ? f.buyerEmail : f.recipientEmail,
        sendToMe: me, message: f.message || undefined, deliverOn: f.deliverOn, turnstile: human || undefined, source: saleSource() }) });
      data = await res.json();
    } catch (e) { tsUsed(); payBtn.disabled = false; say('We couldn\'t reach our payment service just now. You have not been charged.', 'err'); return; }
    tsUsed();
    if (!res.ok || !data || !data.ok) {
      payBtn.disabled = false;
      if (data && data.code) { var map = { AMOUNT: '#loot-custom', BUYER: '#loot-bemail', RECIPIENT: '#loot-remail', DATE: '#loot-date' }; if (map[data.code]) $(map[data.code]).classList.add('is-error'); }
      say((data && data.error) || 'The payment box couldn\'t open. You have not been charged.', 'err');
      return;
    }
    try {
      pay.stripe = pay.stripe || window.Stripe(STRIPE_PK);
      pay.checkout = pay.stripe.initCheckoutElementsSdk({
        clientSecret: data.clientSecret,
        elementsOptions: { appearance: html.classList.contains('lm') ? APPEAR_LIGHT : APPEAR_DARK }
      });
      var pe = pay.checkout.createPaymentElement(); pe.mount('#loot-payment');
      pay.els = [pe];
      var loaded = await pay.checkout.loadActions();
      if (loaded.type !== 'success') throw new Error('loadActions ' + loaded.type);
      pay.actions = loaded.actions;
      pay.key = payKey();
      $('[data-paybox]').hidden = false;
      payBtn.disabled = false; payBtn.textContent = 'Pay ' + dollars(amountCents());
      say(data.test ? 'Test mode: use card 4242 4242 4242 4242, any future expiry, any CVC. Nothing is charged.' : '', 'ok');
      $('[data-paybox]').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      console.error('[Poof Loot]', e);
      resetPayment();
      say('The payment box couldn\'t open. Please refresh the page. You have not been charged.', 'err');
    }
  }
  async function confirmPayment() {
    payBtn.disabled = true;
    say('Taking payment…', 'ok');
    try {
      var r = await pay.actions.confirm();          // on success Stripe goes to /gift-cards/thanks/?session_id=...
      if (r && r.type === 'error') {
        say((r.error && r.error.message ? r.error.message + ' ' : 'The payment didn\'t go through. ') + 'You have not been charged.', 'err');
        payBtn.disabled = false;
      }
    } catch (e) {
      console.error('[Poof Loot]', e);
      say('The payment didn\'t go through. You have not been charged.', 'err');
      payBtn.disabled = false;
    }
  }

  function setup() {
    form = $('#loot-form'); statusEl = $('[data-status]'); payBtn = $('[data-pay]');
    var today = melbToday(), date = $('#loot-date');
    date.min = today; date.max = plusYear(today); if (!date.value) date.value = today;
    var msg = $('#loot-msg'), count = $('[data-count]');
    function counted() { count.textContent = msg.value.length + ' / 200'; }
    msg.addEventListener('input', counted); counted();
    $('#loot-me').addEventListener('change', function () { $('[data-to]').hidden = sendToMe(); refreshSummary(); });
    $('#loot-custom').addEventListener('focus', function () { $('#a-custom').checked = true; refreshSummary(); });
    $('#loot-custom').addEventListener('input', function () { $('#a-custom').checked = true; refreshCustomCard(); });
    form.addEventListener('input', function (ev) {
      refreshSummary();
      if (ev.target.classList) ev.target.classList.remove('is-error');
      if (pay.checkout && !ev.target.closest('[data-paybox]') && payKey() !== pay.key) resetPayment('You changed something, so press Continue to payment again.');
    });
    form.addEventListener('change', function () { refreshSummary(); if (pay.checkout && payKey() !== pay.key) resetPayment('You changed something, so press Continue to payment again.'); });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (pay.checkout && pay.actions && pay.key === payKey()) { confirmPayment(); return; }
      if (!check()) return;
      openPayment();
    });
    refreshCustomCard(); refreshSummary();
    tsRender();
  }

  function show(which, note) {
    $('[data-loot-loading]').hidden = true;
    $('[data-loot-open]').hidden = which !== 'open';
    $('[data-loot-closed]').hidden = which === 'open';
    if (which !== 'open') $('[data-closed-text]').textContent = note;
    if (which === 'open') setup();
  }

  document.addEventListener('DOMContentLoaded', function () {
    noteSource();
    if (!html.classList.contains('till-open')) { show('closed', 'Poof Loot goes on sale when the shop opens on 4 January 2027.'); return; }
    fetch('/v1/giftcard/config').then(function (r) { return r.json(); }).then(function (c) {
      if (!c || !c.on) show('closed', 'Poof Loot is coming soon.');
      else if (!c.available) show('closed', 'Poof Loot is for Australian readers for now.');
      else show('open');
    }).catch(function () { show('closed', 'Poof Loot isn\'t available just now. Please try again later.'); });
  });
})();
