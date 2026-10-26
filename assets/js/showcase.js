/* Poof Books: the three-panel showcase (Book of the Month · Out this month · Coming soon).
   Panels sit side by side in a scroll-snapping track; arrows, tabs, swipe and arrow keys all move it. */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.sc-frame').forEach(function (sc) {
      var track = sc.querySelector('.sc-track');
      var slides = Array.prototype.slice.call(sc.querySelectorAll('.slide'));
      var tabs = Array.prototype.slice.call(sc.querySelectorAll('[role="tab"]'));
      var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      var current = 0;

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
