/* Poof Books: helpers for the Zoho Campaigns sign-up form (Looker List / Keep me posted).
   - Enter in a field submits, as a normal form would (Zoho's button is type="button").
   - Shelf ticks are Campaigns Topics (listCheckBox); each tick is mirrored into the hidden
     "Shelves" field (CONTACT_CF1) so it also reaches the Lead in Zoho CRM. */
(function () {
  'use strict';
  var form = document.getElementById('zcampaignOptinForm');
  if (!form) return;
  // Zoho's form script pulls in Google reCAPTCHA (about 1 MB). Load it only when the form is about to be seen
  // or someone reaches for it, not on every page view (Blair, 31 Oct 2026: speed worldwide).
  var tag = document.getElementById('zc-optin'), loaded = false;
  function loadZoho() {
    if (loaded || !tag) return; loaded = true;
    var s = document.createElement('script');
    s.src = tag.dataset.src; s.async = true;
    s.onload = function () {
      if (window.setupSF) setupSF(tag.dataset.sf, 'ZCFORMVIEW', false, 'light', false, '0');
      if (window.referenceSetter) referenceSetter(document.getElementById('refImage'));
    };
    document.head.appendChild(s);
  }
  if (tag) {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); loadZoho(); } }, { rootMargin: '600px 0px' });
      io.observe(form);
    } else loadZoho();
    form.addEventListener('focusin', loadZoho);
    form.addEventListener('pointerenter', loadZoho);
  }
  form.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && ev.target.tagName === 'INPUT' && ev.target.type !== 'button') {
      ev.preventDefault();
      document.getElementById('zcWebOptin').click();
    }
  });
  // Zoho reads the chosen Topics from the hidden "oldListIds" field (#allCheckedListIds), which its
  // own script only fills for boxes inside table#listRelTable. Ours aren't, so keep it filled here.
  var ids = form.querySelector('#allCheckedListIds');
  var sel = form.querySelector('select[name="CONTACT_CF1"]');
  var boxes = form.querySelectorAll('input[name="listCheckBox"]');
  function sync() {
    var on = [];
    boxes.forEach(function (cb) {
      if (cb.checked) on.push(cb.value);
      if (sel) Array.prototype.forEach.call(sel.options, function (o) { if (o.value === cb.dataset.shelf) o.selected = cb.checked; });
    });
    if (ids) ids.value = on.join(',');
  }
  boxes.forEach(function (cb) { cb.addEventListener('change', sync); });
  document.getElementById('zcWebOptin').addEventListener('click', sync, true);
  sync();
})();
