import { fail, MAX_BYTES } from './security.js';

// Inspect ZIP directory metadata only. Never inflate or execute archive entries.
export async function validateZip(bytes) {
  if (!bytes.length || bytes.length > MAX_BYTES || bytes[0] !== 80 || bytes[1] !== 75) throw fail(400, 'This file is not a ZIP archive.');
  const { ZipReader, Uint8ArrayReader } = await import('@zip.js/zip.js');
  const reader = new ZipReader(new Uint8ArrayReader(bytes), { strictness: 'strict', useWebWorkers: false });
  let entries = 0, files = 0, expanded = 0;
  try {
    for await (const entry of reader.getEntriesGenerator()) {
      if (++entries > 1000) throw fail(400, 'ZIP archives may contain up to 1,000 entries.');
      const path = entry.filename.replaceAll('\\', '/');
      if (!path || path.startsWith('/') || Array.from(path).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 || char === ':') || path.split('/').some(part => part === '..') || entry.symlink) throw fail(400, 'This ZIP contains unsafe file paths or links.');
      if (!Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize < 0) throw fail(400, 'This ZIP contains invalid file sizes.');
      expanded += entry.uncompressedSize;
      if (expanded > 500 * 1024 * 1024) throw fail(400, 'ZIP contents exceed the 500 MB expanded-size limit.');
      if (!entry.directory) files++;
    }
    if (!files) throw fail(400, 'Choose a ZIP containing at least one file.');
    return { archiveFiles: files };
  } catch (error) {
    if (error.status) throw error;
    throw fail(400, 'This ZIP is damaged or unsupported. Create a standard ZIP and try again.');
  } finally { await reader.close(); }
}
