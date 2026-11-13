// Poof Books "Look inside" viewer (13 Nov 2026). Shows a supplied PDF a page at a time.
// Usage:  import { mountLookInside } from '/_lookinside/look-inside.js';
//         mountLookInside(document.getElementById('look-inside'), api.preview);   // api.preview = the Worker's 'preview' object
// What it does and doesn't do:
//  * pages are drawn to a canvas; there is no download button unless the supplier allowed it (allowDownload).
//    A browser can still save what it shows, so this is a courtesy to the supplier, not protection.
//  * the plain-text version of the same pages (textAltParagraphs) is always offered, for screen readers and Sound-only readers.
//  * advisory 'adult' puts a notice in front of everything, including the text, until the reader confirms.
import * as pdfjs from './vendor/pdf.min.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;

const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'class') n.className = v; else if (v === true) n.setAttribute(k, ''); else if (v !== false && v != null) n.setAttribute(k, v); }
  for (const kid of kids) n.append(kid);
  return n;
};

export function mountLookInside(root, preview, opts = {}) {
  if (!root) return;
  // No PDF on file: the whole section disappears (the container and, on a book page, the section with its heading and its "On this page" entry).
  const sec = root.closest ? root.closest('.bsec') : null;
  const hide = !preview || !preview.url;
  root.hidden = hide; if (sec) sec.hidden = hide;
  if (hide) { root.replaceChildren(); return; }
  const paras = preview.textAltParagraphs && preview.textAltParagraphs.length ? preview.textAltParagraphs : (preview.textAlt || '').split(/\n\s*\n/).filter(Boolean);
  const textId = 'li-text-' + Math.random().toString(36).slice(2, 8);
  const shell = el('div', { class: 'li', role: 'group', 'aria-label': 'Look inside this book' });
  // The whole preview sits in a fold, closed by default (opts.open = true to start open). Nothing is fetched or drawn until it is opened.
  const total = preview.pages ? (preview.pageLimit ? Math.min(preview.pages, preview.pageLimit) : preview.pages) : 0;
  const fold = el('details', { class: 'li-fold' });
  fold.append(el('summary', {}, el('span', { class: 'li-title' }, 'Look inside'), el('span', { class: 'li-count' }, total ? ' \u00b7 ' + total + ' page' + (total === 1 ? '' : 's') : '')), shell);
  root.replaceChildren(fold);

  const textBlock = () => {
    const d = el('details', { class: 'li-text', id: textId });
    d.append(el('summary', {}, 'Read these pages as text'));
    const body = el('div', { class: 'li-prose' });
    paras.forEach((p) => body.append(el('p', {}, p)));
    d.append(body);
    return d;
  };

  const start = () => {
    shell.replaceChildren();
    let pdf = null, page = 1, zoom = 1, task = null, token = 0;
    const prev = el('button', { type: 'button', class: 'li-btn', 'aria-label': 'Previous page' }, '← Prev');
    const next = el('button', { type: 'button', class: 'li-btn', 'aria-label': 'Next page' }, 'Next →');
    const zout = el('button', { type: 'button', class: 'li-btn', 'aria-label': 'Zoom out' }, '−');
    const zin = el('button', { type: 'button', class: 'li-btn', 'aria-label': 'Zoom in' }, '+');
    const full = el('button', { type: 'button', class: 'li-btn', 'aria-label': 'Full screen' }, 'Full screen');
    const status = el('div', { class: 'li-status', 'aria-live': 'polite' }, 'Loading…');
    const bar = el('div', { class: 'li-bar' }, prev, status, next, zout, zin);
    if (shell.requestFullscreen) bar.append(full);
    const canvas = el('canvas', { role: 'img', 'aria-label': 'A page of the book. The same pages are available as text below.' });
    const stage = el('div', { class: 'li-stage', tabindex: '0', 'aria-label': 'Preview pages. Use the left and right arrow keys to turn pages.' }, canvas);
    const skip = el('a', { class: 'li-vh', href: '#' + textId }, 'Skip to the text version');
    const note = el('p', { class: 'li-note' });
    shell.append(skip, bar, stage, note, textBlock());
    if (preview.allowDownload) note.append(el('a', { href: preview.url, download: '' }, 'Download these pages (PDF)'));

    const limit = () => Math.min(pdf.numPages, preview.pageLimit || pdf.numPages);
    const draw = async () => {
      if (!pdf) return;
      const my = ++token;
      if (task) { try { task.cancel(); } catch (e) {} }
      const pg = await pdf.getPage(page);
      if (my !== token) return;
      const base = pg.getViewport({ scale: 1 });
      const avail = Math.max(240, stage.clientWidth - 2);
      const scale = (avail / base.width) * zoom;
      const dpr = window.devicePixelRatio || 1;
      const vp = pg.getViewport({ scale: scale * dpr });
      canvas.width = Math.floor(vp.width); canvas.height = Math.floor(vp.height);
      canvas.style.width = Math.floor(vp.width / dpr) + 'px'; canvas.style.height = Math.floor(vp.height / dpr) + 'px';
      task = pg.render({ canvasContext: canvas.getContext('2d'), viewport: vp });
      try { await task.promise; } catch (e) { if (e && e.name !== 'RenderingCancelledException') throw e; }
      status.textContent = `Page ${page} of ${limit()}`;
      prev.disabled = page <= 1; next.disabled = page >= limit();
      zout.disabled = zoom <= 1; zin.disabled = zoom >= 3;
    };
    const go = (n) => { const t = Math.min(Math.max(1, n), limit()); if (t !== page) { page = t; draw(); } };
    prev.onclick = () => go(page - 1); next.onclick = () => go(page + 1);
    zin.onclick = () => { zoom = Math.min(3, +(zoom + 0.5).toFixed(1)); draw(); };
    zout.onclick = () => { zoom = Math.max(1, +(zoom - 0.5).toFixed(1)); draw(); };
    full.onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else shell.requestFullscreen(); };
    stage.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); go(page + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); go(page - 1); } });
    let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(draw, 150); });
    document.addEventListener('fullscreenchange', () => setTimeout(draw, 100));

    pdfjs.getDocument({ url: preview.url }).promise.then((d) => { pdf = d; return draw(); }).catch(() => {
      status.textContent = '';
      stage.replaceChildren(el('p', { class: 'li-err', role: 'alert' }, 'These pages could not be loaded. You can still read them as text below.'));
      [prev, next, zin, zout, full].forEach((b) => { b.disabled = true; });
      const t = shell.querySelector('details'); if (t) t.open = true;
    });
  };

  let started = false;
  const init = () => {
    if (started) return; started = true;
    if (preview.advisory === 'adult') {
      const btn = el('button', { type: 'button', class: 'li-btn' }, 'I\u2019m 18 or over \u2014 show these pages');
      btn.onclick = start;
      shell.append(el('div', { class: 'li-gate' }, el('p', {}, 'These pages are for adult readers (18+).'), btn));
    } else start();
  };
  fold.addEventListener('toggle', () => { if (fold.open) init(); });
  if (opts.open) fold.open = true;
}
