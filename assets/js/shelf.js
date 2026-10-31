/* Poof Books: sort and filter "On the shelf".
   Works on the book cards already in the page (data-* attributes), so it needs no server.
   The current choice is kept in the address bar, so a filtered shelf can be bookmarked or shared,
   e.g. /conniving-crimes/?set=Australia&from=2024

   Filters a shelf can carry (each is a fieldset in the page; one with no data on the shelf hides itself):
     Published in the last : slider + presets (data-years)            card: data-date="2026-10-15" (this edition)
                             data-first="1956" (first published, when earlier) wins for the slider and date sorts
     Reading time          : "up to" slider + presets (data-hours)     card: data-words="101441"
                             hours = words / the reader's pace (cog setting, view-settings.js) / 60
     Set during            : slider + era presets (fiction)           card: data-during="2010|2026" (years; BC as negative)
     Set during (sci-fi)   : chips  data-chips="eras"                 card: data-eras="Far future|Near future"
     Set in                : chips  data-chips="places"               card: data-places="Morocco|Germany" (countries)
                             Set in and Set during both offer "Not stated" for books whose description doesn't say (31 Oct 2026)
     Kind of book          : chips  data-chips="kinds" (non-fiction)  card: data-kinds="Memoir|History"
     Subject matter        : chips  data-chips="subjects"             card: data-subjects="AIDS|Activism"
     Format, Author's pronouns as before.
     Publisher             : three buttons Traditional / Both / Indie  card: data-pub="trad" or "indie"
                             (Blair, 31 Oct 2026: Traditional = the Big Five and their imprints; everyone else is Indie)
   A chips box may carry data-fixed="A|B|C" (always shown in that order, even at 0) or data-order="A|B|C"
   (only values on the shelf, in that order). Era definitions below must match the database's era table. */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var form = document.querySelector('.shelf-tools');
    if (!form) return;
    var grid = document.querySelector('.shelf .books');
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.book'));
    var countEl = document.querySelector('.shelf-count');
    var noMatch = document.querySelector('.shelf .no-match');
    // Paging: show about 25 books at a time (5 x 5 at five across), always whole rows, then "Show more".
    // Applied after filtering and sorting, so filters and sort work across the whole shelf.
    var PAGE = 25, pages = 1;
    var more = document.createElement('p');
    more.className = 'shelf-more'; more.hidden = true;
    more.innerHTML = '<button type="button" class="btn btn-ghost"></button>';
    grid.parentNode.insertBefore(more, grid.nextSibling);
    var moreBtn = more.firstChild;
    function perPage() {
      var cols = (getComputedStyle(grid).gridTemplateColumns || '').split(' ').filter(Boolean).length || 1;
      return cols * Math.max(1, Math.round(PAGE / cols));
    }
    function paginate() {
      var limit = perPage() * pages, n = 0, total = 0;
      cards.forEach(function (c) {
        if (c.hidden) { c.classList.remove('paged'); return; }
        total++;
        c.classList.toggle('paged', ++n > limit);
      });
      var left = total - Math.min(total, limit);
      more.hidden = left <= 0;
      var next = Math.min(left, perPage());
      moreBtn.textContent = 'Show ' + next + ' more';
      moreBtn.setAttribute('aria-label', 'Show ' + next + ' more books (' + left + ' not yet shown)');
      return Math.min(total, limit);
    }
    var panel = form.querySelector('.filters');
    var toggle = form.querySelector('.toggle');
    var badge = toggle.querySelector('.n');
    var MIN = +form.dataset.min, MAX = +form.dataset.max;
    var from = form.elements.from, to = form.elements.to;
    var range = form.querySelector('.range[data-range="published"]') || form.querySelector('.range');
    var thisYear = new Date().getFullYear();
    // Set during: eras, earliest first. Must match the database (table era).
    var ERAS = [
      { label: 'Ancient world', from: -3000, to: 499 },
      { label: 'Before 1800', from: 500, to: 1799 },
      { label: '1800s', from: 1800, to: 1899 },
      { label: '1900\u20131945', from: 1900, to: 1945 },
      { label: 'Post-war', from: 1945, to: 1969 },
      { label: 'Stonewall to AIDS', from: 1969, to: 1981 },
      { label: 'The AIDS years', from: 1981, to: 1996 },
      { label: '1997 to now', from: 1997, to: 9999 }   // open-ended, like the database (to_year NULL)
    ];
    function yr(n) { n = +n; return n < 0 ? (-n) + ' BC' : String(n); }

    cards.forEach(function (c, i) {
      c._i = i;
      c._title = (c.dataset.title || '').toLowerCase();
      c._author = (c.dataset.author || '').toLowerCase();
      // First published (data-first, a year) beats this edition's date: Giovanni's Room is a 1956 book, not a 2004 one.
      c._date = c.dataset.first ? c.dataset.first + '-00-00' : (c.dataset.date || '');
      c._year = c._date ? +c._date.slice(0, 4) : null;
      c._places = c.dataset.places ? c.dataset.places.split('|') : ['Not stated'];
      c._formats = c.dataset.formats ? c.dataset.formats.split('|') : [];
      c._subjects = c.dataset.subjects ? c.dataset.subjects.split('|') : [];
      c._eras = c.dataset.eras ? c.dataset.eras.split('|') : [];
      c._kinds = c.dataset.kinds ? c.dataset.kinds.split('|') : [];
      var dur = (c.dataset.during || '').split('|');
      c._dFrom = dur[0] !== '' && dur.length === 2 ? +dur[0] : null;
      c._dTo = c._dFrom !== null ? +dur[1] : null;   // may be in the future (near-future settings)
      // Author's pronouns: He, She or They. A collaboration lists each author's, e.g. "He|She";
      // if they differ the book counts as Mixed only (so ticking He never brings in a co-written-with-a-woman book).
      // Co-authors who share pronouns ("He|He") count as that one. Blank = Not stated.
      var pr = c.dataset.pronouns ? c.dataset.pronouns.split('|').filter(function (v, i, a) { return v && a.indexOf(v) === i; }) : [];
      c._pronouns = !pr.length ? ['Not stated'] : pr.length > 1 ? ['Mixed'] : pr;
      c._words = c.dataset.words ? +c.dataset.words : null;
      c._price = c.dataset.price ? parseFloat(c.dataset.price) : Infinity;
      c._pick = c.dataset.pick === '1';
      c._nocover = c.dataset.nocover === '1' ? 1 : 0;
      c._pub = c.dataset.pub || '';   // books with no cover art sit at the bottom, whatever the sort (Blair, 30 Oct 2026)
    });

    // Every chip starts ticked, so the whole shelf shows; the reader unticks what he doesn't want.
    // A book stays on show if any of its values is still ticked (a book with no value for a group is never hidden by it).
    // Chips come from what's actually on the shelf, most common first.
    // A fixed list (e.g. pronouns) is always shown in that order, even where a value has no books yet.
    var GROUPS = [['eras', 'era'], ['places', 'set'], ['kinds', 'kind'], ['formats', 'fmt'], ['subjects', 'sub'], ['pronouns', 'pr']];
    var built = {}; // groups this shelf actually shows; the rest are ignored
    function buildChips(key, name, fixed) {
      var box = form.querySelector('[data-chips="' + key + '"]');
      if (!box) return;
      built[key] = true;
      var tally = {};
      cards.forEach(function (c) { c['_' + key].forEach(function (v) { tally[v] = (tally[v] || 0) + 1; }); });
      fixed = fixed || (box.dataset.fixed ? box.dataset.fixed.split('|') : null);
      var order = box.dataset.order ? box.dataset.order.split('|') : null;
      var vals = fixed || Object.keys(tally).sort(function (a, b) {
        if (order) { var ia = order.indexOf(a), ib = order.indexOf(b); ia = ia < 0 ? 999 : ia; ib = ib < 0 ? 999 : ib; if (ia !== ib) return ia - ib; }
        return tally[b] - tally[a] || a.localeCompare(b);
      });
      if (!fixed) vals = vals.filter(function (v) { return v !== 'Not stated'; }).concat(vals.indexOf('Not stated') > -1 ? ['Not stated'] : []);   // always last
      if (vals.length === 1 && vals[0] === 'Not stated') { box.closest('fieldset').hidden = true; return; }   // nothing to choose between
      if (fixed && !cards.some(function (c) { return c['_' + key].length; })) { box.closest('fieldset').hidden = true; return; }
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
    buildChips('eras', 'era');
    buildChips('places', 'set');
    buildChips('kinds', 'kind');
    buildChips('formats', 'fmt');
    buildChips('subjects', 'sub');
    buildChips('pronouns', 'pr', ['He', 'She', 'They', 'Mixed', 'Not stated']);

    // Publisher: Traditional / Both / Indie (one choice; Both shows everything).
    var seg = form.querySelector('[data-seg="pub"]'), pubSel = 'both';
    if (seg) {
      var pubN = { trad: 0, indie: 0 };
      cards.forEach(function (c) { if (pubN[c._pub] !== undefined) pubN[c._pub]++; });
      if (!pubN.trad && !pubN.indie) { seg.closest('fieldset').hidden = true; seg = null; }
      else seg.querySelectorAll('button').forEach(function (b) {
        var n = b.dataset.v === 'both' ? pubN.trad + pubN.indie : pubN[b.dataset.v];
        b.setAttribute('aria-label', b.textContent + ' (' + n + (n === 1 ? ' book)' : ' books)'));
      });
    }
    function paintPub() {
      if (seg) seg.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.v === pubSel ? 'true' : 'false'); });
    }

    // Set during (fiction): a second slider over the years books are set in, with era presets.
    // The slider gives each era an equal share of its length (an ancient-world book would otherwise squeeze
    // the whole 20th century into a few pixels). The inputs run 0-1000; years are worked out from that.
    var dRange = form.querySelector('.range[data-range="during"]');
    var dFS = dRange ? dRange.closest('fieldset') : null;
    var dFrom = null, dTo = null, DMIN = 0, DMAX = 0, dlo = 0, dhi = 0, SEGS = [];
    var dCards = cards.filter(function (c) { return c._dFrom !== null; });
    if (dRange && !dCards.length) { dFS.hidden = true; dRange = null; }
    if (dRange) {
      DMIN = Math.min.apply(null, dCards.map(function (c) { return c._dFrom; }));
      DMAX = Math.max.apply(null, dCards.map(function (c) { return c._dTo; }));
      if (DMAX === DMIN) DMIN = DMAX - 1;
      var cuts = [ERAS[0].from].concat(ERAS.slice(1).map(function (e) { return e.from; }), [Math.max(thisYear, DMAX) + 1]);
      for (var i = 0; i < cuts.length - 1; i++) {
        var a = Math.max(cuts[i], DMIN), b = Math.min(cuts[i + 1], DMAX);
        if (a < b) SEGS.push([a, b]);
      }
      if (!SEGS.length) SEGS = [[DMIN, DMAX]];
      dFrom = dRange.querySelector('[name="dfrom"]'); dTo = dRange.querySelector('[name="dto"]');
      [dFrom, dTo].forEach(function (inp) { inp.min = 0; inp.max = 1000; inp.step = 1; });
      dlo = DMIN; dhi = DMAX;
      var box = dFS.querySelector('.presets');
      ERAS.forEach(function (e) {
        // Only eras that some book on the shelf is set in. Ancient world and The AIDS years are left out of the buttons
        // to keep the box short (Blair, 31 Oct 2026); the slider still covers those years.
        if (e.label === 'Ancient world' || e.label === 'The AIDS years') return;
        if (!dCards.some(function (c) { return c._dFrom <= e.to && c._dTo >= e.from; })) return;
        var bt = document.createElement('button');
        bt.type = 'button'; bt.textContent = e.label; bt.dataset.efrom = e.from; bt.dataset.eto = e.to;
        box.appendChild(bt);
      });
      var any = document.createElement('button');
      any.type = 'button'; any.dataset.any = '1'; any.textContent = 'Any time'; any.dataset.efrom = DMIN; any.dataset.eto = DMAX;
      box.appendChild(any);
      // Books whose description doesn't say when they're set: a "Not stated" chip, ticked like the rest.
      var nsN = cards.filter(function (c) { return c._dFrom === null; }).length;
      if (nsN) {
        // In the button row, after "Any time", so it isn't missed under the slider (Blair, 31 Oct 2026).
        var nsB = document.createElement('button');
        nsB.type = 'button'; nsB.className = 'chip chip-ns'; nsB.setAttribute('aria-pressed', 'true'); nsB.dataset.key = 'dns'; nsB.dataset.val = 'Not stated';
        nsB.innerHTML = '<span>Not stated</span><small></small>'; nsB.querySelector('small').textContent = nsN;
        box.appendChild(nsB);
      }
    }
    function dNS() { return !form.querySelector('.chip[data-key="dns"][aria-pressed="false"]'); }
    function posToYear(p) {
      var w = 1000 / SEGS.length, i = Math.min(SEGS.length - 1, Math.floor(p / w)), sg = SEGS[i];
      return Math.round(sg[0] + (p - i * w) / w * (sg[1] - sg[0]));
    }
    function yearToPos(y) {
      var w = 1000 / SEGS.length;
      for (var i = 0; i < SEGS.length; i++) {
        var sg = SEGS[i];
        if (y <= sg[1] || i === SEGS.length - 1) return Math.round(i * w + Math.max(0, Math.min(1, (y - sg[0]) / ((sg[1] - sg[0]) || 1))) * w);
      }
      return 1000;
    }
    function setDuring(lo, hi) {
      dlo = Math.max(DMIN, Math.min(DMAX, lo)); dhi = Math.max(dlo, Math.min(DMAX, hi));
      dFrom.value = yearToPos(dlo); dTo.value = yearToPos(dhi);
    }
    if (dRange) setDuring(DMIN, DMAX);
    function paintDuring() {
      if (!dRange) return;
      dRange.style.setProperty('--lo', (+dFrom.value / 10) + '%');
      dRange.style.setProperty('--hi', (+dTo.value / 10) + '%');
      dFS.querySelector('[data-out="dfrom"]').textContent = yr(dlo);
      dFS.querySelector('[data-out="dto"]').textContent = yr(dhi);
      // Only one preset lights at a time: when the whole range is chosen that is "Any time", even if an era covers it too.
      var dAll = dlo === DMIN && dhi === DMAX;
      dFS.querySelectorAll('.presets button:not(.chip)').forEach(function (bt) {
        var lo = Math.max(DMIN, +bt.dataset.efrom), hi = Math.min(DMAX, +bt.dataset.eto);
        var on = bt.dataset.any ? dAll : (!dAll && dlo === lo && dhi === hi);
        bt.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    // Reading time: one "up to" slider in half hours. At its top it means Any length.
    var P = window.PoofPace || { get: function () { return 'average'; }, hours: function (w) { return w / 240 / 60; },
      say: function (h) { return Math.round(h * 2) / 2 + ' hours'; } };
    var rRange = form.querySelector('.range[data-range="reading"]');
    var rFS = rRange ? rRange.closest('fieldset') : null, rIn = null, RMAX = 1, rCap = Infinity;
    var rCards = cards.filter(function (c) { return c._words; });
    if (rRange && !rCards.length) { rFS.hidden = true; rRange = null; }
    function readingScale() {
      if (!rRange) return;
      var longest = Math.max.apply(null, rCards.map(function (c) { return P.hours(c._words); }));
      RMAX = Math.max(1, Math.ceil(longest));
      rIn.min = 0.5; rIn.max = RMAX; rIn.step = 0.5;
      rIn.value = Math.min(rCap, RMAX);
    }
    if (rRange) { rIn = rRange.querySelector('[name="hours"]'); readingScale(); }
    function readOn() { return !!rRange && +rIn.value < RMAX; }
    function paintReading() {
      if (!rRange) return;
      var v = +rIn.value;
      rRange.style.setProperty('--lo', '0%');
      rRange.style.setProperty('--hi', ((v - 0.5) / ((RMAX - 0.5) || 1) * 100) + '%');
      rFS.querySelector('[data-out="hours"]').textContent = v >= RMAX ? 'Any length' : 'Up to ' + P.say(v) + ' at your ' + P.get() + ' pace';
      rFS.querySelectorAll('.presets button').forEach(function (b) {
        var h = +b.dataset.hours;
        b.setAttribute('aria-pressed', (h === 0 ? v >= RMAX : (v === Math.min(h, RMAX) && h < RMAX)) ? 'true' : 'false');
      });
    }

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
      form.querySelectorAll('.presets button[data-years]').forEach(function (b) {
        var n = +b.dataset.years;
        var all = +from.value === MIN && +to.value === MAX;
        var on = n === 0 ? all : (!all && +from.value === Math.max(MIN, thisYear - n + 1) && +to.value === MAX);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    function apply(push) {
      var q = form.elements.q.value.trim().toLowerCase();
      var lo = +from.value, hi = +to.value;
      var on = {}, off = {}, offCount = 0;
      GROUPS.forEach(function (g) { on[g[0]] = chosen(g[1]); off[g[1]] = unticked(g[1]); offCount += off[g[1]].length; });
      var dateOn = lo > MIN || hi < MAX;
      var durOn = !!dRange && (dlo > DMIN || dhi < DMAX);
      var rOn = readOn(), rH = rRange ? +rIn.value : 0;
      var shown = 0;
      cards.forEach(function (c) {
        var ok = (!q || c._title.indexOf(q) > -1 || c._author.indexOf(q) > -1) &&
          (!dateOn || (c._year !== null && c._year >= lo && c._year <= hi)) &&
          (c._dFrom === null ? (!dRange || dNS()) : (!durOn || (c._dFrom <= dhi && c._dTo >= dlo))) &&
          (!rOn || !c._words || P.hours(c._words) <= rH) &&
          (pubSel === 'both' || !c._pub || c._pub === pubSel) &&
          GROUPS.every(function (g) {
            var mine = c['_' + g[0]];
            // Values with no chip on this shelf (e.g. not on a fixed list) never hide a book.
            return !built[g[0]] || !mine.length || mine.some(function (v) { return on[g[0]].indexOf(v) > -1; }) ||
              !mine.some(function (v) { return on[g[0]].indexOf(v) > -1 || off[g[1]].indexOf(v) > -1; });
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
        pick: function (a, b) { return (b._pick - a._pick) || (b._date || '').localeCompare(a._date || '') || a._i - b._i; }
      }[sort] || null;
      cards.slice().sort(function (a, b) { return (a._nocover - b._nocover) || (by ? by(a, b) : a._i - b._i); }).forEach(function (c) { grid.appendChild(c); });
      cards = Array.prototype.slice.call(grid.querySelectorAll('.book'));   // in the order now shown
      var onShow = paginate();

      var active = (dateOn ? 1 : 0) + (durOn ? 1 : 0) + (rOn ? 1 : 0) + (pubSel !== 'both' ? 1 : 0) + (dRange && !dNS() ? 1 : 0) + offCount;
      paintAll();
      badge.hidden = !active; badge.textContent = active;
      countEl.textContent = (shown === cards.length ? cards.length + (cards.length === 1 ? ' book' : ' books')
        : shown + ' of ' + cards.length + ' books') + (onShow < shown ? ' · showing ' + onShow : '');
      noMatch.hidden = shown > 0;

      if (push) {
        var p = new URLSearchParams();
        // Keep campaign tags (utm_*, gclid, fbclid) so analytics still sees where the visit came from.
        new URLSearchParams(location.search).forEach(function (v, k) {
          if (/^utm_/.test(k) || k === 'gclid' || k === 'fbclid') p.set(k, v);
        });
        if (q) p.set('q', q);
        if (pages > 1) p.set('shown', pages);  // so Back from a book page returns to the same place
        if (sort !== 'pick') p.set('sort', sort);  // the curator's picks first is the default
        if (lo > MIN) p.set('from', lo);
        if (hi < MAX) p.set('to', hi);
        if (rOn) p.set('time', rH);
        if (durOn && dlo > DMIN) p.set('dfrom', dlo);
        if (durOn && dhi < DMAX) p.set('dto', dhi);
        if (pubSel !== 'both') p.set('pub', pubSel);
        if (dRange && !dNS()) p.set('not-dur', '1');
        // The address bar records what has been unticked, e.g. ?not-pr=She,Mixed
        // ...or, when most are unticked, what is still ticked (?only-set=France), so the address stays short.
        GROUPS.forEach(function (g) {
          if (!off[g[1]].length) return;
          var onNow = chosen(g[1]);
          if (off[g[1]].length > onNow.length) p.set('only-' + g[1], onNow.join(','));
          else p.set('not-' + g[1], off[g[1]].join(','));
        });
        var qs = p.toString();
        history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
      }
    }

    // Restore from the address bar.
    var p = new URLSearchParams(location.search);
    if (p.get('q')) form.elements.q.value = p.get('q');
    if (+p.get('shown') > 1) pages = Math.min(40, Math.floor(+p.get('shown')));
    if (p.get('sort')) form.elements.sort.value = p.get('sort');
    if (p.get('from')) from.value = Math.max(MIN, Math.min(MAX, +p.get('from')));
    if (p.get('to')) to.value = Math.max(MIN, Math.min(MAX, +p.get('to')));
    if (rRange && p.get('time')) { rCap = Math.max(0.5, +p.get('time')); rIn.value = Math.min(rCap, RMAX); }
    if (dRange && (p.get('dfrom') || p.get('dto'))) setDuring(p.get('dfrom') ? +p.get('dfrom') : DMIN, p.get('dto') ? +p.get('dto') : DMAX);
    var restored = false;
    if (seg && (p.get('pub') === 'trad' || p.get('pub') === 'indie')) { pubSel = p.get('pub'); restored = true; }
    var nsChip = form.querySelector('.chip[data-key="dns"]');
    if (nsChip && p.get('not-dur') === '1') { nsChip.setAttribute('aria-pressed', 'false'); restored = true; }
    paintPub();
    GROUPS.forEach(function (g) {
      (p.get('not-' + g[1]) || '').split(',').filter(Boolean).forEach(function (v) {
        var b = form.querySelector('.chip[data-key="' + g[1] + '"][data-val="' + CSS.escape(v) + '"]');
        if (b) { b.setAttribute('aria-pressed', 'false'); restored = true; }
      });
      if (p.has('only-' + g[1])) {
        var keep = p.get('only-' + g[1]).split(',').filter(Boolean);
        form.querySelectorAll('.chip[data-key="' + g[1] + '"]').forEach(function (b) {
          if (keep.indexOf(b.dataset.val) < 0) { b.setAttribute('aria-pressed', 'false'); restored = true; }
        });
      }
    });
    if (p.get('from') || p.get('to') || p.get('time') || p.get('dfrom') || p.get('dto') || restored) { panel.hidden = false; toggle.setAttribute('aria-expanded', 'true'); }

    toggle.addEventListener('click', function () {
      panel.hidden = !panel.hidden;
      toggle.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
    });
    form.addEventListener('submit', function (ev) { ev.preventDefault(); });
    // Any change of filter or sort starts again from the first 25.
    form.addEventListener('input', function () { pages = 1; }, true);
    form.addEventListener('change', function () { pages = 1; }, true);
    form.addEventListener('click', function (ev) { if (ev.target.closest('button')) pages = 1; }, true);
    moreBtn.addEventListener('click', function () {
      var first = cards.filter(function (c) { return !c.hidden && c.classList.contains('paged'); })[0];
      pages++; apply(true);
      if (first) { var a = first.matches('a') ? first : first.querySelector('a'); if (a) a.focus({ preventScroll: true }); }
    });
    var lastPer = perPage();
    window.addEventListener('resize', function () { var n = perPage(); if (n !== lastPer) { lastPer = n; apply(false); } });
    form.elements.q.addEventListener('input', function () { apply(true); });
    form.elements.sort.addEventListener('change', function () { apply(true); });
    from.addEventListener('input', function () { if (+from.value > +to.value) from.value = to.value; paintRange(); apply(true); });
    to.addEventListener('input', function () { if (+to.value < +from.value) to.value = from.value; paintRange(); apply(true); });
    if (rRange) {
      rIn.addEventListener('input', function () { rCap = +rIn.value >= RMAX ? Infinity : +rIn.value; paintReading(); apply(true); });
      rFS.querySelectorAll('.presets button').forEach(function (b) {
        b.addEventListener('click', function () {
          var h = +b.dataset.hours;
          rCap = h === 0 ? Infinity : h; rIn.value = Math.min(rCap, RMAX);
          paintReading(); apply(true);
        });
      });
      // The reader changed his pace in the settings gear: same time available, new book lengths.
      document.addEventListener('poof:pace', function () { readingScale(); paintReading(); apply(true); });
    }
    if (dRange) {
      dFrom.addEventListener('input', function () { if (+dFrom.value > +dTo.value) dFrom.value = dTo.value; dlo = posToYear(+dFrom.value); if (+dFrom.value === 0) dlo = DMIN; paintDuring(); apply(true); });
      dTo.addEventListener('input', function () { if (+dTo.value < +dFrom.value) dTo.value = dFrom.value; dhi = posToYear(+dTo.value); if (+dTo.value === 1000) dhi = DMAX; paintDuring(); apply(true); });
      dFS.querySelectorAll('.presets button:not(.chip)').forEach(function (b) {
        b.addEventListener('click', function () {
          setDuring(+b.dataset.efrom, +b.dataset.eto);
          paintDuring(); apply(true);
        });
      });
    }
    form.querySelectorAll('.presets button[data-years]').forEach(function (b) {
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
      var sb = seg && ev.target.closest('[data-seg="pub"] button');
      if (sb) { pubSel = sb.dataset.v; paintPub(); apply(true); return; }
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
      if (dRange) { setDuring(DMIN, DMAX); paintDuring(); }
      if (rRange) { rCap = Infinity; rIn.value = RMAX; paintReading(); }
      form.querySelectorAll('.chip').forEach(function (b) { b.setAttribute('aria-pressed', 'true'); });
      pubSel = 'both'; paintPub();
      paintRange(); apply(true);
    }
    form.addEventListener('reset', function (ev) { ev.preventDefault(); clearAll(); });
    var clr = document.querySelector('.shelf [data-clear]');
    if (clr) clr.addEventListener('click', function () { pages = 1; clearAll(); });

    paintRange();
    paintDuring();
    paintReading();
    apply(false);
  });
})();
