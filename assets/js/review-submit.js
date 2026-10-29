/* Reviewers' submission page. The private link carries the commission's token after the # (never sent to any
   server in a URL, never in a referrer); the page sends it to poofbooks-reviews in a header.
   A draft is kept on this device while the reviewer types, and cleared once the review is sent. */
(function () {
  var API = document.body.getAttribute('data-api');
  var token = (location.hash.match(/[#&]t=([A-Za-z0-9_-]{32,128})/) || [])[1] || '';
  var $ = function (id) { return document.getElementById(id); };
  var FIELDS = ['about', 'for_whom', 'liked', 'disliked', 'worth_knowing'];
  var DRAFT = 'poof-review-draft-' + token.slice(0, 10);
  var form = $('rv-form');

  function show(id) { ['rv-loading', 'rv-closed', 'rv-open', 'rv-done'].forEach(function (x) { $(x).hidden = x !== id; }); }
  function closed(msg) { $('rv-closed').querySelector('p').textContent = msg; show('rv-closed'); }
  function store(get, val) {
    try { if (get) return JSON.parse(localStorage.getItem(DRAFT) || 'null');
          if (val === null) localStorage.removeItem(DRAFT); else localStorage.setItem(DRAFT, JSON.stringify(val)); }
    catch (e) { return null; }
  }
  function values() {
    var v = { format: (form.querySelector('input[name=format]:checked') || {}).value || '',
              credit_plain: $('credit_plain').checked };
    FIELDS.forEach(function (k) { v[k] = form.elements[k].value; });
    return v;
  }
  function fill(v) {
    if (!v) return;
    FIELDS.forEach(function (k) { if (typeof v[k] === 'string') form.elements[k].value = v[k]; });
    if (v.format) { var r = form.querySelector('input[name=format][value="' + v.format + '"]'); if (r) r.checked = true; }
    if (typeof v.credit_plain === 'boolean') $('credit_plain').checked = v.credit_plain;
  }
  function longDate(iso) {
    try { return new Date(iso + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
    catch (e) { return iso; }
  }

  if (!token) return closed('This page needs the private link from your commission email. If you can’t find it, write to BigDaddy@poofbooks.com.');

  fetch(API + '/v1/commission', { headers: { 'X-Review-Token': token } })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d.ok) return closed(d.message || 'This link isn’t working. Please write to BigDaddy@poofbooks.com.');
      var b = d.book || {};
      var book = $('rv-book'); book.textContent = '';
      var em = document.createElement('em'); em.textContent = b.title + (b.subtitle ? ': ' + b.subtitle : ''); book.appendChild(em);
      if (b.authors) { var by = document.createElement('span'); by.className = 'by'; by.textContent = ' by ' + b.authors; book.appendChild(by); }
      $('rv-curator').textContent = d.curator.name;
      Array.prototype.forEach.call(document.querySelectorAll('.rv-curator-name'), function (s) { s.textContent = d.curator.shortName; });
      if (d.due) $('rv-due').textContent = longDate(d.due); else $('rv-due-row').hidden = true;
      $('rv-byline').textContent = d.reviewer.byline;
      $('rv-contract').hidden = !!d.contractSigned;
      $('credit_plain').checked = !!d.reviewer.creditPlain;
      if (d.format) { var r = form.querySelector('input[name=format][value="' + d.format + '"]'); if (r) r.checked = true; }
      if (d.sent) { fill(d.sent); $('rv-again').hidden = false; $('rv-send').textContent = 'Send my changes'; }
      fill(store(true));                                      // an unsent draft on this device wins
      counts();
      show('rv-open');
    })
    .catch(function () { closed('We couldn’t reach our reviews desk just now. Please try again in a minute, or write to BigDaddy@poofbooks.com.'); });

  // A small running word count under each box (the guide is in each heading).
  FIELDS.forEach(function (k) {
    var box = form.elements[k], c = document.createElement('p');
    c.className = 'rv-count'; c.setAttribute('aria-hidden', 'true'); box.parentNode.insertBefore(c, box.nextSibling);
    var guide = { about: 250, for_whom: 150, liked: 200, disliked: 200, worth_knowing: 200 }[k];
    box._count = function () { var n = (box.value.match(/\S+/g) || []).length;
      c.textContent = n + ' of about ' + guide + ' words'; c.classList.toggle('over', n > guide * 1.5); };
    box.addEventListener('input', box._count);
  });
  function counts() { FIELDS.forEach(function (k) { form.elements[k]._count(); }); }

  var t;
  form.addEventListener('input', function () {
    clearTimeout(t);
    t = setTimeout(function () { store(false, values()); $('rv-draft').textContent = 'Draft kept on this device.'; }, 600);
  });

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var v = values(), err = $('rv-error'), send = $('rv-send');
    Array.prototype.forEach.call(form.querySelectorAll('[aria-invalid]'), function (x) { x.removeAttribute('aria-invalid'); });
    var need = !v.format ? 'format' : ['about', 'for_whom', 'liked'].filter(function (k) { return !v[k].trim(); })[0];
    if (need) return fail(need, need === 'format' ? 'Please say how you read it.' : 'Please fill in “' + form.querySelector('label[for=' + need + '] b').textContent + '”.');
    err.hidden = true; send.disabled = true; send.textContent = 'Sending…';
    fetch(API + '/v1/review', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Review-Token': token }, body: JSON.stringify(v) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) { send.disabled = false; send.textContent = 'Send my review'; return fail(d.field, d.message); }
        store(false, null);
        show('rv-done'); $('rv-done').focus(); window.scrollTo(0, 0);
      })
      .catch(function () { send.disabled = false; send.textContent = 'Send my review'; fail(null, 'That didn’t go through. Your words are still here: please try again.'); });
  });

  function fail(field, msg) {
    var err = $('rv-error'); err.textContent = msg; err.hidden = false;
    var el = field === 'format' ? form.querySelector('input[name=format]') : (field && form.elements[field]);
    if (el) { if (field !== 'format') el.setAttribute('aria-invalid', 'true'); el.focus(); }
  }
})();
