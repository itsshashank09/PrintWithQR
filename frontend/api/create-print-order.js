import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const getClient = () => createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!serviceRoleKey) return res.status(500).json({ error: 'Server configuration error: missing Supabase service role key.' });

  try {
    const { shopId, orders, paperSize = 'A4', duplex = false } = req.body || {};

    if (!shopId || !Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({ error: 'shopId and at least one order item are required.' });
    }

    const adminClient = getClient();

    const { data: shop, error: shopError } = await adminClient
      .from('shops')
      .select('free_prints_allowed, free_prints_used, subscription_status, is_paid, subscription_expires_at, bw_rate, color_rate')
      .eq('id', shopId)
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
    const sanitizedOrders = orders.map((item) => {
      const pages = Number(item.pages_to_print || 0);
      const printType = item.print_type === 'color' ? 'color' : 'bw';
      totalPagesRequested += pages;
      return {
        file_path: item.file_path,
        file_name: item.file_name,
        pages_to_print: pages,
        print_type: printType,
        paper_size: item.paper_size || paperSize,
        duplex: item.duplex ? 1 : 0,
        total_amount: pages * (printType === 'color' ? Number(shop.color_rate || 10) : Number(shop.bw_rate || 5))
      };
    });

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
        .eq('id', shopId)
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
      shop_id: shopId,
      file_path: item.file_path,
      file_name: item.file_name,
      pages_to_print: item.pages_to_print,
      print_type: item.print_type,
      paper_size: item.paper_size,
      duplex: item.duplex,
      total_amount: item.total_amount,
      status: 'Pending'
    }));

    const { data: insertedOrders, error: insertError } = await adminClient.from('orders').insert(insertPayload).select();
    if (insertError) {
      return res.status(500).json({ error: 'Failed to create print order. Please try again.' });
    }

    if (!insertedOrders || insertedOrders.length === 0) {
      return res.status(500).json({ error: 'Failed to retrieve created print order data. Please try again.' });
    }

    return res.status(200).json({ success: true, orderIds: insertedOrders.map((order) => order.id) });
  } catch (err) {
    console.error('[create-print-order] Error:', err);
    return res.status(500).json({ error: err.message || 'Server error while creating print order.' });
  }
}
