import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const authKey = serviceRoleKey || anonKey;
const RATE_LIMIT_LOGIN_MAX_PER_IP = parseInt(process.env.RATE_LIMIT_LOGIN_MAX_PER_IP || '10', 10);
const RATE_LIMIT_LOGIN_WINDOW_MINUTES = parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MINUTES || '15', 10);
const REQUEST_LOG_SECRET = process.env.REQUEST_LOG_SECRET;

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

const hashValue = (value) => {
  return crypto.createHmac('sha256', REQUEST_LOG_SECRET).update(String(value || '')).digest('hex');
};

const getClient = () => createClient(supabaseUrl, authKey, { auth: { autoRefreshToken: false, persistSession: false } });

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  if (!REQUEST_LOG_SECRET) {
    console.error('[login] Missing REQUEST_LOG_SECRET environment variable.');
    return res.status(500).json({ error: 'Server security configuration error.' });
  }

  if (!supabaseUrl || !authKey) {
    console.error('[login] Missing Supabase configuration.');
    return res.status(500).json({ error: 'Server database configuration error.' });
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

    const { phone, password, deviceId } = body || {};
    const cleanPhone = String(phone || '').replace(/\D/g, '');

    if (!cleanPhone || cleanPhone.length < 10 || !password) {
      return res.status(400).json({ error: 'Phone number and password are required.' });
    }

    const client = getClient();
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const ipHash = ip ? hashValue(ip) : null;
    const deviceHash = deviceId ? hashValue(deviceId) : null;
    const phoneHash = hashValue(cleanPhone);
    const windowStart = new Date(Date.now() - RATE_LIMIT_LOGIN_WINDOW_MINUTES * 60 * 1000).toISOString();

    const { count: recentAttempts } = await client
      .from('request_logs')
      .select('id', { count: 'exact' })
      .eq('type', 'login')
      .eq('ip_hash', ipHash)
      .gte('created_at', windowStart);

    if (recentAttempts >= RATE_LIMIT_LOGIN_MAX_PER_IP) {
      return res.status(429).json({ error: 'Too many login attempts from this network. Please try again later.' });
    }

    const email = `${cleanPhone}@gmail.com`;
    const { data: authData, error: authError } = await client.auth.signInWithPassword({ email, password });

    const successful = !authError && authData?.user;

    await client.from('request_logs').insert({
      type: 'login',
      phone_hash: phoneHash,
      device_hash: deviceHash,
      ip_hash: ipHash,
      is_success: successful ? true : false,
      details: JSON.stringify({ error: authError ? 'auth-failed' : null }),
      created_at: new Date().toISOString()
    });

    if (authError) {
      return res.status(401).json({ error: authError.message || 'Invalid login credentials.' });
    }

    return res.status(200).json({ success: true, user: authData.user, session: authData.session });
  } catch (err) {
    console.error('[login] Error:', err.message || err);
    return res.status(500).json({ error: 'Server error during login.' });
  }
}
