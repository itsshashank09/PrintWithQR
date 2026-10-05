// Status capabilities only. Never persist documents, filenames or Storage URLs.
export const RECEIPT_KEY = 'pwqr.customer.receipts.v1';
export const RECEIPT_TTL = 7 * 24 * 60 * 60 * 1000;
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
export const validOrderToken = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
function storage(name) { try { return globalThis[name]; } catch { return null; } }
function get(store, key) { try { return store?.getItem(key); } catch { return null; } }
function put(store, key, value) { try { store?.setItem(key, value); return Boolean(store); } catch { return false; } }
export function readReceipts(store = storage('localStorage'), now = Date.now()) {
  try {
    const rows = JSON.parse(get(store, RECEIPT_KEY) || '[]');
    if (!Array.isArray(rows)) { put(store, RECEIPT_KEY, '[]'); return []; }
    const kept = rows.filter(row => validOrderToken(row?.token) && validId(row.shopId) && Array.isArray(row.orderIds) && row.orderIds.length > 0 && row.orderIds.length <= 10 && row.orderIds.every(validId) && Number.isFinite(row.createdAt) && row.createdAt <= now && row.createdAt + RECEIPT_TTL > now).slice(0, 20)
      .map(({ shopId, orderIds, token, createdAt }) => ({ shopId, orderIds, token, createdAt }));
    if (JSON.stringify(kept) !== JSON.stringify(rows)) put(store, RECEIPT_KEY, JSON.stringify(kept));
    return kept;
  } catch { put(store, RECEIPT_KEY, '[]'); return []; }
}
export function saveReceipt({ shopId, orderIds, token }, store = storage('localStorage'), now = Date.now()) {
  if (!validId(shopId) || !validOrderToken(token) || !Array.isArray(orderIds) || !orderIds.length || orderIds.length > 10 || !orderIds.every(validId)) return false;
  const existing = readReceipts(store, now);
  const receipt = { shopId, orderIds: [...new Set(orderIds)], token, createdAt: existing.find(row => row.token === token)?.createdAt ?? now };
  return put(store, RECEIPT_KEY, JSON.stringify([receipt, ...existing.filter(row => row.token !== token)].slice(0, 20)));
}
export function findReceipt(orderId) { return readReceipts().find(row => row.orderIds.includes(orderId)); }
export function forgetReceipt(orderId) {
  put(storage('localStorage'), RECEIPT_KEY, JSON.stringify(readReceipts().filter(row => !row.orderIds.includes(orderId))));
  try { storage('sessionStorage')?.removeItem('order_token_' + orderId); } catch { /* blocked storage */ }
}
export function receiptLink(origin, orderId, token) {
  if (!validId(orderId) || !validOrderToken(token)) throw new Error('Invalid tracking access.');
  const base = new URL(origin);
  if (!['https:', 'http:'].includes(base.protocol)) throw new Error('Invalid tracking address.');
  // Fragments are never sent to servers or in HTTP referrers.
  return `${base.origin}/order/${encodeURIComponent(orderId)}#track=${token}`;
}
export function readTrackingToken(orderId, fragment = '') {
  if (!validId(orderId)) return null;
  const supplied = new URLSearchParams(fragment.replace(/^#/, '')).get('track');
  if (validOrderToken(supplied)) return supplied;
  const cached = findReceipt(orderId)?.token;
  if (cached) return cached;
  const legacy = get(storage('sessionStorage'), 'order_token_' + orderId);
  return validOrderToken(legacy) ? legacy : null;
}
export function newOrderToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
