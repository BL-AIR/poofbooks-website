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

/* Cover zoom: double-click the cover (or press "Enlarge cover") for a full-screen view you can zoom and drag. */
document.addEventListener('DOMContentLoaded', function () {
  var frame = document.querySelector('.cover-frame');
  if (!frame || !frame.querySelector('img.face')) return;
  var st = document.createElement('style');
  st.textContent = '.czoom{position:fixed;inset:0;z-index:9999;background:rgba(8,6,14,.94);display:flex;align-items:center;justify-content:center;overflow:hidden;touch-action:none}' +
    '.czoom img{max-width:none;max-height:none;user-select:none;-webkit-user-drag:none;cursor:grab;transform-origin:0 0;position:absolute;left:0;top:0}' +
    '.czoom.drag img{cursor:grabbing}' +
    '.czoom-bar{position:fixed;top:12px;right:12px;display:flex;gap:8px;z-index:2}' +
    '.czoom-bar button,.cover-enlarge{font:inherit;color:#fff;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.4);border-radius:8px;padding:.45rem .8rem;cursor:pointer}' +
    '.czoom-bar button:hover,.cover-enlarge:hover{background:rgba(255,255,255,.26)}' +
    '.cover-enlarge{margin-top:.5rem;background:transparent;font-size:.9rem}' +
    '.czoom-hint{position:fixed;bottom:14px;left:0;right:0;text-align:center;color:#ddd;font-size:.85rem;pointer-events:none}';
  document.head.appendChild(st);

  var ov, img, scale, minS, tx, ty, opener;
  function fit() {
    var vw = ov.clientWidth, vh = ov.clientHeight, nw = img.naturalWidth || 800, nh = img.naturalHeight || 1200;
    minS = Math.min(vw / nw, vh / nh); scale = minS;
    tx = (vw - nw * scale) / 2; ty = (vh - nh * scale) / 2; paint();
  }
  function paint() { img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')'; }
  function zoomAt(f, cx, cy) {
    var ns = Math.max(minS, Math.min(minS * 8, scale * f)); f = ns / scale;
    tx = cx - (cx - tx) * f; ty = cy - (cy - ty) * f; scale = ns; clamp(); paint();
  }
  function clamp() {
    var vw = ov.clientWidth, vh = ov.clientHeight, w = img.naturalWidth * scale, h = img.naturalHeight * scale;
    tx = w <= vw ? (vw - w) / 2 : Math.min(0, Math.max(vw - w, tx));
    ty = h <= vh ? (vh - h) / 2 : Math.min(0, Math.max(vh - h, ty));
  }
  function close() { if (!ov) return; document.removeEventListener('keydown', onKey); ov.remove(); ov = null; document.body.style.overflow = ''; if (opener) opener.focus(); }
  function onKey(e) {
    if (e.key === 'Escape') close();
    else if (e.key === '+' || e.key === '=') zoomAt(1.4, ov.clientWidth / 2, ov.clientHeight / 2);
    else if (e.key === '-') zoomAt(1 / 1.4, ov.clientWidth / 2, ov.clientHeight / 2);
    else if (e.key === '0') { fit(); }
    else if (e.key.indexOf('Arrow') === 0) { var d = 60; if (e.key === 'ArrowLeft') tx += d; if (e.key === 'ArrowRight') tx -= d; if (e.key === 'ArrowUp') ty += d; if (e.key === 'ArrowDown') ty -= d; clamp(); paint(); e.preventDefault(); }
    else if (e.key === 'Tab') { e.preventDefault(); }
  }
  function open() {
    var src = frame.querySelector('img.face.' + (frame.getAttribute('data-face') === 'back' ? 'back' : 'front')) || frame.querySelector('img.face');
    if (!src) return;
    opener = document.activeElement;
    ov = document.createElement('div'); ov.className = 'czoom'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Zoomed cover');
    img = document.createElement('img'); img.alt = src.alt; img.draggable = false;
    img.onload = fit; img.src = src.currentSrc || src.src;
    var bar = document.createElement('div'); bar.className = 'czoom-bar';
    [['+', 'Zoom in', function () { zoomAt(1.4, ov.clientWidth / 2, ov.clientHeight / 2); }],
     ['−', 'Zoom out', function () { zoomAt(1 / 1.4, ov.clientWidth / 2, ov.clientHeight / 2); }],
     ['Fit', 'Fit to screen', fit], ['Close', 'Close', close]].forEach(function (b) {
      var x = document.createElement('button'); x.type = 'button'; x.textContent = b[0]; x.setAttribute('aria-label', b[1]); x.addEventListener('click', b[2]); bar.appendChild(x);
    });
    var hint = document.createElement('div'); hint.className = 'czoom-hint'; hint.textContent = 'Scroll or pinch to zoom, drag to move, double-click to zoom in, Esc to close';
    ov.appendChild(img); ov.appendChild(bar); ov.appendChild(hint); document.body.appendChild(ov); document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey); bar.lastChild.focus();
    ov.addEventListener('wheel', function (e) { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY); }, { passive: false });
    ov.addEventListener('dblclick', function (e) { if (e.target.closest('.czoom-bar')) return; if (scale > minS * 1.05) fit(); else zoomAt(3, e.clientX, e.clientY); });
    var pts = {}, lastD = 0, lastX, lastY;
    ov.addEventListener('pointerdown', function (e) { if (e.target.closest('.czoom-bar')) return; pts[e.pointerId] = e; ov.setPointerCapture(e.pointerId); lastX = e.clientX; lastY = e.clientY; ov.classList.add('drag'); });
    ov.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) return; pts[e.pointerId] = e;
      var ids = Object.keys(pts);
      if (ids.length === 2) {
        var a = pts[ids[0]], b = pts[ids[1]], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (lastD) zoomAt(d / lastD, (a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2); lastD = d;
      } else { tx += e.clientX - lastX; ty += e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; clamp(); paint(); }
    });
    function up(e) { delete pts[e.pointerId]; lastD = 0; lastX = e.clientX; lastY = e.clientY; if (!Object.keys(pts).length) ov.classList.remove('drag'); }
    ov.addEventListener('pointerup', up); ov.addEventListener('pointercancel', up);
    window.addEventListener('resize', function () { if (ov) fit(); });
  }
  frame.addEventListener('dblclick', function (e) { e.preventDefault(); open(); });
  var flip = document.querySelector('.cover-flip');
  if (flip) {
    var eb = document.createElement('button'); eb.type = 'button'; eb.className = 'cover-enlarge'; eb.textContent = 'Enlarge cover'; eb.addEventListener('click', open);
    flip.parentNode.insertBefore(eb, flip.nextSibling);
  }
});
