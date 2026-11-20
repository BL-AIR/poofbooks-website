/* The Cabin's Top Tens (Blair, 20 Nov 2026; replaces bestsellers.js on the Cabin).
   One box, several lists. Both arrow rows sit at the bottom so the three Cabin boxes' headings line up (Blair, 11:50):
   first the list arrows ("List 1 of 3"; cycle Best Sellers -> Most Viewed -> Big Daddy's Top Ten Picks, wrapping round),
   then the month arrows (that list's complete months; hidden for picks, which have no month).
   Data: the catalogue API /v1/top-tens ({ lists: [ { key, name, months: [ { m, label, books: [ { t, u } ] } ] } ] }), titles and
   links only. Best Sellers always comes first and keeps its "first Top Ten" message; any other list with no books is left out.
   A new list needs only an entry in TAGS (and the API's TOP_TENS), no layout work.
   If the API can't be reached, Best Sellers falls back to /assets/data/bestsellers.json. ?demo=top-tens reads the test fixture. */
(function () {
  var box = document.getElementById('sellers');
  if (!box) return;
  var API = 'https://poofbooks-api.big--daddy.workers.dev/v1/top-tens';
  // Box headings: one line each, no month (Blair, 11:54-11:55). Overrides the API's name so the website doesn't wait on the Worker.
  var NAMES = { 'best-sellers': 'Best Sellers', 'most-viewed': 'Most Viewed', 'picks-bigdaddy': 'Big Daddy\u2019s Top 10' };
  var TAGS = {
    'best-sellers': 'Look which poof books made last month’s Top Ten Sellers List.',
    'most-viewed': 'The ten book pages poof readers looked at most last month.',
    'picks-bigdaddy': 'Ten books Big Daddy would press into your hands.'
  };
  var h = box.querySelector('#sellers-h'), tag = box.querySelector('.sellers-tag'),
      list = box.querySelector('.sellers-list'), empty = box.querySelector('.sellers-empty'),
      firstMsg = empty.textContent,
      mNav = box.querySelector('.sellers-nav'), at = box.querySelector('.sellers-at'),
      mPrev = mNav.querySelector('[data-step="-1"]'), mNext = mNav.querySelector('[data-step="1"]'),
      lNav = box.querySelector('.topten-nav'), lAt = box.querySelector('.topten-at'),
      lPrev = lNav.querySelector('[data-list="-1"]'), lNext = lNav.querySelector('[data-list="1"]'),
      live = box.querySelector('.topten-live'), body = box.querySelector('.topten-body');
  var lists = [], li = 0, mi = [];
  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function show(announce, dir) {
    var L = lists[li];
    if (!L) return;
    var mo = L.months[mi[li]];
    var title = NAMES[L.key] || L.name;   // one line, no month: the month shows in the arrows underneath (Blair, 11:54)
    h.textContent = title;
    tag.textContent = TAGS[L.key] || '';
    var books = (mo && mo.books) || [];
    list.innerHTML = books.slice(0, 10).map(function (b, n) {
      return '<li><span class="rk">' + (n + 1) + '</span><a href="' + esc(b.u) + '">' + esc(b.t) + '</a></li>';
    }).join('');
    empty.textContent = !mo ? firstMsg : 'No sales in ' + mo.label + '.';
    empty.hidden = books.length > 0;
    var dated = L.months.length && L.months[0].m;
    mNav.hidden = !dated;
    at.textContent = dated && mo ? mo.label : '';
    mPrev.disabled = !dated || mi[li] <= 0;
    mNext.disabled = !dated || mi[li] >= L.months.length - 1;
    lNav.hidden = lists.length < 2;
    lAt.textContent = 'List ' + (li + 1) + ' of ' + lists.length;
    if (announce) live.textContent = title + (mo && mo.label ? ', ' + mo.label : '') + ', list ' + (li + 1) + ' of ' + lists.length + '.';
    if (dir && document.documentElement.classList.contains('motion-on')) {
      body.classList.remove('slide-l', 'slide-r'); void body.offsetWidth;
      body.classList.add(dir > 0 ? 'slide-l' : 'slide-r');
    }
  }
  function stepList(d) { if (lists.length < 2) return; li = (li + d + lists.length) % lists.length; show(true, d); }
  function stepMonth(d) {
    var L = lists[li], j = mi[li] + d;
    if (L && j >= 0 && j < L.months.length) { mi[li] = j; show(true, 0); }
  }
  mPrev.addEventListener('click', function () { stepMonth(-1); });
  mNext.addEventListener('click', function () { stepMonth(1); });
  lPrev.addEventListener('click', function () { stepList(-1); });
  lNext.addEventListener('click', function () { stepList(1); });
  box.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); stepList(e.key === 'ArrowLeft' ? -1 : 1); }
  });
  var x0 = null, y0 = null;
  box.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  box.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) stepList(dx < 0 ? 1 : -1);
  }, { passive: true });
  function start(d) {
    lists = (d.lists || []).filter(function (L) {
      return L.key === 'best-sellers' || (L.months || []).some(function (mo) { return mo.books && mo.books.length; });
    });
    lists.sort(function (a, b) { return (b.key === 'best-sellers') - (a.key === 'best-sellers'); });
    mi = lists.map(function (L) { return Math.max(0, L.months.length - 1); });   // newest month of each list
    li = 0;
    show(false, 0);
  }
  function fallback() {
    return fetch('/assets/data/bestsellers.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : { months: [] }; })
      .catch(function () { return { months: [] }; })
      .then(function (j) { return { lists: [{ key: 'best-sellers', name: 'Best Sellers', months: j.months || [] }] }; });
  }
  var demo = /[?&]demo=top-tens\b/.test(location.search);
  fetch(demo ? '/assets/data/top-tens-fixture.json' : API, { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw r; return r.json(); })
    .catch(fallback)
    .then(start);
})();
