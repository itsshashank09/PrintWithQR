const PAPER = { A4: ['210mm', '297mm', 'A4 portrait'], Letter: ['215.9mm', '279.4mm', 'letter portrait'], '16:9': ['279.4mm', '157.16mm', '279.4mm 157.16mm'] };
export function initialisePrintWindow(win) {
  win.document.open();
  win.document.write('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow, nosnippet, noimageindex"><meta name="referrer" content="no-referrer"><title>PrintWithQR — Image print job</title></head><body><p id="print-message" role="status">Preparing every image for one print job…</p><main id="image-pages"></main></body></html>');
  win.document.close(); win.opener = null;
}
function loadImage(img, url, signal) {
  return new Promise((resolve, reject) => {
    let timer, finished = false;
    const abort = () => finish(new Error('Print preparation cancelled.'));
    const finish = error => { if (finished) return; finished = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); img.onload = null; img.onerror = null; if (error) reject(error); else resolve(); };
    img.onload = async () => {
      try {
        if (typeof img.decode === 'function') await img.decode();
        if (!img.naturalWidth || !img.naturalHeight) throw new Error('Image dimensions are unavailable.');
        finish();
      } catch { finish(new Error('An image could not be rendered. Nothing was printed.')); }
    };
    img.onerror = () => finish(new Error('An image could not be rendered. Nothing was printed.'));
    timer = setTimeout(() => finish(new Error('An image did not finish loading. Nothing was printed.')), 45000);
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true }); img.src = url;
  });
}
export async function prepareImagePrint(win, files, { signal, createUrl = URL.createObjectURL, revokeUrl = URL.revokeObjectURL } = {}) {
  if (!files.length || win.closed) throw new Error('The print window was closed. Retry printing.');
  const paperSize = files[0].paperSize || 'A4';
  if (!PAPER[paperSize] || files.some(file => (file.paperSize || 'A4') !== paperSize)) throw new Error('Images need matching paper sizes for one print job.');
  const [width, height, size] = PAPER[paperSize], urls = [];
  const preparation = new AbortController(), cancel = () => preparation.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) preparation.abort();
  const cleanup = () => { while (urls.length) revokeUrl(urls.pop()); };
  const doc = win.document, style = doc.createElement('style');
  style.textContent = `html,body{margin:0;padding:0;background:white;color:#14171f;font-family:system-ui}#print-message{padding:16px}.image-page{box-sizing:border-box;width:${width};height:${height};padding:8mm;display:flex;align-items:center;justify-content:center;break-inside:avoid;break-after:page;page-break-after:always}.image-page:last-child{break-after:auto;page-break-after:auto}.image-page img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;display:block}.image-page.bw img{filter:grayscale(1);-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:${size};margin:0}@media screen{.image-page{margin:16px auto;box-shadow:0 1px 12px #aaa}}@media print{#print-message{display:none}}`;
  doc.head.appendChild(style);
  const pages = doc.getElementById('image-pages');
  try {
    await Promise.all(files.map(file => {
      const page = doc.createElement('section'), img = doc.createElement('img');
      page.className = `image-page ${file.printType === 'bw' ? 'bw' : ''}`; img.alt = file.name;
      // Every page is needed for this print job; lazy image loading can leave
      // off-screen pages blank. Decode in parallel without delaying the UI.
      img.loading = 'eager'; img.decoding = 'async'; img.fetchPriority = 'high';
      page.appendChild(img); pages.appendChild(page);
      const url = createUrl(file.blob); urls.push(url); return loadImage(img, url, preparation.signal);
    }));
    signal?.throwIfAborted(); if (win.closed) throw new Error('The print window was closed.');
    doc.getElementById('print-message').textContent = `${files.length} images ready. Choose your printer and requested duplex setting. Mark the jobs Done only after collecting the printouts.`;
    return cleanup;
  } catch (error) { preparation.abort(); cleanup(); throw error; }
  finally { signal?.removeEventListener('abort', cancel); }
}
