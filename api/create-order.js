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

  // Load server-side credentials strictly from environment variables without hardcoded fallbacks
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!razorpayKeyId || !razorpayKeySecret) {
    console.error('[create-order] Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET environment variables.');
    return res.status(500).json({ error: 'Payment gateway is not properly configured on server.' });
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
    const { plan } = body || {};

    // Price is strictly derived server-side. Never trust client-supplied amounts.
    const PLAN_PRICES = {
      monthly: 9900,  // ₹99 in paise
      yearly: 59900   // ₹599 in paise
    };

    const selectedPlan = plan === 'yearly' ? 'yearly' : 'monthly';
    const amountInPaise = PLAN_PRICES[selectedPlan];

    // Receipt length MUST be <= 40 characters for Razorpay API validation
    const shortReceipt = `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // Call Razorpay REST API directly using Basic Auth
    const basicAuthToken = Buffer.from(`${razorpayKeyId.trim()}:${razorpayKeySecret.trim()}`).toString('base64');
    
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicAuthToken}`
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt: shortReceipt,
        notes: {
          plan: selectedPlan
        }
      })
    });

    if (!rzpRes.ok) {
      const errText = await rzpRes.text();
      console.error('[create-order] Razorpay order creation failed:', rzpRes.status, errText);
      return res.status(502).json({ error: 'Failed to create payment order with gateway. Please try again.' });
    }

    const rzpOrder = await rzpRes.json();

    if (!rzpOrder || !rzpOrder.id) {
      return res.status(502).json({ error: 'Invalid response received from payment gateway.' });
    }

    return res.status(200).json({
      id: rzpOrder.id,
      order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      key: razorpayKeyId.trim(),
      isRealOrder: true
    });
  } catch (err) {
    console.error('[create-order] Error:', err.message || err);
    return res.status(500).json({ error: 'Server error during order creation.' });
  }
}
