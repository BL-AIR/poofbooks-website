/* Poof Books view settings: Curators, Sound, Motion, Reading pace.
   The tiny inline script in each page's <head> applies the saved choice before first paint;
   this file wires up the gear, the pop-up, the switches and the Hear button. */
(function () {
  'use strict';
  var KEY = 'poof-view';
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Reading pace, words a minute. Must match the database (app_setting reading_pace_wpm).
  var PACE = { slow: 200, average: 240, fast: 300 };

  function load() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { s = {}; }
    return {
      curators: s.curators !== false,
      sound: s.sound !== false,   // on by default; nothing plays until a Hear button is pressed
      motion: typeof s.motion === 'boolean' ? s.motion : !reduce,
      pace: PACE[s.pace] ? s.pace : 'average'
    };
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }

  var state = load();

  // Shared with shelf.js: hours to read a book at the reader's pace, and a friendly way to say it.
  function hours(words, pace) { return words / PACE[pace || state.pace] / 60; }
  function say(h) {
    if (h < 0.75) return Math.max(5, Math.round(h * 60 / 5) * 5) + ' minutes';
    var r = Math.round(h * 2) / 2, whole = Math.floor(r);
    var txt = (whole ? String(whole) : '') + (r % 1 ? '\u00bd' : '');
    return txt + (r <= 1 ? ' hour' : ' hours');
  }
  window.PoofPace = { get: function () { return state.pace; }, wpm: PACE, hours: hours, say: say };

  // Reading time on a book page: <td data-words="101441"> is rewritten for the reader's pace.
  function paintReading() {
    document.querySelectorAll('[data-words]').forEach(function (td) {
      if (td.closest('.book')) return;           // shelf cards are handled by shelf.js
      var w = +td.getAttribute('data-words'); if (!w) return;
      var others = ['slow', 'average', 'fast'].filter(function (p) { return p !== state.pace; })
        .map(function (p) { return say(hours(w, p)) + ' ' + p; });
      td.innerHTML = '';
      td.appendChild(document.createTextNode('About ' + say(hours(w))));
      var note = document.createElement('span'); note.className = 'ib-note';
      note.textContent = 'At your ' + state.pace + ' reading pace (' + others.join(', ') + '). Change it under the settings gear.';
      td.appendChild(note);
    });
  }

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
    document.querySelectorAll('.pace button[data-pace]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-pace') === state.pace ? 'true' : 'false');
    });
    paintReading();
  }

  var audio = null, playing = null;
  function stopAudio() {
    if (audio) { audio.pause(); audio = null; }
    if (playing) { playing.setAttribute('aria-pressed', 'false'); playing = null; }
  }

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

    document.querySelectorAll('.pace button[data-pace]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.pace = b.getAttribute('data-pace');
        save(state);
        apply();
        document.dispatchEvent(new CustomEvent('poof:pace', { detail: state.pace }));
      });
    });

    // Hear button: plays the curator's recording when one is set in data-audio.
    document.querySelectorAll('.hear').forEach(function (b) {
      var src = b.getAttribute('data-audio');
      var pending = b.parentNode.querySelector('.audio-pending');
      if (!src) { b.hidden = true; if (pending) pending.hidden = false; return; }
      if (pending) pending.hidden = true;
      b.addEventListener('click', function () {
        var same = playing === b;
        stopAudio();                     // one voice at a time
        if (same) return;                // pressing the same button again stops it
        audio = new Audio(src); playing = b;
        b.setAttribute('aria-pressed', 'true');
        audio.addEventListener('ended', function () { if (playing === b) stopAudio(); });
        audio.play().catch(function () { if (playing === b) stopAudio(); });
      });
    });

    apply();
  });
})();
