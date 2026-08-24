import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const orderSessionSecret = process.env.ORDER_SESSION_SECRET || process.env.REGISTRATION_SECRET || process.env.REQUEST_LOG_SECRET;

const CAPABILITY_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ORDERS_PER_IP = 25;
const ORDER_RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_SESSIONS_PER_IP = 60;
const SESSION_RATE_WINDOW_MS = 5 * 60 * 1000;

// In-memory rate limiting and idempotency stores with auto-pruning
const rateLimitStore = new Map();
const idempotencyStore = new Map();

function pruneStores() {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now - record.startTime > ORDER_RATE_WINDOW_MS && now - record.startTime > SESSION_RATE_WINDOW_MS) {
      rateLimitStore.delete(key);
    }
  }
  for (const [key, record] of idempotencyStore.entries()) {
    if (now - record.timestamp > 15 * 60 * 1000) {
      idempotencyStore.delete(key);
    }
  }
}

function checkRateLimit(key, maxLimit, windowMs) {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  if (!record || (now - record.startTime) > windowMs) {
    rateLimitStore.set(key, { count: 1, startTime: now });
    return true;
  }
  if (record.count >= maxLimit) {
    return false;
  }
  record.count += 1;
  return true;
}

function setCors(req, res) {
  const origin = req.headers.origin;
  const allowedOrigins = [
    process.env.ALLOWED_ORIGIN,
    'https://www.printwithqr.in',
    'https://printwithqr.in',
    'http://localhost:5173',
    'http://localhost:3000'
  ].filter(Boolean);

  if (origin && (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://www.printwithqr.in');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Order-Capability, X-Idempotency-Key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

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

const getClient = () => createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!orderSessionSecret) {
    return res.status(500).json({ error: 'Server security configuration error: missing session secret.' });
  }

  const clientIp = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim() || 'unknown-ip';

  // Periodic pruning of in-memory stores
  if (Math.random() < 0.1) pruneStores();

  // --------------------------------------------------------------------------
  // GET: Issue short-lived, shop-bound order capability to legitimate clients
  // --------------------------------------------------------------------------
  if (req.method === 'GET') {
    const { shopId } = req.query || {};

    if (!shopId || typeof shopId !== 'string' || shopId.trim().length === 0) {
      return res.status(400).json({ error: 'Shop ID is required to obtain an order capability.' });
    }

    const cleanShopId = shopId.trim();

    if (!checkRateLimit(`session_ip_${clientIp}`, MAX_SESSIONS_PER_IP, SESSION_RATE_WINDOW_MS)) {
      return res.status(429).json({ error: 'Too many session requests. Please wait and try again later.' });
    }

    try {
      if (!serviceRoleKey || !supabaseUrl) {
        return res.status(500).json({ error: 'Server configuration error: missing database credentials.' });
      }

      const adminClient = getClient();
      const { data: shop, error: shopError } = await adminClient
        .from('shops')
        .select('id, subscription_status, is_paid, subscription_expires_at, free_prints_allowed, free_prints_used')
        .eq('id', cleanShopId)
        .maybeSingle();

      if (shopError || !shop) {
        return res.status(404).json({ error: 'Shop not found or inactive.' });
      }

      const expiryDate = shop.subscription_expires_at ? new Date(shop.subscription_expires_at) : null;
      const isExpired = expiryDate && expiryDate < new Date();
      const hasActiveSubscription = shop.is_paid === 1 && shop.subscription_status === 'active' && !isExpired;
      const freeRemaining = Math.max(0, Number(shop.free_prints_allowed || 10) - Number(shop.free_prints_used || 0));

      if (!hasActiveSubscription && !(shop.subscription_status === 'free' && freeRemaining > 0)) {
        return res.status(403).json({ error: 'Shop subscription is expired or inactive.' });
      }

      const capabilityToken = signOrderCapability(cleanShopId);
      return res.status(200).json({
        success: true,
        capabilityToken,
        expiresIn: Math.floor(CAPABILITY_TTL_MS / 1000)
      });
    } catch (err) {
      console.error('[create-print-order:session] Error:', err.message || err);
      return res.status(500).json({ error: 'Failed to generate order session capability.' });
    }
  }

  // --------------------------------------------------------------------------
  // POST: Create print order with verified capability token
  // --------------------------------------------------------------------------
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!serviceRoleKey) {
    return res.status(500).json({ error: 'Server configuration error: missing Supabase service role key.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }

    const {
      shopId,
      orders,
      paperSize = 'A4',
      duplex = false,
      orderCapability,
      order_capability,
      idempotencyKey: bodyIdempotencyKey
    } = body || {};

    const cleanShopId = String(shopId || '').trim();
    if (!cleanShopId || !Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({ error: 'Valid shopId and at least one order item are required.' });
    }

    // 1. Capability Verification: Reject missing, expired, tampered, or cross-shop tokens
    const rawCapability = req.headers['x-order-capability'] || orderCapability || order_capability;
    const capabilityResult = verifyOrderCapability(rawCapability, cleanShopId);

    if (!capabilityResult.valid) {
      return res.status(capabilityResult.status).json({ error: capabilityResult.error });
    }

    // 2. Idempotency Check: Return previously processed result for identical retry
    const idempotencyKey = String(req.headers['x-idempotency-key'] || bodyIdempotencyKey || '').trim();
    if (idempotencyKey) {
      const cached = idempotencyStore.get(`idemp_${cleanShopId}_${idempotencyKey}`);
      if (cached && (Date.now() - cached.timestamp < 10 * 60 * 1000)) {
        return res.status(200).json(cached.response);
      }
    }

    // 3. Rate Limiting Check on Order Creation
    if (!checkRateLimit(`order_ip_${clientIp}`, MAX_ORDERS_PER_IP, ORDER_RATE_WINDOW_MS)) {
      return res.status(429).json({ error: 'Too many print orders submitted from this network. Please wait a moment.' });
    }

    const adminClient = getClient();

    const { data: shop, error: shopError } = await adminClient
      .from('shops')
      .select('free_prints_allowed, free_prints_used, subscription_status, is_paid, subscription_expires_at, bw_rate, color_rate')
      .eq('id', cleanShopId)
      .single();

    if (shopError || !shop) {
      return res.status(404).json({ error: 'Shop not found or inactive. Please contact support.' });
    }

    const expiryDate = shop.subscription_expires_at ? new Date(shop.subscription_expires_at) : null;
    const isExpired = expiryDate && expiryDate < new Date();
    const hasActiveSubscription = shop.is_paid === 1 && shop.subscription_status === 'active' && !isExpired;
    const freeAllowed = Number(shop.free_prints_allowed || 10);
    const freeUsed = Number(shop.free_prints_used || 0);
    const freeRemaining = Math.max(0, freeAllowed - freeUsed);

    let totalPagesRequested = 0;
    const sanitizedOrders = [];

    for (const item of orders) {
      if (!item || typeof item !== 'object') continue;
      const rawPages = Math.floor(Number(item.pages_to_print || 0));
      if (rawPages <= 0 || rawPages > 2000) {
        return res.status(400).json({ error: 'Invalid page count requested for print order.' });
      }

      const printType = item.print_type === 'color' ? 'color' : 'bw';
      totalPagesRequested += rawPages;

      sanitizedOrders.push({
        file_path: String(item.file_path || '').trim(),
        file_name: String(item.file_name || 'Document').slice(0, 150),
        pages_to_print: rawPages,
        print_type: printType,
        paper_size: ['A4', 'Letter', '16:9'].includes(item.paper_size) ? item.paper_size : paperSize,
        duplex: item.duplex ? 1 : 0,
        total_amount: rawPages * (printType === 'color' ? Number(shop.color_rate || 10) : Number(shop.bw_rate || 5))
      });
    }

    if (sanitizedOrders.length === 0) {
      return res.status(400).json({ error: 'No valid order items provided.' });
    }

    if (!hasActiveSubscription && shop.subscription_status !== 'free') {
      return res.status(403).json({ error: 'Your shop subscription has expired or is inactive. Please subscribe to continue printing.' });
    }

    if (!hasActiveSubscription && shop.subscription_status === 'free') {
      if (totalPagesRequested > freeRemaining) {
        return res.status(403).json({ error: `Only ${freeRemaining} free print${freeRemaining === 1 ? '' : 's'} are available. Please subscribe for unlimited printing.` });
      }

      const { data: updatedShop, error: updateError } = await adminClient
        .from('shops')
        .update({ free_prints_used: freeUsed + totalPagesRequested })
        .eq('id', cleanShopId)
        .lte('free_prints_used', freeAllowed - totalPagesRequested)
        .eq('subscription_status', 'free')
        .select('free_prints_used')
        .single();

      if (updateError || !updatedShop) {
        return res.status(409).json({ error: 'Unable to reserve free prints. Please refresh and try again.' });
      }
    }

    const insertPayload = sanitizedOrders.map((item) => ({
      id: `order_${Math.random().toString(36).slice(2, 11)}`,
      shop_id: cleanShopId,
      file_path: item.file_path,
      file_name: item.file_name,
      pages_to_print: item.pages_to_print,
      print_type: item.print_type,
      paper_size: item.paper_size,
      duplex: item.duplex,
      total_amount: item.total_amount,
      status: 'Pending'
    }));

    const { data: insertedOrders, error: insertError } = await adminClient
      .from('orders')
      .insert(insertPayload)
      .select();

    if (insertError) {
      console.error('[create-print-order] Insert error:', insertError.message || insertError);
      return res.status(500).json({ error: 'Failed to create print order. Please try again.' });
    }

    if (!insertedOrders || insertedOrders.length === 0) {
      return res.status(500).json({ error: 'Failed to retrieve created print order data. Please try again.' });
    }

    const responsePayload = {
      success: true,
      orderIds: insertedOrders.map((order) => order.id)
    };

    if (idempotencyKey) {
      idempotencyStore.set(`idemp_${cleanShopId}_${idempotencyKey}`, {
        timestamp: Date.now(),
        response: responsePayload
      });
    }

    return res.status(200).json(responsePayload);
  } catch (err) {
    console.error('[create-print-order] Error:', err.message || err);
    return res.status(500).json({ error: 'Server error while creating print order.' });
  }
}

