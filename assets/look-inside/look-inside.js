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
    const wrap = el('div', { class: 'li-text-wrap' }, d);
    const lb = listenButton();
    if (lb) wrap.append(lb);
    return wrap;
  };

  // Listen (Blair, 14 Nov 2026). A recording (preview.audioUrl, e.g. ElevenLabs) wins; otherwise the reader's own browser voice
  // (Web Speech API: free, no account; quality depends on the device) reads the text version, which holds only the story pages.
  let stopListening = () => {};
  const listenButton = () => {
    const synth = window.speechSynthesis;
    if (!preview.audioUrl && !(synth && window.SpeechSynthesisUtterance)) return null;
    const btn = el('button', { type: 'button', class: 'li-btn li-listen', 'aria-pressed': 'false' }, 'Listen');
    const show = (state) => { btn.textContent = state === 'playing' ? 'Pause' : state === 'paused' ? 'Resume' : 'Listen'; btn.setAttribute('aria-pressed', state === 'playing' ? 'true' : 'false'); };
    if (preview.audioUrl) {
      const audio = new Audio(); audio.preload = 'none';
      audio.addEventListener('ended', () => show('idle')); audio.addEventListener('pause', () => { if (!audio.ended) show(audio.currentTime ? 'paused' : 'idle'); });
      audio.addEventListener('play', () => show('playing'));
      btn.onclick = () => { if (!audio.src) audio.src = preview.audioUrl; if (audio.paused) audio.play().catch(() => show('idle')); else audio.pause(); };
      stopListening = () => { audio.pause(); try { audio.currentTime = 0; } catch (e) {} show('idle'); };
      return btn;
    }
    // Browser voice: speak sentence by sentence (long utterances get cut off in some browsers). Accents are stripped for the voice only
    // (ḥammām → hammam), which most voices handle better; the text on screen is unchanged.
    const plainSay = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
    const chunks = paras.flatMap((p) => (plainSay(p).match(/[^.!?…]+[.!?…]+["')\]]*\s*|[^.!?…]+$/g) || [plainSay(p)]).map((x) => x.trim()).filter(Boolean));
    const pickVoice = () => {
      const vs = synth.getVoices().filter((v) => /^en/i.test(v.lang));
      const good = (v) => /premium|enhanced|natural|neural|siri|google/i.test(v.name);
      const by = (lang) => vs.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(lang));
      return [...by('en-au'), ...by('en-gb'), ...vs].sort((a, b) => good(b) - good(a))[0] || null;
    };
    let i = 0, state = 'idle', run = 0;
    const speakNext = (my) => {
      if (my !== run || state !== 'playing') return;
      if (i >= chunks.length) { state = 'idle'; i = 0; show(state); return; }
      const u = new SpeechSynthesisUtterance(chunks[i]);
      const v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-AU';
      u.rate = 0.95;
      u.onend = () => { if (my === run && state === 'playing') { i++; speakNext(my); } };
      u.onerror = (e) => { if (e.error !== 'interrupted' && e.error !== 'canceled' && my === run) { state = 'idle'; show(state); } };
      synth.speak(u);
    };
    btn.onclick = () => {
      if (state === 'playing') { state = 'paused'; run++; synth.cancel(); }      // pause = stop after this sentence's start; resume repeats it
      else { state = 'playing'; synth.cancel(); speakNext(++run); }
      show(state);
    };
    stopListening = () => { run++; state = 'idle'; i = 0; synth.cancel(); show(state); };
    window.addEventListener('pagehide', () => stopListening());
    return btn;
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
      // At normal size the whole page shows with no scroll bar (Blair, 14 Nov 2026): fit the width on the page, and in full screen
      // fit the whole page to the screen. Zooming in brings scrolling back.
      const fs = document.fullscreenElement === shell;
      let scale = avail / base.width;
      if (fs) scale = Math.min(scale, Math.max(200, window.innerHeight - 150) / base.height);
      scale *= zoom;
      stage.classList.toggle('li-fit', zoom === 1);
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
  fold.addEventListener('toggle', () => { if (fold.open) init(); else stopListening(); });
  if (opts.open) fold.open = true;
}
