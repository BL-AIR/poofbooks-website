// Mounts the "Look inside" viewer wherever a book page carries a preview (14 Nov 2026).
// The build (build_full.py) bakes each published preview from D1 (v_work_preview_published) into <div class="look-inside" data-preview="{…}">,
// so no API call is made per page view. The PDF viewer (PDF.js) is only downloaded on pages that have a preview.
const nodes = document.querySelectorAll('.look-inside[data-preview]');
if (nodes.length) {
  import('/assets/look-inside/look-inside.js?v=202611150040').then(({ mountLookInside }) => {
    nodes.forEach((n) => { try { mountLookInside(n, JSON.parse(n.dataset.preview)); } catch (e) { n.hidden = true; } });
  });
}
