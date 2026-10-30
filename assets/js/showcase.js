/* Poof Books: the three-panel showcase (Book of the Month · Out this month · Coming soon).
   Panels sit side by side in a scroll-snapping track; arrows, tabs, swipe and arrow keys all move it.
   Month view (30 Oct 2026): when the showcase carries a <script type="application/json" class="sc-data"> block, the
   panels are drawn from it for one month at a time. The small ‹ › arrows in the tab row step back through earlier months
   and forward again, never past the current month (the later of today and the launch month). Without the data block the
   showcase works as before (panels written in the page). */
(function () {
  'use strict';
  var MON = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  function ym(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function add(m, n) { var y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1 + n; return ym(new Date(y, mo, 1)); }
  function name(m) { return MON[+m.slice(5, 7) - 1]; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.sc-frame').forEach(function (sc) {
      var track = sc.querySelector('.sc-track');
      var slides = Array.prototype.slice.call(sc.querySelectorAll('.slide'));
      var tabs = Array.prototype.slice.call(sc.querySelectorAll('[role="tab"]'));
      var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      var current = 0;

      // ---- month view
      var dataEl = sc.querySelector('script.sc-data'), data = null;
      try { data = dataEl ? JSON.parse(dataEl.textContent) : null; } catch (e) { data = null; }
      if (data) {
        var now = ym(new Date());
        var latest = data.launch && data.launch > now ? data.launch : now;     // before launch, show the launch month
        var earliest = data.earliest || add(latest, -12);
        var month = latest;
        var mPrev = sc.querySelector('.sc-month.prev'), mNext = sc.querySelector('.sc-month.next');
        var who = data.curator || '';
        var draw = function () {
          var m = data.months[month] || {};
          tabs[0].textContent = name(month) + '’s Book';
          tabs[1].textContent = 'Out in ' + name(month);
          slides[0].innerHTML = '<p class="eyebrow">Book of the month</p>' + (m.botm ||
            '<p class="slide-empty">' + (month < (data.launch || '') ? 'Poof Books opens in ' + name(data.launch) + '. No book of the month before then.'
                                         : 'No book of the month chosen for ' + name(month) + ' yet.') + '</p>');
          slides[1].innerHTML = '<p class="eyebrow">New releases</p>' + (m.out && m.out.length
            ? '<div class="mini-books">' + m.out.join('') + '</div>'
            : '<p class="slide-empty">Nothing on this shelf came out in ' + name(month) + '.</p>');
          // Coming soon: everything announced after the month shown, soonest first, in one row that scrolls sideways.
          var soon = [], keys = Object.keys(data.months).sort();
          keys.forEach(function (k) { if (k > month && data.months[k].out) soon = soon.concat(data.months[k].out); });
          slides[2].innerHTML = '<p class="eyebrow">From ' + name(add(month, 1)) + (soon.length ? ' \u00b7 ' + soon.length + (soon.length === 1 ? ' book' : ' books') : '') + '</p>' + (soon.length
            ? '<div class="mini-books scroll" tabindex="0" aria-label="Coming soon, scroll sideways">' + soon.join('') + '</div>'
            : '<p class="slide-empty">Nothing announced for the next three months yet. Check back soon.</p>');
          if (mPrev) { mPrev.disabled = month <= earliest; mPrev.setAttribute('aria-label', 'Show ' + name(add(month, -1)) + (mPrev.disabled ? ' (not available)' : '')); }
          if (mNext) { mNext.disabled = month >= latest; mNext.setAttribute('aria-label', mNext.disabled ? 'Already showing the latest month' : 'Show ' + name(add(month, 1))); }
          document.dispatchEvent(new CustomEvent('poof:content'));
          requestAnimationFrame(fit);
        };
        if (mPrev) mPrev.addEventListener('click', function () { if (month > earliest) { month = add(month, -1); draw(); } });
        if (mNext) mNext.addEventListener('click', function () { if (month < latest) { month = add(month, 1); draw(); } });
        draw();
      }

      function fit() { track.style.height = slides[current].offsetHeight + 'px'; }
      function setActive(i) {
        current = i;
        fit();
        tabs.forEach(function (t, j) {
          t.setAttribute('aria-selected', j === i ? 'true' : 'false');
          t.tabIndex = j === i ? 0 : -1;
        });
        var bar = tabs[i].parentNode, tb = tabs[i];
        if (tb.offsetLeft < bar.scrollLeft || tb.offsetLeft + tb.offsetWidth > bar.scrollLeft + bar.clientWidth) {
          bar.scrollTo({ left: tb.offsetLeft - 16, behavior: reduce ? 'auto' : 'smooth' });
        }
        slides.forEach(function (s, j) {
          s.toggleAttribute('inert', j !== i);
          s.setAttribute('aria-hidden', j === i ? 'false' : 'true');
        });
      }
      function go(i, focusTab) {
        var n = slides.length;
        i = (i + n) % n;   // wrap round at either end
        track.scrollTo({ left: slides[i].offsetLeft - track.offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
        setActive(i);
        if (focusTab) tabs[i].focus();
      }

      sc.querySelector('.glass-arrow.prev').addEventListener('click', function () { go(current - 1); });
      sc.querySelector('.glass-arrow.next').addEventListener('click', function () { go(current + 1); });
      tabs.forEach(function (t, i) {
        t.addEventListener('click', function () { go(i); });
        t.addEventListener('keydown', function (ev) {
          if (ev.key === 'ArrowRight') { ev.preventDefault(); go(current + 1, true); }
          if (ev.key === 'ArrowLeft') { ev.preventDefault(); go(current - 1, true); }
        });
      });

      // Keep tabs in step when someone swipes or trackpad-scrolls.
      var t;
      track.addEventListener('scroll', function () {
        clearTimeout(t);
        t = setTimeout(function () {
          var w = track.clientWidth || 1;
          var i = Math.round(track.scrollLeft / w);
          if (i !== current && i >= 0 && i < slides.length) setActive(i);
        }, 80);
      }, { passive: true });
      window.addEventListener('resize', function () { track.scrollLeft = slides[current].offsetLeft - track.offsetLeft; fit(); });
      window.addEventListener('load', fit);

      setActive(0);
    });
  });
})();
