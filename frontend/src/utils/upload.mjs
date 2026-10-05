export async function countPdfPages(bytes) {
  const { PDFDocument } = await import('pdf-lib');
  const pages = (await PDFDocument.load(bytes)).getPageCount();
  selectedPageCount(pages, 'all');
  return pages;
}

export function estimateFiles(files, { rangeType = 'all', rangeCustom = '', rate }) {
  let rangeError = '', totalPages = 0, totalCents = 0;
  const estimates = files.map(item => {
    try {
      if (item.type === 'zip') return { pages: null, amount: null, pricePending: true };
      if (!Number.isFinite(rate) || rate < 0) throw new Error('The counter’s printing rate is unavailable.');
      const pages = selectedPageCount(item.pages, rangeType, rangeCustom);
      if (pages === 0) throw new Error(`${item.file.name} has no pages in this selection. Choose All pages.`);
      const cents = Math.round((pages * rate + Number.EPSILON) * 100);
      totalPages += pages; totalCents += cents;
      return { pages, amount: cents / 100 };
    } catch (error) { rangeError = error.message; return { pages: 0, amount: 0 }; }
  });
  return { estimates, rangeError, totalPages, totalAmount: totalCents / 100 };
}

export function selectedPageCount(total, type, range = '') {
  if (!Number.isInteger(total) || total < 1 || total > 2000) throw new Error('Documents must contain 1–2,000 pages.');
  if (type === 'all') return total;
  if (type === 'odd') return Math.ceil(total / 2);
  if (type === 'even') return Math.floor(total / 2);
  if (type !== 'custom' || !range.trim()) throw new Error('Enter a page range, for example 1-3, 5.');
  const selected = new Set();
  for (const part of range.split(',')) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error('Use page numbers or ranges separated by commas.');
    const first = Number(match[1]), last = Number(match[2] || first);
    if (first < 1 || last < first || last > total) throw new Error(`The range must fit every selected file (this file has ${total} pages).`);
    for (let page = first; page <= last; page++) selected.add(page);
  }
  return selected.size;
}

export function uploadQueueProgress(files) {
  const total = files.reduce((sum, entry) => sum + entry.file.size, 0);
  const confirmed = new Set(files.filter(entry => entry.uploadIntent));
  let bytes = files.reduce((sum, entry) => sum + (confirmed.has(entry) ? entry.file.size : 0), 0);
  let percent = total ? Math.round(bytes / total * 100) : 0;
  return {
    get percent() { return percent; },
    update(entry, filePercent = 0) {
      const next = total ? Math.round((bytes + (confirmed.has(entry) ? 0 : entry.file.size * Math.max(0, Math.min(100, filePercent)) / 100)) / total * 100) : 0;
      percent = Math.max(percent, Math.min(confirmed.size === files.length ? 100 : 99, next));
      return percent;
    },
    confirm(entry) {
      if (!confirmed.has(entry)) { confirmed.add(entry); bytes += entry.file.size; }
      percent = total ? Math.round(bytes / total * 100) : 0;
      return percent;
    }
  };
}

export function uploadWithProgress({ url, projectUrl, file, onProgress, signal, xhrFactory = () => new XMLHttpRequest() }) {
  const target = new URL(url), project = new URL(projectUrl);
  if (target.origin !== project.origin || !target.pathname.startsWith('/storage/v1/object/upload/sign/print-jobs/') || !target.searchParams.has('token')) throw new Error('Invalid upload authorization.');
  return new Promise((resolve, reject) => {
    const xhr = xhrFactory();
    let settled = false;
    const abort = () => xhr.abort();
    const finish = (error) => { if (settled) return; settled = true; xhr.upload.onprogress = null; signal?.removeEventListener('abort', abort); if (error) reject(error); else resolve(); };
    xhr.open('PUT', target.href);
    xhr.timeout = 180000;
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress?.(Math.min(100, Math.round(event.loaded / event.total * 100))); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { onProgress?.(100); finish(); }
      else finish(new Error(xhr.status === 413 ? 'This file exceeds the 50 MB limit.' : 'Upload was not confirmed. Check your connection and retry.'));
    };
    xhr.onerror = () => finish(new Error('Connection lost. Your selected files are still here. Retry when you are connected.'));
    xhr.ontimeout = () => finish(new Error('Upload took too long. Your selected files are still here. Try again on a stronger connection.'));
    xhr.onabort = () => { const error = new Error('Upload paused. You can retry with your selected files.'); error.name = 'AbortError'; finish(error); };
    if (signal?.aborted) { finish(new Error('Upload cancelled.')); return; }
    signal?.addEventListener('abort', abort, { once: true });
    const data = new FormData(); data.append('cacheControl', '3600'); data.append('', file);
    xhr.send(data);
  });
}
