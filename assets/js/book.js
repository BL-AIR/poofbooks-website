/* Poof Books book page: front/back cover toggle. */
document.addEventListener('DOMContentLoaded', function () {
  var frame = document.querySelector('.cover-frame');
  var btns = document.querySelectorAll('.cover-flip button');
  if (!frame || !btns.length) return;
  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      var face = b.getAttribute('data-face');
      frame.setAttribute('data-face', face);
      btns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    });
  });
  frame.addEventListener('click', function () {
    var next = frame.getAttribute('data-face') === 'front' ? 'back' : 'front';
    var t = document.querySelector('.cover-flip button[data-face="' + next + '"]');
    if (t) t.click();
  });
});
