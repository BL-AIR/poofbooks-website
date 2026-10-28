/* Poof Books: book page buying. Buy adds that edition to the cart (cart.js / PoofCart);
   the (i) beside a format shows its measurements on hover, focus or tap. */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var go = document.querySelector('[data-go-checkout]');
    if (go && window.PoofCart && PoofCart.count() > 0) go.hidden = false;

    document.querySelectorAll('[data-buy]').forEach(function (b) {
      var label = b.textContent, t = null;
      b.addEventListener('click', function () {
        if (!window.PoofCart) return;
        PoofCart.add(b.getAttribute('data-buy'), 1);
        b.textContent = 'Added ✓'; b.classList.add('added');
        if (go) go.hidden = false;
        clearTimeout(t);
        t = setTimeout(function () { b.textContent = label; b.classList.remove('added'); }, 2200);
      });
    });

    // (i) size pop-ups: open on hover or keyboard focus; a tap (touch screens) pins it open until tapped again or Escape.
    var openOne = null;
    function show(btn, on) {
      var pop = document.getElementById(btn.getAttribute('aria-controls'));
      if (!pop) return;
      pop.hidden = !on; btn.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (on && openOne && openOne !== btn) show(openOne, false);
      openOne = on ? btn : (openOne === btn ? null : openOne);
    }
    document.querySelectorAll('.dim-i').forEach(function (btn) {
      btn.addEventListener('mouseenter', function () { show(btn, true); });
      btn.addEventListener('mouseleave', function () { if (!btn.dataset.pinned) show(btn, false); });
      btn.addEventListener('focus', function () { show(btn, true); });
      btn.addEventListener('blur', function () { delete btn.dataset.pinned; show(btn, false); });
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var on = btn.getAttribute('aria-expanded') !== 'true' || !btn.dataset.pinned;
        if (on) btn.dataset.pinned = '1'; else delete btn.dataset.pinned;
        show(btn, on);
      });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openOne) { delete openOne.dataset.pinned; show(openOne, false); } });
  });
})();
