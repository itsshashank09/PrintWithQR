import { BUCKET, fileKeys, fail } from './security.js';
import { QUEUE_WAIT_MS, waitingExpired } from './queue-clock.js';

// Cancelling is an atomic conditional write. Printing/Done wins if it already
// changed the row; a stale candidate must never authorize deletion.
export async function expireWaitingOrder(client, order, now = Date.now()) {
  if (!waitingExpired(order, now)) return false;
  const { data, error } = await client.from('orders').update({
    status: 'Cancelled', completed_at: new Date(now).toISOString(),
    print_options: { ...order.print_options, queueExpiredAt: new Date(now).toISOString() }
  }).eq('id', order.id).eq('shop_id', order.shop_id).eq('status', 'Pending')
    .lte('created_at', new Date(now - QUEUE_WAIT_MS).toISOString()).is('file_deleted_at', null).select('id');
  if (error) throw fail(503, 'Unable to expire waiting order.');
  return data?.length === 1;
}

export async function deleteOrderFiles(client, order, now = Date.now()) {
  const keys = fileKeys(order);
  const { error } = await client.storage.from(BUCKET).remove(keys);
  if (error) throw fail(503, 'Document deletion will be retried.');
  const { error: markError } = await client.from('orders').update({ file_deleted_at: new Date(now).toISOString() }).eq('id', order.id).eq('shop_id', order.shop_id).in('status', ['Completed', 'Cancelled']);
  if (markError) throw fail(503, 'Document deletion confirmation will be retried.');
  return keys.length;
}
