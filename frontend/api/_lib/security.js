import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const BUCKET = 'print-jobs';
export const MAX_BYTES = 50 * 1024 * 1024;
export const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
export const secret = () => crypto.randomBytes(32).toString('base64url');
export const fail = (status, message) => Object.assign(new Error(message), { status });
export const db = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw fail(503, 'Service is temporarily unavailable.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
};
export function headers(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, nosnippet, noimageindex');
  const origin = req.headers.origin;
  const allowed = ['https://printwithqr.in', 'https://www.printwithqr.in', 'https://printwithqr.com', 'https://www.printwithqr.com', process.env.ALLOWED_ORIGIN];
  if (origin && !allowed.includes(origin) && origin !== `https://${process.env.VERCEL_URL}` && !/^http:\/\/localhost:(3000|5173)$/.test(origin)) throw fail(403, 'Origin is not allowed.');
  if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Order-Token, X-Order-Capability, X-Idempotency-Key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}
export function body(req) {
  try { return typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}; }
  catch { throw fail(400, 'Invalid JSON.'); }
}
export async function user(client, req) {
  const bearer = req.headers.authorization;
  if (!bearer?.startsWith('Bearer ')) throw fail(401, 'Sign in to continue.');
  const { data, error } = await client.auth.getUser(bearer.slice(7));
  if (error || !data?.user) throw fail(401, 'Your session has expired. Please sign in.');
  return data.user;
}
export async function isAdmin(client, userId) {
  const { data, error } = await client.from('platform_admins').select('user_id').eq('user_id', userId).maybeSingle();
  if (error) throw fail(503, 'Unable to verify account permissions.');
  return !!data;
}
export async function authorizeShop(client, userId, shopId, ownerOnly = false) {
  if (await isAdmin(client, userId)) return 'admin';
  const { data, error } = await client.from('shop_members').select('role').eq('shop_id', shopId).eq('user_id', userId).eq('active', true).maybeSingle();
  if (error) throw fail(503, 'Unable to verify shop permissions.');
  if (!data || (ownerOnly && data.role !== 'owner')) throw fail(403, 'Access denied for this shop.');
  return data.role;
}
export async function provisionOwner(client, shopId) {
  const { error } = await client.from('shop_members').upsert({ shop_id: shopId, user_id: shopId, role: 'owner', active: true });
  if (error) throw fail(503, 'Unable to provision shop access. Please contact support.');
}
export function objectKey(value, shopId) {
  if (typeof value !== 'string') throw fail(403, 'Invalid document reference.');
  let key = value;
  if (/^https?:/.test(value)) {
    let url;
    try { url = new URL(value); } catch { throw fail(403, 'Invalid document reference.'); }
    const base = new URL(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
    if (url.origin !== base.origin || !/^\/storage\/v1\/object\/(public|sign|authenticated)\/print-jobs\//.test(url.pathname)) throw fail(403, 'Invalid document reference.');
    key = decodeURIComponent(url.pathname.split('/print-jobs/')[1]);
  }
  if (!key.startsWith(`${shopId}/`) || key.split('/').some(part => !part || part === '.' || part === '..') || /[\u0000-\u001f\\?#]/.test(key)) throw fail(403, 'Document is outside the authorized shop.');
  return key;
}
export function fileKeys(order) {
  let values = [order.file_path];
  if (order.file_path?.startsWith('[')) {
    try { values = JSON.parse(order.file_path); } catch { throw fail(403, 'Invalid document reference.'); }
  }
  if (!Array.isArray(values) || values.length < 1 || values.length > 20) throw fail(403, 'Invalid document reference.');
  return values.map(value => objectKey(value, order.shop_id));
}
export function pageSelection(total, type = 'all', custom = '') {
  if (!Number.isInteger(total) || total < 1 || total > 2000) throw fail(400, 'Document must contain 1–2000 pages.');
  if (type === 'all') return total;
  if (type === 'odd') return Math.ceil(total / 2);
  if (type === 'even') return Math.floor(total / 2);
  if (type !== 'custom' || typeof custom !== 'string' || custom.length > 500) throw fail(400, 'Invalid print page range.');
  const pages = new Set();
  for (const part of custom.split(',')) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw fail(400, 'Invalid print page range.');
    const first = Number(match[1]), last = Number(match[2] || match[1]);
    if (first < 1 || last > total || first > last) throw fail(400, 'Print range exceeds document pages.');
    for (let n = first; n <= last; n++) pages.add(n);
  }
  return pages.size;
}
export async function rateLimit(client, req, action, limit) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const signingSecret = process.env.REQUEST_LOG_SECRET || process.env.REGISTRATION_SECRET;
  if (!signingSecret) throw fail(503, 'Service is temporarily unavailable.');
  const key = crypto.createHmac('sha256', signingSecret).update(`${action}:${ip}`).digest('hex');
  const { data, error } = await client.rpc('print_rate_limit', { p_key: key, p_limit: limit });
  if (error) throw fail(503, 'Unable to verify request limits.');
  if (!data) throw fail(429, 'Too many requests. Please wait a few minutes.');
}
