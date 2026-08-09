import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const registrationSecret = process.env.REGISTRATION_SECRET || 'please_change_this_secret';

const MAX_REGISTRATION_PER_IP = parseInt(process.env.RATE_LIMIT_REGISTRATION_MAX_PER_IP || '8', 10);
const REGISTRATION_WINDOW_MINUTES = parseInt(process.env.RATE_LIMIT_REGISTRATION_WINDOW_MINUTES || '60', 10);
const MAX_SUSPICIOUS_IP_REGISTRATIONS = parseInt(process.env.RATE_LIMIT_SUSPICIOUS_IP_MAX || '4', 10);

const hashValue = (value) => {
  return crypto.createHmac('sha256', registrationSecret).update(String(value || '')).digest('hex');
};

const getClient = () => createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!serviceRoleKey) return res.status(500).json({ error: 'Server configuration error: missing Supabase service role key.' });

  try {
    const {
      name,
      phone,
      password,
      address,
      printerModel,
      bwRate,
      colorRate,
      deviceId,
      botScore,
      botFlags
    } = req.body || {};

    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (!name || !cleanPhone || cleanPhone.length < 10 || !password || password.length < 6) {
      return res.status(400).json({ error: 'Name, valid 10-digit phone number, and password are required.' });
    }

    const adminClient = getClient();
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const ipHash = ip ? hashValue(ip) : null;
    const deviceHash = deviceId ? hashValue(deviceId) : null;
    const phoneHash = hashValue(cleanPhone);
    const now = new Date().toISOString();

    const windowStart = new Date(Date.now() - REGISTRATION_WINDOW_MINUTES * 60 * 1000).toISOString();

    const { data: ipAttemptsData, count: ipAttemptCount } = await adminClient
      .from('registration_attempts')
      .select('id', { count: 'exact' })
      .eq('type', 'registration')
      .eq('ip_hash', ipHash)
      .gte('created_at', windowStart);

    if (ipAttemptCount >= MAX_REGISTRATION_PER_IP) {
      return res.status(429).json({ error: 'Too many registration attempts from this network. Please wait and try again later.' });
    }

    if (botScore >= 0.75 || (Array.isArray(botFlags) && botFlags.length > 0)) {
      await adminClient.from('registration_attempts').insert({
        type: 'registration',
        phone_hash: phoneHash,
        device_hash: deviceHash,
        ip_hash: ipHash,
        is_success: false,
        details: JSON.stringify({ reason: 'bot-detected', botScore, botFlags }),
        created_at: now
      });

      return res.status(403).json({ error: 'Suspicious automated registration detected. Please try again from a regular browser.' });
    }

    const { data: existingShopByPhone } = await adminClient
      .from('shops')
      .select('id')
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (existingShopByPhone) {
      await adminClient.from('registration_attempts').insert({
        type: 'registration',
        phone_hash: phoneHash,
        device_hash: deviceHash,
        ip_hash: ipHash,
        is_success: false,
        details: JSON.stringify({ reason: 'phone-exists' }),
        created_at: now
      });

      return res.status(400).json({ error: 'This phone number is already registered. Please sign in to your existing account.' });
    }

    if (deviceHash) {
      const { data: existingDeviceShop } = await adminClient
        .from('shops')
        .select('id, free_prints_used, free_prints_allowed, subscription_status')
        .eq('device_hash', deviceHash)
        .limit(1)
        .maybeSingle();

      const { data: pastSuccessfulReg } = await adminClient
        .from('registration_attempts')
        .select('id')
        .eq('type', 'registration')
        .eq('is_success', true)
        .eq('device_hash', deviceHash)
        .limit(1)
        .maybeSingle();

      if (existingDeviceShop || pastSuccessfulReg) {
        await adminClient.from('registration_attempts').insert({
          type: 'registration',
          phone_hash: phoneHash,
          device_hash: deviceHash,
          ip_hash: ipHash,
          is_success: false,
          details: JSON.stringify({ reason: 'device-already-used', shop_id: existingDeviceShop?.id || 'deleted-shop' }),
          created_at: now
        });

        return res.status(403).json({ error: 'This device has already used its free print allowance. Please sign in to your existing account or subscribe to continue.' });
      }
    }

    if (ipHash) {
      const { data: suspiciousIps, count: suspiciousIpCount } = await adminClient
        .from('registration_attempts')
        .select('id', { count: 'exact' })
        .eq('type', 'registration')
        .eq('ip_hash', ipHash)
        .gte('created_at', windowStart);

      if (suspiciousIpCount >= MAX_SUSPICIOUS_IP_REGISTRATIONS) {
        return res.status(429).json({ error: 'There are too many recent registrations from this network. Please use an existing account or contact support.' });
      }
    }

    const email = `${cleanPhone}@gmail.com`;
    let userId = null;
    let createError = null;

    try {
      const { data: createData, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { phone: cleanPhone, name }
      });
      createError = error;
      if (createData?.user) {
        userId = createData.user.id;
      }
    } catch (err) {
      createError = err;
    }

    if (!userId) {
      const userAlready = String(createError?.message || '').toLowerCase().includes('already');
      if (userAlready) {
        return res.status(400).json({ error: 'This phone number is already registered. Please sign in to your existing account.' });
      }
      return res.status(500).json({ error: 'Could not create user account. Please try again later.' });
    }

    const shopRecord = {
      id: userId,
      name: name.trim(),
      phone: cleanPhone,
      address: (address || '').trim() || 'Not provided',
      printer_model: (printerModel || '').trim(),
      bw_rate: parseFloat(bwRate) || 5.0,
      color_rate: parseFloat(colorRate) || 10.0,
      color_enabled: 1,
      is_paid: 0,
      subscription_status: 'free',
      subscription_plan: 'free',
      free_prints_allowed: 10,
      free_prints_used: 0,
      trial_completed: false,
      device_hash: deviceHash,
      ip_hash: ipHash,
      registration_device_risk: `botScore:${Number(botScore || 0).toFixed(2)}`,
      registration_ip_risk: ipHash ? 'recorded' : 'unknown',
      subscription_started_at: now,
      subscription_expires_at: null,
      created_at: now
    };

    const { error: shopError } = await adminClient.from('shops').upsert(shopRecord);
    if (shopError) {
      console.error('[register-shop] Supabase upsert error:', shopError);
      return res.status(500).json({ error: 'Failed to save shop data. Please try again later.', details: shopError });
    }

    await adminClient.from('registration_attempts').insert({
      type: 'registration',
      phone_hash: phoneHash,
      device_hash: deviceHash,
      ip_hash: ipHash,
      is_success: true,
      details: JSON.stringify({ shop_id: userId }),
      created_at: now
    });

    return res.status(200).json({ success: true, shopId: userId, message: 'Shop registered successfully. You have received 10 free prints.' });
  } catch (err) {
    console.error('[register-shop] Error:', err);
    return res.status(500).json({ error: err.message || 'Server error while registering shop.' });
  }
}
