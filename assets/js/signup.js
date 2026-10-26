/* Poof Books: helpers for the Zoho Campaigns sign-up form (Looker List / Keep me posted).
   - Enter in a field submits, as a normal form would (Zoho's button is type="button").
   - Shelf ticks are Campaigns Topics (listCheckBox); each tick is mirrored into the hidden
     "Shelves" field (CONTACT_CF1) so it also reaches the Lead in Zoho CRM. */
(function () {
  'use strict';
  var form = document.getElementById('zcampaignOptinForm');
  if (!form) return;
  form.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && ev.target.tagName === 'INPUT' && ev.target.type !== 'button') {
      ev.preventDefault();
      document.getElementById('zcWebOptin').click();
    }
  });
  var sel = form.querySelector('select[name="CONTACT_CF1"]');
  if (!sel) return;
  form.querySelectorAll('.shelf-chip input').forEach(function (cb) {
    cb.addEventListener('change', function () {
      Array.prototype.forEach.call(sel.options, function (o) { if (o.value === cb.dataset.shelf) o.selected = cb.checked; });
    });
  });
})();
