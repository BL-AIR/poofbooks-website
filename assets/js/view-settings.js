/* Poof Books view settings: Curators, Sound, Motion.
   The tiny inline script in each page's <head> applies the saved choice before first paint;
   this file wires up the gear, the pop-up, the switches and the Hear button. */
(function () {
  'use strict';
  var KEY = 'poof-view';
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function load() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { s = {}; }
    return {
      curators: s.curators !== false,
      sound: s.sound === true,
      motion: typeof s.motion === 'boolean' ? s.motion : !reduce
    };
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }

  var state = load();

  function apply() {
    root.classList.toggle('no-curators', !state.curators);
    root.classList.toggle('sound-on', state.curators && state.sound);
    root.classList.toggle('motion-on', state.curators && state.motion);
    document.querySelectorAll('.switch[data-key]').forEach(function (b) {
      var k = b.getAttribute('data-key');
      var dependent = k !== 'curators';
      b.disabled = dependent && !state.curators;
      b.setAttribute('aria-checked', state[k] && !b.disabled ? 'true' : 'false');
    });
    if (!(state.curators && state.sound)) stopAudio();
  }

  var audio = null;
  function stopAudio() { if (audio) { audio.pause(); audio = null; } }

  document.addEventListener('DOMContentLoaded', function () {
    var gear = document.querySelector('.gear');
    var panel = document.getElementById('view-settings');

    function setOpen(open) {
      if (!gear || !panel) return;
      gear.setAttribute('aria-expanded', open ? 'true' : 'false');
      panel.hidden = !open;
    }
    if (gear && panel) {
      gear.addEventListener('click', function (e) {
        e.stopPropagation();
        setOpen(panel.hidden);
      });
      panel.addEventListener('click', function (e) { e.stopPropagation(); });
      document.addEventListener('click', function () { setOpen(false); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !panel.hidden) { setOpen(false); gear.focus(); }
      });
    }

    document.querySelectorAll('.switch[data-key]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.disabled) return;
        var k = b.getAttribute('data-key');
        state[k] = !state[k];
        save(state);
        apply();
      });
    });

    // Hear button: plays the curator's recording when one is set in data-audio.
    document.querySelectorAll('.hear').forEach(function (b) {
      var src = b.getAttribute('data-audio');
      var pending = b.parentNode.querySelector('.audio-pending');
      if (!src) { b.hidden = true; if (pending) pending.hidden = false; return; }
      if (pending) pending.hidden = true;
      b.addEventListener('click', function () {
        if (audio) { stopAudio(); b.setAttribute('aria-pressed', 'false'); return; }
        audio = new Audio(src);
        b.setAttribute('aria-pressed', 'true');
        audio.addEventListener('ended', function () { audio = null; b.setAttribute('aria-pressed', 'false'); });
        audio.play().catch(function () { audio = null; b.setAttribute('aria-pressed', 'false'); });
      });
    });

    apply();
  });
})();
