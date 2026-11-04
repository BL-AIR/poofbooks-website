/* Poof Books — light / dark switch.
   Follows the visitor's device setting until they choose; the choice is remembered on this
   device (localStorage "poof-theme"). Colours live in assets/css/theme.css.

   Every page's <head> should start with this one-liner, so the right mode paints first time:
   <script>(function(){var d=document.documentElement,t=null;try{t=localStorage.getItem('poof-theme')}catch(e){}if(t==='light'||t==='dark')d.setAttribute('data-theme',t);else t=window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';if(t==='light')d.classList.add('lm')})();</script>
   Without it the page still follows the device setting; a saved choice just applies a moment later. */
(function () {
  var root = document.documentElement;
  var KEY = 'poof-theme';
  var COLOURS = { dark: '#18122B', light: '#FCE4EE' };
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

  function saved() { try { var t = localStorage.getItem(KEY); return (t === 'light' || t === 'dark') ? t : null; } catch (e) { return null; } }
  function current() { return root.getAttribute('data-theme') || (mq && mq.matches ? 'light' : 'dark'); }

  // Browser chrome colour (Safari's toolbar, Android's status bar)
  function paintChrome(t) {
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    var override = root.hasAttribute('data-theme');
    metas.forEach(function (m) {
      var media = m.getAttribute('data-media') || m.getAttribute('media') || '';
      if (!m.hasAttribute('data-media') && media) m.setAttribute('data-media', media);
      if (override) { m.removeAttribute('media'); m.setAttribute('content', COLOURS[t]); }
      else if (media) { m.setAttribute('media', media); m.setAttribute('content', /light/.test(media) ? COLOURS.light : COLOURS.dark); }
      else m.setAttribute('content', COLOURS[t]);
    });
  }

  var picks = [], btn;
  function apply() {
    var t = current();
    root.classList.toggle('lm', t === 'light');
    paintChrome(t);
    var pick = root.getAttribute('data-theme') || 'system';
    picks.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-theme-pick') === pick ? 'true' : 'false'); });
    if (btn) {
      var label = t === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
    }
  }
  // 'light', 'dark' or 'system' (follow the device; nothing saved)
  function choose(next) {
    try { if (next === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, next); } catch (e) {}
    if (next === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', next);
    apply();
  }

  var s = saved();
  if (s) root.setAttribute('data-theme', s);
  apply();
  if (mq) {
    var onChange = function () { if (!saved()) apply(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
  }

  function build() {
    // Shop pages: the first row of the settings gear's pop-up
    var panel = document.querySelector('.view-settings');
    if (panel) {
      var row = document.createElement('div');
      row.className = 'vs-row vs-pace vs-theme';
      row.innerHTML = '<div class="lab"><b>Appearance</b><span>Light is pastel pink, Dark is Night. System follows your device.</span></div>' +
        '<div class="pace" role="group" aria-label="Appearance">' +
        '<button type="button" data-theme-pick="light" aria-pressed="false">Light</button>' +
        '<button type="button" data-theme-pick="dark" aria-pressed="false">Dark</button>' +
        '<button type="button" data-theme-pick="system" aria-pressed="false">System</button></div>';
      var first = panel.querySelector('.vs-row');
      if (first) panel.insertBefore(row, first); else panel.appendChild(row);
      picks = Array.prototype.slice.call(row.querySelectorAll('[data-theme-pick]'));
      picks.forEach(function (b) { b.addEventListener('click', function () { choose(b.getAttribute('data-theme-pick')); }); });
    } else {
      // Pages without the gear (home, About, Privacy…): a small floating sun/moon, top right
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'theme-toggle floating';
      btn.innerHTML =
        '<svg class="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>' +
        '<svg class="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
      // One button can't offer three choices: it flips light/dark, and landing on the device's own mode returns to System
      btn.addEventListener('click', function () {
        var next = current() === 'light' ? 'dark' : 'light', device = mq && mq.matches ? 'light' : 'dark';
        choose(next === device ? 'system' : next);
      });
      document.body.appendChild(btn);
    }
    apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
