/* Poof Books: content notice for the explicit shelf (a self-declaration, not age verification).
   1. Any link into the shelf asks first, as a pop-up on the page you're on (e.g. the Cabin).
   2. Arriving at the shelf directly (bookmark, search) shows the notice across Eric, with the shelf hidden.
   The answer is remembered on this device. */
(function () {
  'use strict';
  var KEY = 'poof-adult';
  var GATED = /^\/exquisite-erotica\//;
  var root = document.documentElement;

  function ok() { try { return localStorage.getItem(KEY) === 'yes'; } catch (e) { return false; } }
  function accept() {
    try { localStorage.setItem(KEY, 'yes'); } catch (e) {}
    if (window.dataLayer) window.dataLayer.push({ event: 'adult_gate_accepted' });
  }
  function onCabin() { return /^\/the-cabin\//.test(location.pathname); }

  var modal = null, lastFocus = null;
  function buildModal() {
    var m = document.createElement('div');
    m.className = 'gate-modal';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.setAttribute('aria-labelledby', 'gate-m-h');
    m.innerHTML =
      '<div class="gate-card">' +
        '<p class="eyebrow">Exquisite Erotica</p>' +
        '<h2 id="gate-m-h">Before you go in</h2>' +
        '<p class="gate-p">The books on this shelf contain explicit sex, written for adults.</p>' +
        '<div class="gate-btns">' +
          '<button class="btn btn-primary" type="button" data-m="yes">I\'m an adult, come in</button>' +
          '<button class="btn btn-ghost" type="button" data-m="no"></button>' +
        '</div>' +
        '<p class="gate-note">We\'ll remember your answer on this device.</p>' +
      '</div>';
    document.body.appendChild(m);
    m.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { close(); return; }
      if (ev.key !== 'Tab') return;
      var f = m.querySelectorAll('button'), first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    });
    m.addEventListener('click', function (ev) { if (ev.target === m) close(); });
    return m;
  }
  function open(href) {
    if (!modal) modal = buildModal();
    lastFocus = document.activeElement;
    var onShelf = GATED.test(location.pathname);
    modal.querySelector('[data-m="no"]').textContent = (onCabin() || onShelf) ? 'Stay in the Cabin' : 'Stay here';
    modal.querySelector('[data-m="yes"]').onclick = function () { accept(); location.href = href; };
    modal.querySelector('[data-m="no"]').onclick = onShelf ? function () { location.href = '/the-cabin/'; } : close;
    root.classList.add('gate-modal-open');
    modal.hidden = false;
    modal.querySelector('[data-m="yes"]').focus();
  }
  function close() {
    if (!modal) return;
    modal.hidden = true;
    root.classList.remove('gate-modal-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  // 1. Ask before following any link into the shelf.
  document.addEventListener('click', function (ev) {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    var a = ev.target.closest && ev.target.closest('a[href]');
    if (!a) return;
    var url;
    try { url = new URL(a.getAttribute('href'), location.href); } catch (e) { return; }
    if (url.origin !== location.origin || !GATED.test(url.pathname)) return;
    if (GATED.test(location.pathname) || ok()) return;
    ev.preventDefault();
    open(url.href);
  });

  // 2. Direct arrival on the shelf.
  document.addEventListener('DOMContentLoaded', function () {
    if (!root.classList.contains('gate-page')) return;
    if (ok()) { root.classList.remove('gate-open'); root.classList.add('gate-pass'); return; }
    var bands = document.querySelectorAll('.gate-band');
    if (!bands.length) { open(location.href); return; }   // e.g. a book page on this shelf
    bands.forEach(function (band) {
      band.querySelector('[data-gate="yes"]').addEventListener('click', function () {
        accept();
        root.classList.remove('gate-open');
        root.classList.add('gate-pass');
      });
    });
    var visible = Array.prototype.find.call(bands, function (b) { return b.offsetParent !== null; });
    if (visible) visible.querySelector('[data-gate="yes"]').focus({ preventScroll: true });
  });
})();
