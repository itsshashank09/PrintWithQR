import { authorizeShop, BUCKET, fail, fileKeys } from './security.js';
import { documentSeconds, QUEUE_WAIT_MS } from './queue-clock.js';

// One request authorizes the entire batch before signing any document.
export async function signedFileBatch(client, userId, files, { startPrinting = false } = {}) {
  if (typeof startPrinting !== 'boolean') throw fail(400, 'Invalid print preparation request.');
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  if (!Array.isArray(files) || !files.length || files.length > 20 || files.some(file => !file || typeof file.orderId !== 'string' || !uuid.test(file.orderId) || !Number.isInteger(file.index) || file.index < 0 || file.index >= 20)) throw fail(400, 'Select 1–20 valid document references.');
  const ids = [...new Set(files.map(file => file.orderId))];
  const { data: orders, error } = await client.from('orders').select('id,shop_id,file_path,status,created_at,completed_at,file_deleted_at,print_options').in('id', ids);
  if (error) throw fail(503, 'Unable to verify documents.');
  if (!orders || orders.length !== ids.length) throw fail(404, 'Document access is unavailable.');
  if (orders.some(order => order.shop_id !== orders[0].shop_id)) throw fail(403, 'Documents must belong to one authorized shop.');
  await authorizeShop(client, userId, orders[0].shop_id);
  const lookup = new Map(orders.map(order => [order.id, order]));
  let expiry = 120;
  const paths = files.map(file => {
    const order = lookup.get(file.orderId), remaining = documentSeconds(order);
    if (!remaining) throw fail(410, 'This document has expired.');
    const keys = fileKeys(order);
    if (file.index >= keys.length) throw fail(400, 'Invalid document index.');
    expiry = Math.min(expiry, remaining);
    return keys[file.index];
  });
  if (startPrinting && orders.some(order => !['Pending', 'Printing'].includes(order.status))) throw fail(409, 'Some jobs are no longer active. Refresh the queue.');
  if (startPrinting && paths.some(path => /\.zip$/i.test(path))) throw fail(400, 'ZIP files are download-only.');
  const { data, error: signError } = await client.storage.from(BUCKET).createSignedUrls([...new Set(paths)], expiry);
  if (signError || !Array.isArray(data)) throw fail(410, 'Document is unavailable or has expired.');
  const urls = new Map(data.map(item => [item.path, item.error ? null : item.signedUrl]));
  if (paths.some(path => !urls.get(path))) throw fail(410, 'Document is unavailable or has expired.');
  if (startPrinting) {
    const pending = orders.filter(order => order.status === 'Pending').map(order => order.id);
    if (pending.length) {
      // Only the already-authorized, active selection can change. A failed
      // transfer remains retryable in Printing; never mark it Completed here.
      const { data: changed, error: updateError } = await client.from('orders').update({ status: 'Printing' }).in('id', pending).eq('shop_id', orders[0].shop_id).eq('status', 'Pending').gt('created_at', new Date(Date.now() - QUEUE_WAIT_MS).toISOString()).select('id');
      if (updateError || changed?.length !== pending.length) throw fail(409, 'Some jobs changed. Refresh and retry printing.');
    }
  }
  return { files: files.map((file, index) => ({ orderId: file.orderId, index: file.index, url: urls.get(paths[index]) })), expiresIn: expiry, printingStarted: startPrinting };
}
