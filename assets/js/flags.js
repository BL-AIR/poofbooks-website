// Footer flags: show each flag's statement on hover, keyboard focus or tap (23 Nov 2026).
(function () {
  var flags = [].slice.call(document.querySelectorAll('.flag'));
  if (!flags.length) return;
  function place(f) {
    var tip = f.querySelector('.flag-tip'); if (!tip) return;
    tip.style.left = '50%'; tip.style.transform = 'translateX(-50%)';
    var r = tip.getBoundingClientRect(), m = 8, dx = 0;
    if (r.left < m) dx = m - r.left; else if (r.right > window.innerWidth - m) dx = window.innerWidth - m - r.right;
    if (dx) tip.style.transform = 'translateX(calc(-50% + ' + Math.round(dx) + 'px))';
  }
  function open(f) { flags.forEach(function (o) { if (o !== f) close(o); }); var t = f.querySelector('.flag-tip'); t.hidden = false; f.classList.add('open'); f.querySelector('button').setAttribute('aria-expanded', 'true'); place(f); }
  function close(f) { var t = f.querySelector('.flag-tip'); if (t) t.hidden = true; f.classList.remove('open'); var b = f.querySelector('button'); if (b) b.setAttribute('aria-expanded', 'false'); }
  flags.forEach(function (f) {
    var b = f.querySelector('button');
    f.addEventListener('mouseenter', function () { open(f); });
    f.addEventListener('mouseleave', function () { if (document.activeElement !== b) close(f); });
    b.addEventListener('focus', function () { open(f); });
    b.addEventListener('blur', function () { close(f); });
    b.addEventListener('click', function (e) { e.preventDefault(); if (f.classList.contains('open') && e.detail) { close(f); } else { open(f); } });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') flags.forEach(close); });
  document.addEventListener('click', function (e) { if (!e.target.closest('.flag')) flags.forEach(close); });
})();
