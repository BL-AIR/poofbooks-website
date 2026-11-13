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

/* Long text (first page, reviews): show about 10 lines, fading out, with "Read more" to open it all. */
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.prose.extract, .crev .prose').forEach(function (el, i) {
    var words = (el.textContent.match(/\S+/g) || []).length;
    if (words < 150) return;                      // short enough to show whole
    if (!el.id) el.id = 'fold-' + i;
    el.classList.add('fold-body', 'folded');
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'fold-btn';
    b.setAttribute('aria-controls', el.id); b.setAttribute('aria-expanded', 'false');
    b.textContent = 'Read more';
    el.parentNode.insertBefore(b, el.nextSibling);
    b.addEventListener('click', function () {
      var open = el.classList.toggle('folded') === false;
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
      b.textContent = open ? 'Show less' : 'Read more';
      if (!open && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start' });
    });
  });
});
