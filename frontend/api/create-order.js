import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const razorpayKeyId = (process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || 'rzp_live_TGXJziexG4WkWN').trim();
const razorpayKeySecret = (process.env.RAZORPAY_KEY_SECRET || 'HJWKmlaStbKPTl9hAWuCQPyt').trim();

export default async function handler(req, res) {
  // Set CORS headers
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
    const { plan, amount: reqAmount, currency: reqCurrency } = req.body || {};

    let amountInPaise = 9900; // Monthly plan ₹99 (9900 paise)
    if (reqAmount && typeof reqAmount === 'number') {
      amountInPaise = reqAmount;
    } else if (plan === 'yearly') {
      amountInPaise = 59900; // ₹599 (59900 paise)
    }

    // Minimum amount validation: Must be >= 100 paise
    if (isNaN(amountInPaise) || amountInPaise < 100) {
      return res.status(400).json({ error: 'Invalid amount. Minimum amount is 100 paise (₹1).' });
    }

    // Receipt length MUST be <= 40 characters for Razorpay API validation
    const shortReceipt = `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // Call Razorpay REST API directly using Basic Auth
    const basicAuthToken = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64');
    
    let rzpOrder = null;
    let rzpRes = null;

    try {
      rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${basicAuthToken}`
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: reqCurrency || 'INR',
          receipt: shortReceipt
        })
      });

      if (rzpRes && rzpRes.ok) {
        rzpOrder = await rzpRes.json();
      } else if (rzpRes) {
        const errText = await rzpRes.text();
        console.warn('Razorpay API order creation warning:', rzpRes.status, errText);
      }
    } catch (fetchErr) {
      console.warn('Fetch to Razorpay API failed:', fetchErr);
    }

    // If Razorpay API returned a valid order
    if (rzpOrder && rzpOrder.id) {
      return res.status(200).json({
        id: rzpOrder.id,
        order_id: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        key: razorpayKeyId,
        isRealOrder: true
      });
    }

    // Fallback for standard checkout modal when order creation is not supported by key
    return res.status(200).json({
      amount: amountInPaise,
      currency: 'INR',
      key: razorpayKeyId,
      isRealOrder: false
    });
  } catch (err) {
    console.error('Create Order Outer Error:', err);
    return res.status(500).json({ error: err.message || 'Server error during order creation.' });
  }
}
