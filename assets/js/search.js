/* Tiny stand-in for books with no cover in the quick search: shelf colour and symbol (15 Nov 2026). */
var POOF_SIC = {"faghetti-westerns": ["#8A4B1F", "<path d=\"M3 16c3 2.2 15 2.2 18 0\"/><path d=\"M6.5 15.5c0-5 1.3-8.5 3.3-8.5 1 0 1.4.8 2.2.8s1.2-.8 2.2-.8c2 0 3.3 3.5 3.3 8.5\"/>"], "rollicking-romances": ["#9C2846", "<circle cx=\"12\" cy=\"14\" r=\"6.5\"/><path d=\"M9.5 7.8 10 5l2 1.6L14 5l.5 2.8\"/>"], "conniving-crimes": ["#4F5B6E", "<circle cx=\"10\" cy=\"10\" r=\"6\"/><path d=\"m14.5 14.5 6 6\"/>"], "exquisite-erotica": ["#8A2A5E", "<path d=\"M19.5 4.5C11 5 6 10.5 5 19.5c7-1 12.5-6 14.5-15Z\"/><path d=\"m5 19.5 8.5-8.5\"/>"], "fabulous-fables": ["#2F5634", "<path d=\"M3.5 12.5a8.5 6.5 0 0 1 17 0Z\"/><path d=\"M10 12.5v5.5a2 2 0 0 0 4 0v-5.5\"/><circle cx=\"9\" cy=\"9.3\" r=\".8\"/><circle cx=\"14.5\" cy=\"8.4\" r=\".8\"/>"], "luminous-literature": ["#7A5A12", "<path d=\"M3 6.5c3-1 6-1 9 .8 3-1.8 6-1.8 9-.8V18c-3-1-6-1-9 .8-3-1.8-6-1.8-9-.8Z\"/><path d=\"M12 7.3v11.5\"/>"], "supernova-adventures": ["#135560", "<circle cx=\"12\" cy=\"12\" r=\"5.5\"/><g transform=\"rotate(-20 12 12)\"><path d=\"M2 12A10 3.2 0 0 1 7.28 9.18\"/><path d=\"M16.72 9.18A10 3.2 0 0 1 22 12\"/><path d=\"M2 12A10 3.2 0 0 0 22 12\"/></g>"], "no-nonsense-non-fiction": ["#36528C", "<path d=\"m2.5 9 9.5-4 9.5 4-9.5 4Z\"/><path d=\"M6.5 10.8v4.2c3 2 8 2 11 0v-4.2\"/><path d=\"M21.5 9v5\"/>"]};
function qsStandin(w) { var s = POOF_SIC[w.h] || ['#4A3D6E', '']; return '<span class="qs-nocover" style="background:' + s[0] + '">' + (s[1] ? '<svg viewBox="0 0 24 24" aria-hidden="true">' + s[1] + '</svg>' : '') + '</span>'; }
/* Poof Books: quick search ("I know what I want").
   Markup: <div class="quick-search" data-quick-search></div>  (built out here; can appear more than once)
   Index:  /assets/data/search.json, built from the database (works with a page on the site).
   Titles and author names match loosely: any order, partial words, small typos ("surender", "purvs").
   ISBNs narrow as you type from 4 digits (matching the start of an ISBN-13, or of an old ISBN-10);
   a complete 13- or 10-digit ISBN matches exactly. Hyphens and spaces are ignored.
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
      if (code) {                                   // a complete ISBN: exact match
        works.forEach(function (w) { if (w.i.indexOf(code) > -1) res.push({ w: w, score: 10, isbn: code }); });
        if (res.length || code.length === raw.replace(/[\s-]/g, '').length) return { isbn: code, list: res };
      }                                             // 10 digits with no ISBN-10 match may be the start of an ISBN-13
      // Partly typed (4+ digits): narrow on how the ISBN starts, as ISBN-13 or as an old ISBN-10.
      var d = raw.replace(/\D/g, '');
      works.forEach(function (w) {
        for (var i = 0; i < w.i.length; i++) {
          var e = w.i[i];
          if (e.indexOf(d) === 0 || (e.indexOf('978') === 0 && e.slice(3).indexOf(d) === 0)) { res.push({ w: w, score: 5, isbn: e }); return; }
        }
      });
      res.sort(function (a, b) { return a.isbn.localeCompare(b.isbn); });
      return { isbn: 'partial', digits: d, more: res.length > MAX, list: res.slice(0, MAX) };
    }
    var qs = words(raw).filter(function (x) { return !STOP[x]; });
    if (!qs.length) return { list: [] };
    works.forEach(function (w) {
      if (!w._t) { w._t = words(w.t + ' ' + (w.s || '')); w._n = words(w.n.join(' ')); }
      var total = 0, byT = 0, byN = 0;
      for (var i = 0; i < qs.length; i++) {
        var st = wordScore(qs[i], w._t) * 1.15, sn = wordScore(qs[i], w._n), s = Math.max(st, sn);
        if (!s) return;                             // every word must match something
        total += s; if (st >= sn) byT++; else byN++;
      }
      res.push({ w: w, score: total, by: byT && byN ? 'title_author' : byN ? 'author' : 'title' });
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
        r.list.forEach(function (x, k) {
          var w = x.w, li = document.createElement('li');
          li.id = list.id + '-' + k; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', 'false');
          li.innerHTML = '<a href="' + w.u + '" tabindex="-1">' +
            (w.c ? '<img src="' + esc(w.c) + '" alt="" width="40" height="60" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'qs-nocover\'}))">' : qsStandin(w)) +
            '<span class="qs-text"><b>' + esc(w.t) + '</b><span>' + esc(w.a.join(', ')) + (w.y ? ' · ' + w.y : '') + '</span>' +
            (x.isbn ? '<small>ISBN ' + x.isbn + '</small>' : '') + '</span></a>';
          list.appendChild(li); items.push(li);
        });
        if (r.isbn === 'partial') msg.textContent = !items.length ? 'No ISBN on our shelves starts with ' + r.digits + '.'
          : r.more ? 'First ' + items.length + ' matches. Keep typing the ISBN to narrow them.'
          : items.length === 1 ? '1 book. Press Enter to open it.' : items.length + ' books.';
        else if (!items.length) {
          msg.textContent = r.isbn ? 'No book with ISBN ' + r.isbn + ' on our shelves yet. '
            : 'Nothing on the shelves matches that. Check the spelling, or try just the author’s surname. ';
          // Not on our shelves doesn't mean we can't get it: hand the search to Detective Dick.
          var cs = document.createElement('a');
          cs.className = 'qs-case'; cs.href = '/open-a-case/?q=' + encodeURIComponent(raw.trim());
          cs.textContent = 'Open a Case';
          cs.addEventListener('click', function () { if (window.dataLayer) dataLayer.push({ event: 'open_a_case_click', search_term: raw.trim(), search_kind: r.isbn ? 'isbn' : 'text' }); });
          msg.appendChild(cs);
        }
        else msg.textContent = items.length === 1 ? '1 book. Press Enter to open it.' : items.length + ' books.';
        setActive(items.length ? 0 : -1);
        open(true);
        if (window.PoofTrack) PoofTrack.quickSearch(raw, looksLikeIsbn(raw) || r.isbn ? 'isbn' : r.list.length ? r.list[0].by || 'title' : 'none', items.length);
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
    // "Open a Case" link style lives here, so section.css (on every page) needn't change.
    var st = document.createElement('style');
    st.textContent = '.qs-msg .qs-case{display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:7px 14px;border-radius:999px;background:var(--pink);color:var(--on-pink,#18122B);font-weight:700;font-size:13px;text-decoration:none}' +
      '.qs-msg .qs-case:hover{background:var(--lilac)}.qs-msg .qs-case:focus-visible{outline:3px solid var(--lilac);outline-offset:2px}' +
      '.qs-msg .qs-case::before{content:"";width:14px;height:14px;background:currentColor;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Ccircle cx=%2710%27 cy=%2710%27 r=%276.5%27 fill=%27none%27 stroke=%27black%27 stroke-width=%272.5%27/%3E%3Cpath d=%27M15 15l6 6%27 stroke=%27black%27 stroke-width=%272.8%27 stroke-linecap=%27round%27/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Ccircle cx=%2710%27 cy=%2710%27 r=%276.5%27 fill=%27none%27 stroke=%27black%27 stroke-width=%272.5%27/%3E%3Cpath d=%27M15 15l6 6%27 stroke=%27black%27 stroke-width=%272.8%27 stroke-linecap=%27round%27/%3E%3C/svg%3E") center/contain no-repeat}';
    document.head.appendChild(st);
    document.querySelectorAll('[data-quick-search]').forEach(build);
  });
  // For testing in the console: PoofSearch.search('surender')
  window.PoofSearch = { search: function (q) { return load().then(function () { return search(q); }); } };
})();
