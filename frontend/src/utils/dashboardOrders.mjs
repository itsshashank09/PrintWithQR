const active = order => ['Pending', 'Printing'].includes(order.status || 'Pending');
function list(value) {
  try { const parsed = typeof value === 'string' && value.startsWith('[') ? JSON.parse(value) : [value]; return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}
export function orderFiles(order) {
  const paths = list(order.file_path), names = list(order.file_name);
  return paths.map((path, index) => ({ orderId: order.id, index, path, name: typeof names[index] === 'string' && names[index] ? names[index] : `image-${index + 1}`, printType: order.print_type || 'bw', paperSize: order.paper_size || 'A4' })).filter(file => typeof file.path === 'string' && file.path);
}
export function isImageOrder(order) {
  const files = orderFiles(order);
  return files.length > 0 && files.every(file => /\.(png|jpe?g|webp|gif|bmp)(?:\?|$)/i.test(file.path));
}
export function isArchiveOrder(order) {
  return order.print_options?.fileKind === 'zip' || /\.zip$/i.test(String(order.file_path || ''));
}
export function dashboardGroups(orders) {
  const groups = [], images = new Map();
  for (const order of orders.filter(active)) {
    const image = isImageOrder(order);
    // Never combine different customers using filenames, timestamps or shop alone.
    const batch = image && /^[a-f0-9]{64}$/.test(order.customer_access_hash || '')
      ? [order.shop_id, order.customer_access_hash, order.print_type, order.paper_size, Boolean(order.duplex)].join(':') : order.id;
    let group = image ? images.get(batch) : null;
    if (!group) {
      group = { ...order, groupOrders: [], isImageGroup: image, isArchive: isArchiveOrder(order) };
      groups.push(group); if (image) images.set(batch, group);
    }
    group.groupOrders.push(order);
  }
  return groups.map(group => {
    const members = group.groupOrders.sort((a, b) => (a.print_options?.batchIndex ?? 0) - (b.print_options?.batchIndex ?? 0) || Date.parse(a.created_at) - Date.parse(b.created_at));
    const printing = members.filter(order => order.status === 'Printing').length;
    return { ...group, groupOrders: members, id: members[0].id, files: members.flatMap(orderFiles), pages_to_print: members.reduce((sum, order) => sum + Number(order.pages_to_print || 0), 0), total_amount: members.reduce((sum, order) => sum + Math.round(Number(order.total_amount || 0) * 100), 0) / 100, status: printing === members.length ? 'Printing' : 'Pending', statusLabel: printing && printing !== members.length ? `${members.length - printing} waiting · ${printing} printing` : printing ? 'Printing' : 'Pending' };
  });
}

export async function fetchGroupFiles(files, { getFileUrl, getFileUrls, projectUrl, fetchImpl = fetch, signal, onProgress, concurrency = 4 }) {
  if (!files.length || files.length > 20) throw new Error('Select a group with 1–20 files.');
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 6) throw new Error('Invalid preparation concurrency.');
  const result = new Array(files.length); let total = 0, next = 0, completed = 0;
  const controller = new AbortController(), abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 45000);
  try {
    signal?.throwIfAborted();
    const batch = getFileUrls ? await getFileUrls(files.map(file => ({ orderId: file.orderId, index: file.index })), controller.signal) : null;
    if (getFileUrls && (!Array.isArray(batch) || batch.length !== files.length || batch.some((item, index) => !item || item.orderId !== files[index].orderId || item.index !== files[index].index))) throw new Error('Document access was not authorized.');
    async function worker() {
      while (next < files.length) {
        const index = next++, descriptor = files[index];
        controller.signal.throwIfAborted();
        const signed = new URL(batch ? batch[index].url : await getFileUrl(descriptor.orderId, descriptor.index));
        if (signed.origin !== new URL(projectUrl).origin || !signed.pathname.startsWith('/storage/v1/object/sign/print-jobs/') || !signed.searchParams.has('token')) throw new Error('Document access was not authorized.');
        const response = await fetchImpl(signed.href, { signal: controller.signal, credentials: 'omit', cache: 'no-store' });
        if (!response.ok) throw new Error('An image is unavailable or expired. Refresh the queue and retry.');
        if (Number(response.headers.get('content-length')) > 50 * 1024 * 1024) throw new Error('An image exceeds the 50 MB limit.');
        const blob = await response.blob(); total += blob.size;
        if (!blob.size || blob.size > 50 * 1024 * 1024 || total > 500 * 1024 * 1024) throw new Error('This image group is too large to prepare in the browser.');
        result[index] = { ...descriptor, blob }; completed++;
        onProgress?.(`Prepared ${completed} of ${files.length} images…`);
      }
    }
    let firstError;
    const workers = Array.from({ length: Math.min(concurrency, files.length) }, () => worker().catch(error => { firstError ||= error; controller.abort(); throw error; }));
    // Settle aborted siblings before returning; never return a partial print job.
    const outcomes = await Promise.allSettled(workers), failure = outcomes.find(outcome => outcome.status === 'rejected');
    if (failure) throw firstError;
    controller.signal.throwIfAborted(); return result;
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}
