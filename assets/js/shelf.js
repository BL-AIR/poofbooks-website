/* Poof Books: sort and filter "On the shelf".
   Works on the book cards already in the page (data-* attributes), so it needs no server.
   The current choice is kept in the address bar, so a filtered shelf can be bookmarked or shared,
   e.g. /conniving-crimes/?set=Australia&from=2024 */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var form = document.querySelector('.shelf-tools');
    if (!form) return;
    var grid = document.querySelector('.shelf .books');
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.book'));
    var countEl = document.querySelector('.shelf-count');
    var noMatch = document.querySelector('.shelf .no-match');
    var panel = form.querySelector('.filters');
    var toggle = form.querySelector('.toggle');
    var badge = toggle.querySelector('.n');
    var MIN = +form.dataset.min, MAX = +form.dataset.max;
    var from = form.elements.from, to = form.elements.to;
    var range = form.querySelector('.range');
    var thisYear = new Date().getFullYear();

    cards.forEach(function (c, i) {
      c._i = i;
      c._title = (c.dataset.title || '').toLowerCase();
      c._author = (c.dataset.author || '').toLowerCase();
      c._date = c.dataset.date || '';
      c._year = c._date ? +c._date.slice(0, 4) : null;
      c._places = c.dataset.places ? c.dataset.places.split('|') : [];
      c._formats = c.dataset.formats ? c.dataset.formats.split('|') : [];
      c._subjects = c.dataset.subjects ? c.dataset.subjects.split('|') : [];
      // Author's pronouns: He, She or They. A collaboration lists each author's, e.g. "He|She";
      // if they differ the book counts as Mixed only (so ticking He never brings in a co-written-with-a-woman book).
      // Co-authors who share pronouns ("He|He") count as that one. Blank = Not stated.
      var pr = c.dataset.pronouns ? c.dataset.pronouns.split('|').filter(function (v, i, a) { return v && a.indexOf(v) === i; }) : [];
      c._pronouns = !pr.length ? ['Not stated'] : pr.length > 1 ? ['Mixed'] : pr;
      c._price = c.dataset.price ? parseFloat(c.dataset.price) : Infinity;
      c._pick = c.dataset.pick === '1';
    });

    // Every chip starts ticked, so the whole shelf shows; the reader unticks what he doesn't want.
    // A book stays on show if any of its values is still ticked (a book with no value for a group is never hidden by it).
    // Chips come from what's actually on the shelf, most common first.
    // A fixed list (e.g. pronouns) is always shown in that order, even where a value has no books yet.
    var GROUPS = [['places', 'set'], ['formats', 'fmt'], ['subjects', 'sub'], ['pronouns', 'pr']];
    var built = {}; // groups this shelf actually shows; the rest are ignored
    function buildChips(key, name, fixed) {
      var box = form.querySelector('[data-chips="' + key + '"]');
      if (!box) return;
      built[key] = true;
      var tally = {};
      cards.forEach(function (c) { c['_' + key].forEach(function (v) { tally[v] = (tally[v] || 0) + 1; }); });
      var vals = fixed || Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a] || a.localeCompare(b); });
      if (!vals.length) { box.closest('fieldset').hidden = true; return; }
      vals.forEach(function (v) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'chip'; b.setAttribute('aria-pressed', 'true');
        b.dataset.key = name; b.dataset.val = v;
        b.innerHTML = '<span></span><small></small>';
        b.firstChild.textContent = v; b.lastChild.textContent = tally[v] || 0;
        box.appendChild(b);
      });
      var all = document.createElement('button');
      all.type = 'button'; all.className = 'chip-all'; all.dataset.key = name;
      box.closest('fieldset').querySelector('legend').appendChild(all);
    }
    function paintAll() {
      form.querySelectorAll('.chip-all').forEach(function (a) {
        var off = form.querySelectorAll('.chip[data-key="' + a.dataset.key + '"][aria-pressed="false"]').length;
        a.textContent = off ? 'All' : 'None';
        a.setAttribute('aria-label', (off ? 'Tick all ' : 'Untick all ') + a.closest('fieldset').querySelector('legend').firstChild.textContent.trim());
      });
    }
    buildChips('places', 'set');
    buildChips('formats', 'fmt');
    buildChips('subjects', 'sub');
    buildChips('pronouns', 'pr', ['He', 'She', 'They', 'Mixed', 'Not stated']);

    function chosen(name) {
      return Array.prototype.map.call(form.querySelectorAll('.chip[data-key="' + name + '"][aria-pressed="true"]'), function (b) { return b.dataset.val; });
    }
    function unticked(name) {
      return Array.prototype.map.call(form.querySelectorAll('.chip[data-key="' + name + '"][aria-pressed="false"]'), function (b) { return b.dataset.val; });
    }
    function paintRange() {
      var span = (MAX - MIN) || 1;
      range.style.setProperty('--lo', ((+from.value - MIN) / span * 100) + '%');
      range.style.setProperty('--hi', ((+to.value - MIN) / span * 100) + '%');
      form.querySelector('[data-out="from"]').textContent = from.value;
      form.querySelector('[data-out="to"]').textContent = to.value;
      form.querySelectorAll('.presets button').forEach(function (b) {
        var n = +b.dataset.years;
        var on = n === 0 ? (+from.value === MIN && +to.value === MAX) : (+from.value === Math.max(MIN, thisYear - n + 1) && +to.value === MAX);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    function apply(push) {
      var q = form.elements.q.value.trim().toLowerCase();
      var lo = +from.value, hi = +to.value;
      var on = {}, off = {}, offCount = 0;
      GROUPS.forEach(function (g) { on[g[0]] = chosen(g[1]); off[g[1]] = unticked(g[1]); offCount += off[g[1]].length; });
      var dateOn = lo > MIN || hi < MAX;
      var shown = 0;
      cards.forEach(function (c) {
        var ok = (!q || c._title.indexOf(q) > -1 || c._author.indexOf(q) > -1) &&
          (!dateOn || (c._year !== null && c._year >= lo && c._year <= hi)) &&
          GROUPS.every(function (g) {
            var mine = c['_' + g[0]];
            return !built[g[0]] || !mine.length || mine.some(function (v) { return on[g[0]].indexOf(v) > -1; });
          });
        c.hidden = !ok;
        if (ok) shown++;
      });
      var sort = form.elements.sort.value;
      var by = {
        newest: function (a, b) { return (b._date || '').localeCompare(a._date || '') || a._i - b._i; },
        oldest: function (a, b) { return (a._date || '9999').localeCompare(b._date || '9999') || a._i - b._i; },
        title: function (a, b) { return a._title.localeCompare(b._title); },
        author: function (a, b) { return a._author.localeCompare(b._author) || a._title.localeCompare(b._title); },
        price: function (a, b) { return a._price - b._price || a._title.localeCompare(b._title); },
        pick: function (a, b) { return (b._pick - a._pick) || (b._date || '').localeCompare(a._date || ''); }
      }[sort] || null;
      cards.slice().sort(by).forEach(function (c) { grid.appendChild(c); });

      var active = (dateOn ? 1 : 0) + offCount;
      paintAll();
      badge.hidden = !active; badge.textContent = active;
      countEl.textContent = shown === cards.length ? cards.length + (cards.length === 1 ? ' book' : ' books')
        : shown + ' of ' + cards.length + ' books';
      noMatch.hidden = shown > 0;

      if (push) {
        var p = new URLSearchParams();
        if (q) p.set('q', q);
        if (sort !== 'newest') p.set('sort', sort);
        if (lo > MIN) p.set('from', lo);
        if (hi < MAX) p.set('to', hi);
        // The address bar records what has been unticked, e.g. ?not-pr=She,Mixed
        GROUPS.forEach(function (g) { if (off[g[1]].length) p.set('not-' + g[1], off[g[1]].join(',')); });
        var qs = p.toString();
        history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
      }
    }

    // Restore from the address bar.
    var p = new URLSearchParams(location.search);
    if (p.get('q')) form.elements.q.value = p.get('q');
    if (p.get('sort')) form.elements.sort.value = p.get('sort');
    if (p.get('from')) from.value = Math.max(MIN, Math.min(MAX, +p.get('from')));
    if (p.get('to')) to.value = Math.max(MIN, Math.min(MAX, +p.get('to')));
    var restored = false;
    GROUPS.forEach(function (g) {
      (p.get('not-' + g[1]) || '').split(',').filter(Boolean).forEach(function (v) {
        var b = form.querySelector('.chip[data-key="' + g[1] + '"][data-val="' + CSS.escape(v) + '"]');
        if (b) { b.setAttribute('aria-pressed', 'false'); restored = true; }
      });
    });
    if (p.get('from') || p.get('to') || restored) { panel.hidden = false; toggle.setAttribute('aria-expanded', 'true'); }

    toggle.addEventListener('click', function () {
      panel.hidden = !panel.hidden;
      toggle.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
    });
    form.addEventListener('submit', function (ev) { ev.preventDefault(); });
    form.elements.q.addEventListener('input', function () { apply(true); });
    form.elements.sort.addEventListener('change', function () { apply(true); });
    from.addEventListener('input', function () { if (+from.value > +to.value) from.value = to.value; paintRange(); apply(true); });
    to.addEventListener('input', function () { if (+to.value < +from.value) to.value = from.value; paintRange(); apply(true); });
    form.querySelectorAll('.presets button').forEach(function (b) {
      b.addEventListener('click', function () {
        var n = +b.dataset.years;
        from.value = n === 0 ? MIN : Math.max(MIN, thisYear - n + 1);
        to.value = MAX;
        paintRange(); apply(true);
      });
    });
    // The little (i): opens on hover or focus on a computer, on tap on a phone, and stays put
    // while the pointer is over the note so the email link can be clicked.
    form.querySelectorAll('.tip').forEach(function (box) {
      var btn = box.querySelector('.tip-btn');
      function set(open) { box.classList.toggle('open', open); btn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
      btn.addEventListener('click', function (ev) { set(ev.pointerType === 'mouse' || !box.classList.contains('open')); });
      box.addEventListener('pointerenter', function (ev) { if (ev.pointerType === 'mouse') set(true); });
      box.addEventListener('pointerleave', function (ev) { if (ev.pointerType === 'mouse') set(false); });
      document.addEventListener('click', function (ev) { if (!box.contains(ev.target)) set(false); });
      box.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { set(false); btn.focus(); } });
    });
    form.addEventListener('click', function (ev) {
      var all = ev.target.closest('.chip-all');
      if (all) {
        var chips = form.querySelectorAll('.chip[data-key="' + all.dataset.key + '"]');
        var anyOff = Array.prototype.some.call(chips, function (b) { return b.getAttribute('aria-pressed') === 'false'; });
        chips.forEach(function (b) { b.setAttribute('aria-pressed', anyOff ? 'true' : 'false'); });
        apply(true); return;
      }
      var chip = ev.target.closest('.chip');
      if (!chip) return;
      chip.setAttribute('aria-pressed', chip.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      apply(true);
    });
    function clearAll() {
      form.elements.q.value = '';
      from.value = MIN; to.value = MAX;
      form.querySelectorAll('.chip').forEach(function (b) { b.setAttribute('aria-pressed', 'true'); });
      paintRange(); apply(true);
    }
    form.addEventListener('reset', function (ev) { ev.preventDefault(); clearAll(); });
    var clr = document.querySelector('.shelf [data-clear]');
    if (clr) clr.addEventListener('click', clearAll);

    paintRange();
    apply(false);
  });
})();
