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
    console.error('[update-shop] Missing SUPABASE_SERVICE_ROLE_KEY.');
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

    const { shopId, newPassword, shopDetails } = body || {};

    if (!shopId) {
      return res.status(400).json({ error: 'Shop ID is required.' });
    }

    // Require and verify Authorization Bearer token to prevent IDOR / Account Takeover
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
        return res.status(403).json({ error: 'Forbidden: You do not have permission to modify this shop account.' });
      }
    }

    // 1. Update Safe Shop Details (prevent mass assignment of is_admin, is_paid, etc.)
    if (shopDetails && typeof shopDetails === 'object') {
      const allowedFields = ['name', 'phone', 'address', 'printer_model', 'bw_rate', 'color_rate', 'color_enabled'];
      const sanitizedUpdate = {};

      for (const field of allowedFields) {
        if (shopDetails[field] !== undefined) {
          sanitizedUpdate[field] = shopDetails[field];
        }
      }

      if (Object.keys(sanitizedUpdate).length > 0) {
        const { error: dbUpdateErr } = await adminClient
          .from('shops')
          .update(sanitizedUpdate)
          .eq('id', shopId);
          
        if (dbUpdateErr) {
          console.error('[update-shop] DB update error:', dbUpdateErr.message);
          return res.status(500).json({ error: 'Failed to update shop details.' });
        }
      }
    }

    // 2. Update Password in Auth if requested
    if (newPassword && typeof newPassword === 'string') {
      const trimmedPass = newPassword.trim();
      if (trimmedPass.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      }

      const { error: authUpdateErr } = await adminClient.auth.admin.updateUserById(
        shopId,
        { password: trimmedPass }
      );

      if (authUpdateErr) {
        console.error('[update-shop] Password update error:', authUpdateErr.message);
        return res.status(500).json({ error: 'Failed to update user password.' });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Shop successfully updated.'
    });
  } catch (err) {
    console.error('[update-shop] Handler error:', err.message || err);
    return res.status(500).json({ error: 'Server error during shop update.' });
  }
}
