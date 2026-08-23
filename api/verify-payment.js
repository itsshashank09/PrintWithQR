import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!razorpayKeyId || !razorpayKeySecret) {
    console.error('[verify-payment] Missing Razorpay gateway environment variables.');
    return res.status(500).json({ error: 'Payment gateway is not properly configured on server.' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[verify-payment] Missing Supabase Service Role Key or URL.');
    return res.status(500).json({ error: 'Server database configuration error.' });
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
      shopId: reqShopId
    } = bodyData || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing required Razorpay payment verification parameters.' });
    }

    // Input format validation
    const orderIdStr = String(razorpay_order_id).trim();
    const paymentIdStr = String(razorpay_payment_id).trim();
    const signatureStr = String(razorpay_signature).trim();

    if (!orderIdStr.startsWith('order_') || !paymentIdStr.startsWith('pay_')) {
      return res.status(400).json({ error: 'Malformed Razorpay payment identifiers.' });
    }

    // 1. Verify Razorpay HMAC-SHA256 signature with constant-time comparison
    const signPayload = orderIdStr + '|' + paymentIdStr;
    const expectedSignature = crypto.createHmac('sha256', razorpayKeySecret.trim()).update(signPayload).digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf-8');
    const signatureBuf = Buffer.from(signatureStr, 'utf-8');

    if (expectedBuf.length !== signatureBuf.length || !crypto.timingSafeEqual(expectedBuf, signatureBuf)) {
      console.warn('[verify-payment] Signature mismatch for order:', orderIdStr);
      return res.status(400).json({ status: 'failure', success: false, error: 'Invalid Razorpay payment signature.' });
    }

    // 2. Fetch authoritative order details directly from Razorpay REST API
    const basicAuthToken = Buffer.from(`${razorpayKeyId.trim()}:${razorpayKeySecret.trim()}`).toString('base64');
    const rzpOrderRes = await fetch(`https://api.razorpay.com/v1/orders/${orderIdStr}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuthToken}`
      }
    });

    if (!rzpOrderRes.ok) {
      console.error('[verify-payment] Failed to fetch order from Razorpay API:', rzpOrderRes.status);
      return res.status(502).json({ error: 'Could not verify order details with payment gateway.' });
    }

    const rzpOrder = await rzpOrderRes.json();
    if (!rzpOrder || rzpOrder.id !== orderIdStr) {
      return res.status(400).json({ error: 'Order validation failed with payment gateway.' });
    }

    // 3. Determine verified plan and duration strictly from the verified Razorpay order amount
    // Monthly: 9900 paise (₹99) -> 30 days
    // Yearly: 59900 paise (₹599) -> 365 days
    let verifiedPlan = null;
    let durationDays = 0;

    const orderAmount = Number(rzpOrder.amount);
    if (orderAmount === 59900) {
      verifiedPlan = 'yearly';
      durationDays = 365;
    } else if (orderAmount === 9900) {
      verifiedPlan = 'monthly';
      durationDays = 30;
    } else {
      console.warn('[verify-payment] Order amount does not match known plans:', orderAmount);
      return res.status(400).json({ error: 'Order amount does not correspond to any valid subscription plan.' });
    }

    const expiresAtIso = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 4. Replay Attack Prevention: Verify this razorpay_payment_id has never been used before
    const { data: existingPayment } = await adminClient
      .from('shops')
      .select('id, razorpay_payment_id, subscription_expires_at')
      .eq('razorpay_payment_id', paymentIdStr)
      .maybeSingle();

    if (existingPayment) {
      console.warn('[verify-payment] Replay attempt detected with payment ID:', paymentIdStr);
      return res.status(409).json({
        error: 'This payment has already been processed and activated.',
        shopId: existingPayment.id,
        expiresAt: existingPayment.subscription_expires_at
      });
    }

    // 5. Account Resolution & Strict Authorization Check
    let targetShopId = null;

    if (pendingRegistration) {
      // Flow A: New Registration
      const cleanPhone = String(pendingRegistration.phone || '').replace(/\D/g, '');
      const rawPassword = String(pendingRegistration.password || '');
      const rawName = String(pendingRegistration.name || 'Print Shop').trim();

      if (cleanPhone.length < 10 || rawPassword.length < 6) {
        return res.status(400).json({ error: 'Valid phone number (10+ digits) and password (6+ chars) required for registration.' });
      }

      // Check if phone number is already registered to prevent account hijacking
      const { data: existingShop } = await adminClient
        .from('shops')
        .select('id')
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (existingShop) {
        return res.status(400).json({ error: 'This phone number is already registered. Please sign in to your existing account to upgrade your subscription.' });
      }

      const email = `${cleanPhone}@gmail.com`;
      let userId = null;

      try {
        const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
          email,
          password: rawPassword,
          email_confirm: true,
          user_metadata: { phone: cleanPhone, name: rawName }
        });

        if (createData?.user) {
          userId = createData.user.id;
        } else if (createError) {
          console.warn('[verify-payment] User creation notice in auth:', createError.message);
          return res.status(400).json({ error: 'An account with this phone already exists in auth. Please sign in with your existing account.' });
        }
      } catch (authErr) {
        console.error('[verify-payment] Admin Auth createUser error:', authErr.message || authErr);
        return res.status(500).json({ error: 'Failed to initialize user account.' });
      }

      if (!userId) {
        return res.status(500).json({ error: 'Could not create user account for registration.' });
      }

      targetShopId = userId;

      const { error: insertShopErr } = await adminClient.from('shops').upsert({
        id: userId,
        name: rawName,
        phone: cleanPhone,
        address: String(pendingRegistration.address || '').trim() || 'Shop Counter',
        bw_rate: parseFloat(pendingRegistration.bwRate) || 5.0,
        color_rate: parseFloat(pendingRegistration.colorRate) || 10.0,
        color_enabled: 1,
        is_paid: 1,
        subscription_status: 'active',
        subscription_plan: verifiedPlan,
        razorpay_order_id: orderIdStr,
        razorpay_payment_id: paymentIdStr,
        subscription_started_at: new Date().toISOString(),
        subscription_expires_at: expiresAtIso
      });

      if (insertShopErr) {
        console.error('[verify-payment] Error creating shop record:', insertShopErr.message);
        return res.status(500).json({ error: 'Failed to initialize shop record in database.' });
      }

    } else {
      // Flow B: Existing Shop Payment / Renewal / Upgrade
      // MANDATORY Bearer Token Authentication
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Valid authentication token is required to upgrade or renew a subscription.' });
      }

      const token = authHeader.replace('Bearer ', '').trim();
      const { data: { user: authUser }, error: authErr } = await adminClient.auth.getUser(token);

      if (authErr || !authUser) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired authentication session.' });
      }

      // If reqShopId is specified and differs from authenticated user, verify caller is an authorized admin
      if (reqShopId && String(reqShopId).trim() !== authUser.id) {
        const { data: adminShop } = await adminClient
          .from('shops')
          .select('is_admin')
          .eq('id', authUser.id)
          .maybeSingle();

        if (!adminShop?.is_admin) {
          return res.status(403).json({ error: 'Forbidden: You do not have permission to apply payments or modify subscriptions for another shop.' });
        }
        targetShopId = String(reqShopId).trim();
      } else {
        // Target shop is strictly determined by the authenticated user's ID
        targetShopId = authUser.id;
      }

      // Verify target shop exists
      const { data: targetShop, error: fetchShopErr } = await adminClient
        .from('shops')
        .select('id, name')
        .eq('id', targetShopId)
        .maybeSingle();

      if (fetchShopErr || !targetShop) {
        return res.status(404).json({ error: 'Target shop account not found.' });
      }

      // Update shop subscription record
      const { error: updateErr } = await adminClient.from('shops').update({
        is_paid: 1,
        subscription_status: 'active',
        subscription_plan: verifiedPlan,
        subscription_expires_at: expiresAtIso,
        razorpay_order_id: orderIdStr,
        razorpay_payment_id: paymentIdStr
      }).eq('id', targetShopId);

      if (updateErr) {
        console.error('[verify-payment] Shop subscription update error:', updateErr.message);
        return res.status(500).json({ error: 'Failed to update shop subscription record.' });
      }
    }

    return res.status(200).json({
      status: 'success',
      success: true,
      shopId: targetShopId,
      plan: verifiedPlan,
      expiresAt: expiresAtIso,
      message: `Payment verified and ${verifiedPlan === 'yearly' ? 'Annual' : 'Monthly'} subscription activated successfully.`
    });

  } catch (err) {
    console.error('[verify-payment] Error:', err.message || err);
    return res.status(500).json({ error: 'Server error during payment verification.' });
  }
}
