import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!razorpayKeySecret) {
    console.error('[verify-payment] Missing RAZORPAY_KEY_SECRET environment variable.');
    return res.status(500).json({ error: 'Payment gateway is not properly configured on server.' });
  }

  try {
    let bodyData = req.body;
    if (typeof bodyData === 'string') {
      try {
        bodyData = JSON.parse(bodyData);
      } catch (e) {
        bodyData = {};
      }
    }
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature, 
      pendingRegistration,
      plan,
      shopId: reqShopId
    } = bodyData || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing required Razorpay payment verification parameters.' });
    }

    // Input sanitization / type checking
    const orderIdStr = String(razorpay_order_id).trim();
    const paymentIdStr = String(razorpay_payment_id).trim();
    const signatureStr = String(razorpay_signature).trim();

    if (!orderIdStr.startsWith('order_') || !paymentIdStr.startsWith('pay_')) {
      return res.status(400).json({ error: 'Malformed Razorpay payment identifiers.' });
    }

    // Verify Razorpay HMAC-SHA256 signature using constant-time comparison to prevent timing attacks
    const signPayload = orderIdStr + '|' + paymentIdStr;
    const expectedSignature = crypto.createHmac('sha256', razorpayKeySecret.trim()).update(signPayload).digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf-8');
    const signatureBuf = Buffer.from(signatureStr, 'utf-8');

    if (expectedBuf.length !== signatureBuf.length || !crypto.timingSafeEqual(expectedBuf, signatureBuf)) {
      console.warn('[verify-payment] Signature mismatch for order:', orderIdStr);
      return res.status(400).json({ status: 'failure', success: false, error: 'Invalid Razorpay payment signature.' });
    }

    // Determine plan duration: Yearly = 365 days, Monthly = 30 days
    const isYearly = plan === 'yearly' || pendingRegistration?.plan === 'yearly';
    const durationDays = isYearly ? 365 : 30;
    const expiresAtIso = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    const adminClient = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : null;

    if (!adminClient) {
      console.error('[verify-payment] Missing Supabase Service Role Key.');
      return res.status(500).json({ error: 'Server database configuration error.' });
    }

    // Replay Attack Prevention: Check if this razorpay_payment_id has already been recorded
    const { data: existingPayment } = await adminClient
      .from('shops')
      .select('id, razorpay_payment_id, subscription_expires_at')
      .eq('razorpay_payment_id', paymentIdStr)
      .maybeSingle();

    if (existingPayment) {
      console.warn('[verify-payment] Replay attempt detected with payment ID:', paymentIdStr);
      return res.status(409).json({
        error: 'This payment has already been processed.',
        shopId: existingPayment.id,
        expiresAt: existingPayment.subscription_expires_at
      });
    }

    // ===== USER CREATION & SUBSCRIPTION UPDATE AFTER PAYMENT =====
    let shopId = reqShopId ? String(reqShopId).trim() : null;

    if (pendingRegistration) {
      const cleanPhone = (pendingRegistration.phone || '').replace(/\D/g, '');
      if (cleanPhone.length < 10 || !pendingRegistration.password || pendingRegistration.password.length < 6) {
        return res.status(400).json({ error: 'Valid phone number (10+ digits) and password (6+ chars) required for registration.' });
      }

      const email = `${cleanPhone}@gmail.com`;
      const password = pendingRegistration.password;
      const name = (pendingRegistration.name || 'Print Shop').trim();

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
        console.error('[verify-payment] Admin API error:', adminErr.message || adminErr);
      }

      if (!userId) {
        return res.status(500).json({ error: 'Could not create or update user account.' });
      }

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
        subscription_plan: isYearly ? 'yearly' : 'monthly',
        razorpay_order_id: orderIdStr,
        razorpay_payment_id: paymentIdStr,
        subscription_started_at: new Date().toISOString(),
        subscription_expires_at: expiresAtIso
      });
    } else if (shopId) {
      // Authorization Check: If auth token is present, verify caller owns shopId or is admin
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '').trim();
        const { data: { user: authUser } } = await adminClient.auth.getUser(token);
        if (authUser && authUser.id !== shopId) {
          const { data: shopOwner } = await adminClient.from('shops').select('is_admin').eq('id', authUser.id).single();
          if (!shopOwner?.is_admin) {
            return res.status(403).json({ error: 'Forbidden: You cannot apply payment to another shop account.' });
          }
        }
      }

      // Upgrade or renewal for an existing registered shop
      const { error: updateErr } = await adminClient.from('shops').update({
        is_paid: 1,
        subscription_status: 'active',
        subscription_plan: isYearly ? 'yearly' : 'monthly',
        subscription_expires_at: expiresAtIso,
        razorpay_order_id: orderIdStr,
        razorpay_payment_id: paymentIdStr
      }).eq('id', shopId);

      if (updateErr) {
        console.error('[verify-payment] Shop subscription update error:', updateErr.message);
        return res.status(500).json({ error: 'Failed to update shop subscription record.' });
      }
    } else {
      return res.status(400).json({ error: 'Missing shop identification for payment activation.' });
    }

    return res.status(200).json({
      status: 'success',
      success: true,
      shopId,
      expiresAt: expiresAtIso,
      message: 'Payment verified and subscription activated successfully.'
    });

  } catch (err) {
    console.error('[verify-payment] Error:', err.message || err);
    return res.status(500).json({ error: 'Server error during payment verification.' });
  }
}
