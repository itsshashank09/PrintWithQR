export function individualDownloads(files, { createUrl = URL.createObjectURL, revokeUrl = URL.revokeObjectURL } = {}) {
  const used = new Set(), links = [];
  const cleanup = () => { while (links.length) revokeUrl(links.pop().url); };
  try {
    files.forEach((file, index) => {
      const cleaned = Array.from(String(file.name || `image-${index + 1}`), char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 || '/\\:*?"<>|'.includes(char) ? '_' : char).join('');
      const base = cleaned.replace(/^\.+|[. ]+$/g, '').slice(0, 150) || `image-${index + 1}`;
      const point = base.lastIndexOf('.'), stem = point > 0 ? base.slice(0, point) : base, ext = point > 0 ? base.slice(point) : '';
      let name = base, copy = 1;
      while (used.has(name.toLowerCase())) name = `${stem} (${++copy})${ext}`;
      used.add(name.toLowerCase()); links.push({ name, url: createUrl(file.blob) });
    });
    return { links: [...links], cleanup };
  } catch (error) { cleanup(); throw error; }
}
export function triggerDownloads(links, doc = document) {
  // A single click starts each independent browser download. No ZIP or serial
  // network loop; browsers may require permission for multiple downloads.
  for (const item of links) {
    const link = doc.createElement('a'); link.href = item.url; link.download = item.name;
    doc.body.appendChild(link);
    try { link.click(); } finally { link.remove(); }
  }
}
