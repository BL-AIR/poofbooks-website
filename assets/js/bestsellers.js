/* Best Sellers box on The Cabin (Blair, 6 Nov 2026).
   Reads /assets/data/bestsellers.json (written by the site build from paid orders in D1):
   { months: [ { m: "2026-11", label: "November 2026", compiled: "2026-12-01", books: [ { t, a, u } ] (author a is in the file but not shown) } ] }, oldest first.
   Complete months only, compiled at the start of each month for the month before (Blair, 6 Nov 2026). Shows the latest month; the arrows step back and forward through earlier months. */
(function () {
  var box = document.getElementById('sellers');
  if (!box) return;
  var list = box.querySelector('.sellers-list'), empty = box.querySelector('.sellers-empty'),
      at = box.querySelector('.sellers-at'),
      prev = box.querySelector('[data-step="-1"]'), next = box.querySelector('[data-step="1"]');
  var months = [], i = 0;
  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function show() {
    var mo = months[i];
    if (!mo) { list.innerHTML = ''; at.textContent = ''; empty.hidden = false; prev.disabled = next.disabled = true; return; }
    at.textContent = mo.label;
    list.innerHTML = (mo.books || []).slice(0, 10).map(function (b, n) {
      return '<li><span class="rk">' + (n + 1) + '</span><a href="' + esc(b.u) + '">' + esc(b.t) + '</a></li>';   // no author here: the book page has it (Blair, 6 Nov)
    }).join('');
    if (!(mo.books && mo.books.length)) empty.textContent = 'No sales in ' + mo.label + '.';
    empty.hidden = !!(mo.books && mo.books.length);
    prev.disabled = i <= 0;
    next.disabled = i >= months.length - 1;
  }
  prev.addEventListener('click', function () { if (i > 0) { i--; show(); } });
  next.addEventListener('click', function () { if (i < months.length - 1) { i++; show(); } });
  fetch('/assets/data/bestsellers.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : { months: [] }; })
    .catch(function () { return { months: [] }; })
    .then(function (d) { months = d.months || []; i = months.length - 1; show(); });
})();
