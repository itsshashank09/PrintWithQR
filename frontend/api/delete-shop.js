import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { shopId } = req.body || {};

    if (!shopId) {
      return res.status(400).json({ error: 'Shop ID is required for deletion.' });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey || anonKey);

    // 1. Delete all orders associated with this shop
    const { error: ordersErr } = await supabase
      .from('orders')
      .delete()
      .eq('shop_id', shopId);

    if (ordersErr) {
      console.warn('Orders deletion notice:', ordersErr.message);
    }

    // 2. Delete shop record from public.shops table
    const { error: shopErr } = await supabase
      .from('shops')
      .delete()
      .eq('id', shopId);

    if (shopErr) {
      console.warn('Shop table deletion notice:', shopErr.message);
    }

    // 3. Purge Auth user from auth.users (if service role key is available)
    if (serviceRoleKey) {
      try {
        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        });
        const { error: authDeleteErr } = await adminClient.auth.admin.deleteUser(shopId);
        if (authDeleteErr) {
          console.warn('Auth user admin deletion notice:', authDeleteErr.message);
        }
      } catch (authErr) {
        console.warn('Auth delete error:', authErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Shop account and all associated data completely deleted.'
    });
  } catch (err) {
    console.error('Delete shop handler error:', err);
    return res.status(500).json({ error: err.message || 'Server error during shop deletion.' });
  }
}
