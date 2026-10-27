/* Poof Books: quick search ("I know what I want").
   Markup: <div class="quick-search" data-quick-search></div>  (built out here; can appear more than once)
   Index:  /assets/data/search.json, built from the database (works with a page on the site).
   Titles and author names match loosely: any order, partial words, small typos ("surender", "purvs").
   ISBNs match exactly: 13 digits, or an old 10-digit ISBN, with or without hyphens/spaces.
   Results show to the right of the box when there's room, otherwise underneath. */
(function () {
  'use strict';
  var INDEX_URL = '/assets/data/search.json';
  var MAX = 8;
  var STOP = { the: 1, a: 1, an: 1, of: 1, and: 1, by: 1, in: 1 };
  var index = null, loading = null, uid = 0;

  function norm(s) {
    return (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function words(s) { var n = norm(s); return n ? n.split(' ') : []; }

  // Edit distance with an early exit once it exceeds max.
  function dist(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i]; var best = i;
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }
  function allow(len) { return len >= 8 ? 2 : len >= 4 ? 1 : 0; }

  // How well one query word matches a list of words: 0 = not at all.
  function wordScore(q, list) {
    var best = 0, k = allow(q.length);
    for (var i = 0; i < list.length; i++) {
      var w = list[i], s = 0;
      if (w === q) s = 3;
      else if (w.indexOf(q) === 0) s = 2.4;
      else if (q.length >= 3 && w.indexOf(q) > 0) s = 1.4;
      else if (k) {
        if (dist(q, w, k) <= k) s = 1.6;
        else if (w.length > q.length && dist(q, w.slice(0, q.length), k) <= k) s = 1.2;  // typo in a partly typed word
      }
      if (s > best) best = s;
    }
    return best;
  }

  function isbn13(raw) {
    var d = raw.replace(/[\s-]/g, '').toUpperCase();
    if (/^97[89]\d{10}$/.test(d)) return d;
    if (/^\d{9}[\dX]$/.test(d)) {                   // ISBN-10 -> ISBN-13
      var core = '978' + d.slice(0, 9), sum = 0;
      for (var i = 0; i < 12; i++) sum += (+core[i]) * (i % 2 ? 3 : 1);
      return core + ((10 - sum % 10) % 10);
    }
    return null;
  }
  function looksLikeIsbn(raw) { return /^[\d\s-]*\d[\d\s-]*[xX]?$/.test(raw.trim()) && raw.replace(/\D/g, '').length >= 4; }

  function search(raw) {
    var works = index.works, res = [];
    if (looksLikeIsbn(raw)) {
      var code = isbn13(raw);
      if (!code) return { isbn: 'partial' };
      works.forEach(function (w) { if (w.i.indexOf(code) > -1) res.push({ w: w, score: 10 }); });
      return { isbn: code, list: res };
    }
    var qs = words(raw).filter(function (x) { return !STOP[x]; });
    if (!qs.length) return { list: [] };
    works.forEach(function (w) {
      if (!w._t) { w._t = words(w.t + ' ' + (w.s || '')); w._n = words(w.n.join(' ')); }
      var total = 0;
      for (var i = 0; i < qs.length; i++) {
        var s = Math.max(wordScore(qs[i], w._t) * 1.15, wordScore(qs[i], w._n));
        if (!s) return;                             // every word must match something
        total += s;
      }
      res.push({ w: w, score: total });
    });
    res.sort(function (a, b) { return b.score - a.score || a.w.t.localeCompare(b.w.t); });
    return { list: res.slice(0, MAX) };
  }

  function load() {
    if (index) return Promise.resolve(index);
    if (!loading) loading = fetch(INDEX_URL, { cache: 'no-cache' }).then(function (r) { return r.json(); })
      .then(function (j) { index = j; return j; });
    return loading;
  }

  function esc(s) { return (s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function build(box) {
    var n = ++uid, inputId = 'qs-in-' + n, listId = 'qs-list-' + n;
    box.innerHTML =
      '<label class="qs-label" for="' + inputId + '">Know what you want?</label>' +
      '<div class="qs-field"><svg class="qs-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
      '<input id="' + inputId + '" type="search" placeholder="Title, author or ISBN" autocomplete="off" spellcheck="false" enterkeyhint="go" ' +
      'role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="' + listId + '"></div>' +
      '<div class="qs-panel" hidden><ul class="qs-list" id="' + listId + '" role="listbox" aria-label="Matching books"></ul><p class="qs-msg" aria-live="polite"></p></div>';
    var input = box.querySelector('input'), panel = box.querySelector('.qs-panel'),
        list = box.querySelector('.qs-list'), msg = box.querySelector('.qs-msg'), active = -1, items = [];

    function place() {
      var r = box.getBoundingClientRect(), room = box.closest('.room');
      var side = window.innerWidth >= 900 && r.right + 16 + 320 <= document.documentElement.clientWidth - 12;
      panel.classList.toggle('side', side);
      if (room) {
        var top = side ? r.top : input.getBoundingClientRect().bottom + 8;
        var avail = room.getBoundingClientRect().bottom - top - 16;
        panel.style.maxHeight = Math.max(160, Math.floor(avail)) + 'px';
      } else panel.style.maxHeight = '';
    }
    function open(o) {
      panel.hidden = !o; input.setAttribute('aria-expanded', o ? 'true' : 'false');
      if (o) place();
    }
    function setActive(i) {
      active = i;
      items.forEach(function (el, k) { el.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
      if (i > -1 && items[i]) { input.setAttribute('aria-activedescendant', items[i].id); items[i].scrollIntoView({ block: 'nearest' }); }
      else input.removeAttribute('aria-activedescendant');
    }
    function render() {
      var raw = input.value;
      if (!raw.trim()) { list.innerHTML = ''; items = []; open(false); return; }
      load().then(function () {
        if (input.value !== raw) return;              // typed on; a newer render will follow
        var r = search(raw);
        list.innerHTML = ''; items = []; msg.textContent = '';
        if (r.isbn === 'partial') { msg.textContent = 'Keep going: an ISBN has 13 digits (or 10 on older books).'; open(true); return; }
        r.list.forEach(function (x, k) {
          var w = x.w, li = document.createElement('li');
          li.id = list.id + '-' + k; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', 'false');
          li.innerHTML = '<a href="' + w.u + '" tabindex="-1">' +
            (w.c ? '<img src="' + esc(w.c) + '" alt="" width="40" height="60" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'qs-nocover\'}))">' : '<span class="qs-nocover"></span>') +
            '<span class="qs-text"><b>' + esc(w.t) + '</b><span>' + esc(w.a.join(', ')) + (w.y ? ' · ' + w.y : '') + '</span>' +
            (r.isbn ? '<small>ISBN ' + r.isbn + '</small>' : '') + '</span></a>';
          list.appendChild(li); items.push(li);
        });
        if (!items.length) msg.textContent = r.isbn ? 'No book with ISBN ' + r.isbn + ' on our shelves yet.'
          : 'Nothing on the shelves matches that. Check the spelling, or try just the author’s surname.';
        else msg.textContent = items.length === 1 ? '1 book. Press Enter to open it.' : items.length + ' books.';
        setActive(items.length ? 0 : -1);
        open(true);
      }).catch(function () { msg.textContent = 'Search isn’t available right now. Browse the shelves below.'; open(true); });
    }
    var t;
    input.addEventListener('input', function () { clearTimeout(t); t = setTimeout(render, 90); });
    input.addEventListener('focus', function () { load().catch(function () {}); if (input.value.trim()) render(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (panel.hidden) render(); else setActive(Math.min(items.length - 1, active + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(0, active - 1)); }
      else if (e.key === 'Enter') { if (active > -1 && items[active]) { e.preventDefault(); location.href = items[active].querySelector('a').href; } }
      else if (e.key === 'Escape') { if (!panel.hidden) { e.preventDefault(); open(false); } }
    });
    list.addEventListener('mousemove', function (e) { var li = e.target.closest('li'); if (li) setActive(items.indexOf(li)); });
    document.addEventListener('click', function (e) { if (!box.contains(e.target)) open(false); });
    window.addEventListener('resize', function () { if (!panel.hidden) place(); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-quick-search]').forEach(build);
  });
  // For testing in the console: PoofSearch.search('surender')
  window.PoofSearch = { search: function (q) { return load().then(function () { return search(q); }); } };
})();
