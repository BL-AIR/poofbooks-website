/* Poof Books: one-time content notice for the explicit shelf (self-declaration, not verification). */
document.addEventListener('DOMContentLoaded', function () {
  var root = document.documentElement;
  var gate = document.getElementById('gate');
  if (!gate || root.classList.contains('gate-pass')) return;
  root.classList.add('gate-open');
  var yes = gate.querySelector('[data-gate="yes"]');
  if (yes) {
    yes.focus();
    yes.addEventListener('click', function () {
      try { localStorage.setItem('poof-adult', 'yes'); } catch (e) {}
      root.classList.add('gate-pass');
      root.classList.remove('gate-open');
      if (window.dataLayer) window.dataLayer.push({ event: 'adult_gate_accepted' });
    });
  }
  var no = gate.querySelector('[data-gate="no"]');
  if (no && document.referrer && new URL(document.referrer).origin === location.origin) {
    no.addEventListener('click', function (ev) { ev.preventDefault(); history.back(); });
  }
  gate.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Tab') return;
    var f = gate.querySelectorAll('button, a');
    var first = f[0], last = f[f.length - 1];
    if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
  });
});
