/* Poof Books: currency switcher.
   Payment is taken in Australian dollars. Other currencies are shown as approximate conversions
   ("≈ £21"), with a note that the charge is in AUD.
   Markup it acts on:
     <span class="money" data-aud="39.95">A$39.95</span>   any price (the text is the AUD fallback)
     <p data-fx-note hidden></p>                             shown only when a non-AUD currency is chosen
   Rates come from /assets/data/fx.json (rebuilt from the database). The reader's choice is remembered. */
(function () {
  'use strict';
  var KEY = 'poof-currency';
  var NAMES = { AUD: 'Australian dollar', NZD: 'New Zealand dollar', USD: 'US dollar', GBP: 'British pound', EUR: 'Euro', CAD: 'Canadian dollar' };
  var EURO = ['AT','BE','CY','DE','EE','ES','FI','FR','GR','HR','IE','IT','LT','LU','LV','MT','NL','PT','SI','SK'];

  function guess() {
    var langs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ''];
    for (var i = 0; i < langs.length; i++) {
      var m = /[-_]([A-Za-z]{2})\b/.exec(langs[i] || '');
      if (!m) continue;
      var r = m[1].toUpperCase();
      if (r === 'AU') return 'AUD';
      if (r === 'NZ') return 'NZD';
      if (r === 'US') return 'USD';
      if (r === 'GB' || r === 'UK') return 'GBP';
      if (r === 'CA') return 'CAD';
      if (EURO.indexOf(r) > -1) return 'EUR';
    }
    return 'AUD';
  }
  function load() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function save(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  function fmtAUD(n) { return 'A$' + n.toFixed(2); }
  function niceDate(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || '');
    if (!m) return d;
    return (+m[3]) + ' ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m[2] - 1] + ' ' + m[1];
  }

  document.addEventListener('DOMContentLoaded', function () {
    fetch('/assets/data/fx.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (fx) {
      var by = {};
      fx.currencies.forEach(function (c) { by[c.code] = c; });
      var cur = load();
      if (!by[cur]) cur = guess();
      if (!by[cur]) cur = 'AUD';

      // ---- the switcher, next to the settings gear
      var gear = document.querySelector('.site-header .gear');
      var box = document.createElement('div');
      box.className = 'cur';
      box.innerHTML = '<button type="button" class="cur-btn" aria-haspopup="true" aria-expanded="false" aria-controls="cur-menu">' +
        '<img alt="" width="22" height="16"><span class="cur-code"></span></button>' +
        '<div class="cur-menu" id="cur-menu" hidden><p class="cur-head">Show prices in</p><ul></ul>' +
        '<p class="cur-foot">You’re always charged in Australian dollars. Other currencies are a guide, converted at European Central Bank rates of ' + niceDate(fx.date) + '.</p></div>';
      var ul = box.querySelector('ul');
      fx.currencies.forEach(function (c) {
        var li = document.createElement('li');
        li.innerHTML = '<button type="button" data-cur="' + c.code + '"><img src="/assets/flags/' + c.flag + '.svg" alt="" width="22" height="16">' +
          '<b>' + c.code + '</b><span>' + (NAMES[c.code] || '') + '</span></button>';
        ul.appendChild(li);
      });
      if (gear) {
        var tools = gear.closest('.hdr-tools');           // cart.js may have made it already
        if (!tools) {
          tools = document.createElement('div');
          tools.className = 'hdr-tools';
          gear.parentNode.insertBefore(tools, gear);
          tools.appendChild(gear);
        }
        tools.insertBefore(box, tools.firstChild);        // currency first, then trolley, then gear
      }
      var btn = box.querySelector('.cur-btn'), menu = box.querySelector('.cur-menu');
      function open(o) { menu.hidden = !o; btn.setAttribute('aria-expanded', o ? 'true' : 'false'); }
      btn.addEventListener('click', function () { open(menu.hidden); });
      document.addEventListener('click', function (e) { if (!box.contains(e.target)) open(false); });
      box.addEventListener('keydown', function (e) { if (e.key === 'Escape') { open(false); btn.focus(); } });
      ul.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-cur]');
        if (!b) return;
        cur = b.dataset.cur; save(cur); paint(); open(false); btn.focus();
      });

      // ---- prices
      function paint() {
        var c = by[cur];
        btn.querySelector('img').src = '/assets/flags/' + c.flag + '.svg';
        btn.querySelector('.cur-code').textContent = c.code;
        btn.setAttribute('aria-label', 'Currency: ' + (NAMES[c.code] || c.code) + '. Change currency');
        ul.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.cur === cur ? 'true' : 'false'); });
        document.querySelectorAll('.money[data-aud]').forEach(function (el) {
          var aud = parseFloat(el.dataset.aud);
          if (isNaN(aud)) return;
          if (cur === 'AUD') {
            el.textContent = fmtAUD(aud); el.removeAttribute('title'); el.classList.remove('approx');
          } else {
            el.textContent = '≈ ' + c.symbol + Math.round(aud * c.rate);
            el.title = 'About ' + c.symbol + Math.round(aud * c.rate) + '. Charged in Australian dollars: ' + fmtAUD(aud) + '.';
            el.classList.add('approx');
          }
        });
        document.querySelectorAll('[data-fx-note]').forEach(function (el) {
          var m = el.closest('[data-aud-context]') || el.parentNode;
          var a = m.querySelector('.money[data-aud]');
          el.hidden = cur === 'AUD';
          if (cur !== 'AUD') el.textContent = 'Charged in Australian dollars' + (a ? ' (' + fmtAUD(parseFloat(a.dataset.aud)) + ')' : '') + '. Your bank converts at its own rate.';
        });
      }
      paint();
    }).catch(function () { /* no rates: prices stay in AUD, as written in the page */ });
  });
})();
