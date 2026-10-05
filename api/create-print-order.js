import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const orderSessionSecret = process.env.ORDER_SESSION_SECRET || process.env.REGISTRATION_SECRET || process.env.REQUEST_LOG_SECRET;

const CAPABILITY_TTL_MS = 15 * 60 * 1000; // 15 minutes
export function signOrderCapability(shopId, secret = orderSessionSecret) {
  if (!secret) {
    throw new Error('Missing server secret for signing order capability.');
  }
  const payload = {
    shopId: String(shopId).trim(),
    action: 'create_print_order',
    iat: Date.now(),
    exp: Date.now() + CAPABILITY_TTL_MS,
    nonce: crypto.randomBytes(12).toString('hex')
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
  return `${payloadStr}.${signature}`;
}

export function verifyOrderCapability(token, expectedShopId, secret = orderSessionSecret) {
  if (!token || typeof token !== 'string') {
    return { valid: false, status: 401, error: 'Unauthorized: Missing order capability token.' };
  }

  if (!secret) {
    return { valid: false, status: 500, error: 'Server security configuration error: Missing order session secret.' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, status: 403, error: 'Forbidden: Malformed order capability token.' };
  }

  const [payloadStr, providedSig] = parts;

  // Constant-time signature verification
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  const providedBuf = Buffer.from(providedSig, 'utf8');

  if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
    return { valid: false, status: 403, error: 'Forbidden: Invalid or tampered order capability token.' };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
  } catch (e) {
    return { valid: false, status: 403, error: 'Forbidden: Invalid order capability payload.' };
  }

  if (!payload || typeof payload !== 'object') {
    return { valid: false, status: 403, error: 'Forbidden: Invalid order capability structure.' };
  }

  if (payload.action !== 'create_print_order') {
    return { valid: false, status: 403, error: 'Forbidden: Capability is not authorized for print order creation.' };
  }

  if (typeof payload.exp !== 'number' || Date.now() > payload.exp) {
    return { valid: false, status: 403, error: 'Forbidden: Order capability token has expired. Please refresh the page.' };
  }

  if (String(payload.shopId).trim() !== String(expectedShopId).trim()) {
    return { valid: false, status: 403, error: 'Forbidden: Order capability is not valid for the specified shop.' };
  }

  return { valid: true, payload };
}

import { createSecureOrders } from './_lib/orders.js';
export default async function handler(req, res) {
  // Legacy capabilities never authorize file paths; reject forged older requests
  // explicitly while every valid submission still requires new upload intents.
  const legacy = req.headers['x-order-capability'];
  if (legacy) {
    const result = verifyOrderCapability(legacy, req.body?.shopId);
    if (!result.valid) return res.status(result.status).json({ error: result.error });
  }
  if (req.method === 'POST' && !req.body?.customerToken) return res.status(401).json({ error: 'Missing order capability: refresh to establish a secure upload session.' });
  return createSecureOrders(req, res);
}
