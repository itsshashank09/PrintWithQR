// ZIP "store" format: images are already compressed. Preserve original bytes,
// stream CRC calculation, and compose Blob parts without copying every image.
const encoder = new TextEncoder();
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value; for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ crc >>> 1 : crc >>> 1; return crc >>> 0;
});
async function crc32(blob, signal) {
  let crc = 0xffffffff; const reader = blob.stream().getReader();
  try {
    for (;;) {
      signal?.throwIfAborted(); const { value, done } = await reader.read(); if (done) break;
      for (const byte of value) crc = crcTable[(crc ^ byte) & 255] ^ crc >>> 8;
    }
    return (crc ^ 0xffffffff) >>> 0;
  } finally { await reader.cancel(); reader.releaseLock(); }
}
function safeName(name, index, used) {
  const cleaned = Array.from(String(name || `image-${index + 1}`), character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 || '/\\:*?"<>|'.includes(character) ? '_' : character).join('');
  const base = cleaned.replace(/^\.+|[. ]+$/g, '').slice(0, 150) || `image-${index + 1}`;
  const point = base.lastIndexOf('.'), stem = point > 0 ? base.slice(0, point) : base, extension = point > 0 ? base.slice(point) : '';
  let value = base, copy = 1;
  while (used.has(value.toLowerCase())) value = `${stem} (${++copy})${extension}`;
  used.add(value.toLowerCase()); return value;
}
function header(size) { const bytes = new Uint8Array(size); return { bytes, view: new DataView(bytes.buffer) }; }
export async function imageZip(files, { signal, onProgress } = {}) {
  if (!files.length || files.length > 20) throw new Error('Select 1–20 images.');
  const parts = [], central = [], names = new Set(); let offset = 0, directorySize = 0;
  for (let index = 0; index < files.length; index++) {
    signal?.throwIfAborted(); const { blob } = files[index];
    if (!blob || blob.size > 0xffffffff || offset + blob.size > 0xffffffff) throw new Error('Archive exceeds the supported size.');
    onProgress?.(`Packing image ${index + 1} of ${files.length}…`);
    const name = encoder.encode(safeName(files[index].name, index, names)), crc = await crc32(blob, signal);
    const local = header(30); local.view.setUint32(0, 0x04034b50, true); local.view.setUint16(4, 20, true); local.view.setUint16(6, 0x800, true);
    local.view.setUint16(12, 33, true); local.view.setUint32(14, crc, true); local.view.setUint32(18, blob.size, true); local.view.setUint32(22, blob.size, true); local.view.setUint16(26, name.length, true);
    parts.push(local.bytes, name, blob);
    const record = header(46); record.view.setUint32(0, 0x02014b50, true); record.view.setUint16(4, 20, true); record.view.setUint16(6, 20, true); record.view.setUint16(8, 0x800, true);
    record.view.setUint16(14, 33, true); record.view.setUint32(16, crc, true); record.view.setUint32(20, blob.size, true); record.view.setUint32(24, blob.size, true); record.view.setUint16(28, name.length, true); record.view.setUint32(42, offset, true);
    central.push(record.bytes, name); directorySize += 46 + name.length; offset += 30 + name.length + blob.size;
  }
  signal?.throwIfAborted();
  const end = header(22); end.view.setUint32(0, 0x06054b50, true); end.view.setUint16(8, files.length, true); end.view.setUint16(10, files.length, true); end.view.setUint32(12, directorySize, true); end.view.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.bytes], { type: 'application/zip' });
}
