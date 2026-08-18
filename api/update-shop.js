import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    const { shopId, newPassword, shopDetails } = req.body || {};

    if (!shopId) {
      return res.status(400).json({ error: 'Shop ID is required.' });
    }

    if (!serviceRoleKey) {
      return res.status(500).json({ error: 'Server configuration error: Service role key is missing.' });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 1. Update Shop Details (bypasses RLS)
    if (shopDetails) {
      const { error: dbUpdateErr } = await adminClient
        .from('shops')
        .update(shopDetails)
        .eq('id', shopId);
        
      if (dbUpdateErr) {
        console.error('Error updating shop details in DB:', dbUpdateErr.message);
        return res.status(400).json({ error: 'Failed to update shop details: ' + dbUpdateErr.message });
      }
    }

    // 2. Update Password in Auth
    if (newPassword && newPassword.trim().length > 0) {
      const { error: authUpdateErr } = await adminClient.auth.admin.updateUserById(
        shopId,
        { password: newPassword.trim() }
      );

      if (authUpdateErr) {
        console.error('Error updating password:', authUpdateErr.message);
        return res.status(400).json({ error: 'Failed to update password: ' + authUpdateErr.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Shop successfully updated.'
    });
  } catch (err) {
    console.error('Update shop handler error:', err);
    return res.status(500).json({ error: err.message || 'Server error during shop update.' });
  }
}
