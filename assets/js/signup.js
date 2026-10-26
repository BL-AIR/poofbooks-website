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
