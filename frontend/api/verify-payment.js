import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL || 'https://lvtmbhxjkuocohcdwclu.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_JGCdrdQJx7x8Dq0LQJcM1Q_lsDTiD_9';
const razorpayKeySecret = (process.env.RAZORPAY_KEY_SECRET || 'HJWKmlaStbKPTl9hAWuCQPyt').trim();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature, 
      pendingRegistration,
      plan,
      shopId: reqShopId
    } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing required Razorpay signature parameters.' });
    }

    // Verify Razorpay HMAC-SHA256 signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto.createHmac('sha256', razorpayKeySecret).update(body).digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ status: 'failure', success: false, error: 'Invalid Razorpay signature.' });
    }

    // Determine plan duration: Yearly = 365 days, Monthly = 30 days
    const isYearly = plan === 'yearly' || pendingRegistration?.plan === 'yearly';
    const durationDays = isYearly ? 365 : 30;
    const expiresAtIso = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    // ===== USER CREATION & SUBSCRIPTION UPDATE AFTER PAYMENT =====
    let shopId = reqShopId || null;

    const adminClient = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : null;
    const clientToUse = adminClient || createClient(supabaseUrl, supabaseAnonKey);

    if (pendingRegistration) {
      const cleanPhone = (pendingRegistration.phone || '').replace(/\D/g, '');
      const email = `${cleanPhone}@gmail.com`;
      const password = pendingRegistration.password || 'DefaultPass123!';
      const name = pendingRegistration.name || 'Print Shop';

      if (adminClient) {
        let userId = null;
        try {
          const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { phone: cleanPhone, name }
          });

          if (createData?.user) {
            userId = createData.user.id;
          } else if (createError) {
            if (createError.message?.includes('already') || createError.message?.includes('registered')) {
              let page = 1;
              let found = false;
              while (!found && page <= 5) {
                const { data: listData } = await adminClient.auth.admin.listUsers({ page, perPage: 50 });
                if (!listData?.users?.length) break;
                const existingUser = listData.users.find(u => u.email === email);
                if (existingUser) {
                  userId = existingUser.id;
                  found = true;
                  await adminClient.auth.admin.updateUserById(userId, { password, email_confirm: true });
                }
                page++;
              }
            }
          }
        } catch (adminErr) {
          console.error('[verify-payment] Admin API error:', adminErr.message);
        }

        if (userId) {
          shopId = userId;
          await adminClient.from('shops').upsert({
            id: userId,
            name,
            phone: cleanPhone,
            address: pendingRegistration.address?.trim() || 'Shop Counter',
            bw_rate: parseFloat(pendingRegistration.bwRate) || 5.0,
            color_rate: parseFloat(pendingRegistration.colorRate) || 10.0,
            color_enabled: 1,
            is_paid: 1,
            subscription_status: 'active',
            razorpay_order_id,
            razorpay_payment_id,
            subscription_expires_at: expiresAtIso
          });
        }
      } else {
        const anonClient = createClient(supabaseUrl, supabaseAnonKey);
        try {
          const { data: signUpData } = await anonClient.auth.signUp({ email, password, options: { data: { phone: cleanPhone, name } } });
          if (signUpData?.user) shopId = signUpData.user.id;
        } catch (e) { console.warn('[verify-payment] anon signUp failed:', e.message); }

        if (shopId) {
          await anonClient.from('shops').upsert({
            id: shopId, name, phone: cleanPhone,
            address: pendingRegistration.address?.trim() || 'Shop Counter',
            bw_rate: parseFloat(pendingRegistration.bwRate) || 5.0,
            color_rate: parseFloat(pendingRegistration.colorRate) || 10.0,
            color_enabled: 1, is_paid: 1, subscription_status: 'active',
            razorpay_order_id, razorpay_payment_id,
            subscription_expires_at: expiresAtIso
          });
        }
      }
    } else if (shopId) {
      // Upgrade or renewal for an existing registered shop
      const { error: updateErr } = await clientToUse.from('shops').update({
        is_paid: 1,
        subscription_status: 'active',
        subscription_expires_at: expiresAtIso,
        razorpay_order_id,
        razorpay_payment_id
      }).eq('id', shopId);

      if (updateErr) {
        console.error('[verify-payment] Existing shop subscription update error:', updateErr.message);
      } else {
        console.log(`[verify-payment] Updated shop ${shopId} subscription. Expiry set to ${expiresAtIso}`);
      }
    }

    return res.status(200).json({
      status: 'success',
      success: true,
      shopId,
      expiresAt: expiresAtIso,
      message: 'Payment verified and subscription activated successfully.'
    });

  } catch (err) {
    console.error('[verify-payment] Error:', err);
    return res.status(500).json({ error: err.message || 'Server error during payment verification.' });
  }
}
