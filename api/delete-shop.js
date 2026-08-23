import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!serviceRoleKey) {
    console.error('[delete-shop] Missing SUPABASE_SERVICE_ROLE_KEY.');
    return res.status(500).json({ error: 'Server configuration error: Service role key is missing.' });
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

    const { shopId } = body || {};

    if (!shopId) {
      return res.status(400).json({ error: 'Shop ID is required for deletion.' });
    }

    // Require and verify Authorization Bearer token to prevent Arbitrary Account Deletion
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Valid authentication token is required.' });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: { user }, error: authUserErr } = await adminClient.auth.getUser(token);
    if (authUserErr || !user) {
      return res.status(401).json({ error: 'Invalid or expired authentication session.' });
    }

    // Check authorization: caller must be the shop owner or a verified administrator
    if (user.id !== shopId) {
      const { data: callerShop } = await adminClient
        .from('shops')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle();

      if (!callerShop?.is_admin) {
        return res.status(403).json({ error: 'Forbidden: You do not have permission to delete this shop account.' });
      }
    }

    // 1. Delete all orders associated with this shop
    const { error: ordersErr } = await adminClient
      .from('orders')
      .delete()
      .eq('shop_id', shopId);

    if (ordersErr) {
      console.warn('[delete-shop] Orders deletion notice:', ordersErr.message);
    }

    // 2. Delete shop record from public.shops table
    const { error: shopErr } = await adminClient
      .from('shops')
      .delete()
      .eq('id', shopId);

    if (shopErr) {
      console.warn('[delete-shop] Shop table deletion notice:', shopErr.message);
    }

    // 3. Purge Auth user from auth.users
    try {
      const { error: authDeleteErr } = await adminClient.auth.admin.deleteUser(shopId);
      if (authDeleteErr) {
        console.warn('[delete-shop] Auth user admin deletion notice:', authDeleteErr.message);
      }
    } catch (authErr) {
      console.warn('[delete-shop] Auth delete error:', authErr.message || authErr);
    }

    return res.status(200).json({
      success: true,
      message: 'Shop account and all associated data completely deleted.'
    });
  } catch (err) {
    console.error('[delete-shop] Handler error:', err.message || err);
    return res.status(500).json({ error: 'Server error during shop deletion.' });
  }
}
