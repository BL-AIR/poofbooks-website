/* Bedfellows plate on Big Daddy's trunk (the Cabin room: /the-cabin/ and /find-a-book/).
   The plate is pinned to the trunk's front panel in the room picture, under the handle.
   Its corners are measured in the 1280x720 cabin.webp, mapped through the picture's
   object-fit: cover, and the link is warped onto them with a perspective (matrix3d) transform,
   so the plate and its lettering follow the panel's angle at any window size.
   When the trunk is cropped off (narrower windows, phones) or something covers it, the plate hides. */
(function () {
  'use strict';
  // Front panel, under the handle: top-left, top-right, bottom-right, bottom-left (picture pixels).
  // Angle set by eye with Blair (1 Nov 2026): between the panel's board lines and its lower edge.
  var QUAD = [[72, 542.8], [166, 521.2], [166, 548], [72, 570]];
  var W = 300, H = 84; // the plate's own (unwarped) size in CSS pixels

  function homography(q) {
    var x0 = q[0][0], y0 = q[0][1], x1 = q[1][0], y1 = q[1][1], x2 = q[2][0], y2 = q[2][1], x3 = q[3][0], y3 = q[3][1];
    var sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
    var dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
    var den = dx1 * dy2 - dx2 * dy1;
    var g = (sx * dy2 - dx2 * sy) / den, h = (dx1 * sy - sx * dy1) / den;
    var a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, d = y1 - y0 + g * y1, e = y3 - y0 + h * y3;
    return 'matrix3d(' + [a / W, d / W, 0, g / W, b / H, e / H, 0, h / H, 0, 0, 1, 0, x0, y0, 0, 1].join(',') + ')';
  }

  function hits(r, pts) {
    var minX = Math.min.apply(null, pts.map(function (p) { return p[0]; })), maxX = Math.max.apply(null, pts.map(function (p) { return p[0]; }));
    var minY = Math.min.apply(null, pts.map(function (p) { return p[1]; })), maxY = Math.max.apply(null, pts.map(function (p) { return p[1]; }));
    return !(r.right < minX || r.left > maxX || r.bottom < minY || r.top > maxY) && r.width > 0;
  }

  function place(room, img, plate) {
    var R = room.getBoundingClientRect();
    if (!R.width || !img.naturalWidth) { plate.hidden = true; return; }
    var I = img.getBoundingClientRect();
    var s = Math.max(I.width / 1280, I.height / 720);
    var pos = getComputedStyle(img).objectPosition.split(' ');
    var px = parseFloat(pos[0]) / 100, py = parseFloat(pos[1] || pos[0]) / 100;
    if (isNaN(px)) px = 0.5; if (isNaN(py)) py = 0.5;
    var ox = (I.left - R.left) + (I.width - 1280 * s) * px, oy = (I.top - R.top) + (I.height - 720 * s) * py;
    var pts = QUAD.map(function (p) { return [ox + p[0] * s, oy + p[1] * s]; });
    var m = 6, inside = pts.every(function (p) { return p[0] >= m && p[0] <= R.width - m && p[1] >= m && p[1] <= R.height - m; });
    // Page-coordinate corners, to check nothing in the room sits on top of the trunk.
    var abs = pts.map(function (p) { return [R.left + p[0], R.top + p[1]]; });
    var covered = Array.prototype.some.call(room.querySelectorAll('.welcome, .speech, .fig-play, .finder, form'), function (el) {
      return hits(el.getBoundingClientRect(), abs);
    });
    plate.hidden = !inside || covered || window.innerWidth <= 760;
    if (!plate.hidden) plate.style.transform = homography(pts);
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('.room'), function (room) {
      var img = room.querySelector('.room-bg');
      if (!img || !/\/cabin\.webp/.test(img.getAttribute('src') || '')) return;
      var plate = document.createElement('a');
      plate.className = 'trunk-plate';
      plate.href = '/bedfellows/';
      plate.hidden = true;
      plate.innerHTML = '<span>Bedfellows</span>';
      room.appendChild(plate);
      var go = function () { place(room, img, plate); };
      if (img.complete) go(); else img.addEventListener('load', go);
      if (window.ResizeObserver) new ResizeObserver(go).observe(room);
      window.addEventListener('resize', go);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(go);
      setTimeout(go, 600);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
