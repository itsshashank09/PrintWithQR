// Pure clock shared with the dashboard; the server enforces every deadline.
export const QUEUE_WAIT_MS = 10 * 60 * 1000;
export function waitingDeadline(order) {
  if (order.status !== 'Pending') return null;
  const created = Date.parse(order.created_at);
  return Number.isFinite(created) ? created + QUEUE_WAIT_MS : 0;
}
export function waitingExpired(order, now = Date.now()) {
  const deadline = waitingDeadline(order);
  return deadline !== null && now >= deadline;
}
export function documentSeconds(order, now = Date.now()) {
  if (order.file_deleted_at || waitingExpired(order, now) || (order.status === 'Cancelled' && order.print_options?.queueExpiredAt)) return 0;
  let deadline = waitingDeadline(order);
  if (['Completed', 'Cancelled'].includes(order.status)) {
    const completed = Date.parse(order.completed_at);
    if (!Number.isFinite(completed)) return 0;
    deadline = completed + QUEUE_WAIT_MS;
  }
  return deadline === null ? 120 : Math.max(0, Math.min(120, Math.floor((deadline - now) / 1000)));
}
export function customerQueueStatus(order, now = Date.now()) {
  return waitingExpired(order, now) ? { ...order, status: 'Cancelled', print_options: { ...order.print_options, queueExpiredAt: new Date(waitingDeadline(order)).toISOString() } } : order;
}
