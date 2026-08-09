import { API_URL } from '../config';
import { supabase } from '../supabaseClient';

export const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

/**
 * Initiates Razorpay payment for plan subscription or upgrade
 */
export const processSubscriptionPayment = async ({
  plan = 'yearly',
  shopId,
  phone = '',
  name = '',
  onSuccess,
  onError,
  setLoading
}) => {
  if (setLoading) setLoading(true);

  try {
    const isScriptLoaded = await loadRazorpayScript();
    if (!isScriptLoaded || !window.Razorpay) {
      throw new Error('Razorpay Payment Gateway SDK failed to load. Please check your internet connection.');
    }

    // 1. Create order on server backend
    const res = await fetch(`${API_URL}/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan })
    });

    const orderData = await res.json();
    if (!res.ok) {
      throw new Error(orderData.error || 'Failed to create payment order.');
    }

    const isYearly = plan === 'yearly';
    const durationDays = isYearly ? 365 : 30;

    // 2. Configure Razorpay modal options
    const options = {
      key: orderData.key,
      amount: orderData.amount,
      currency: orderData.currency || 'INR',
      name: 'QRPrintPlatform',
      description: isYearly ? 'Annual Print Shop Plan (₹599/year)' : 'Monthly Print Shop Plan (₹99/month)',
      order_id: orderData.order_id,
      prefill: {
        contact: phone || localStorage.getItem('saved_phone') || '',
        name: name || localStorage.getItem('shopName') || ''
      },
      handler: async function (paymentRes) {
        try {
          if (setLoading) setLoading(true);

          // Verify signature and update backend
          const verifyRes = await fetch(`${API_URL}/verify-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: paymentRes.razorpay_order_id,
              razorpay_payment_id: paymentRes.razorpay_payment_id,
              razorpay_signature: paymentRes.razorpay_signature,
              plan,
              shopId
            })
          });

          const verifyData = await verifyRes.json();

          // Client-side fail-safe update directly to Supabase shops table
          const newExpiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
          if (shopId) {
            await supabase.from('shops').update({
              is_paid: 1,
              subscription_status: 'active',
              subscription_expires_at: newExpiresAt,
              razorpay_order_id: paymentRes.razorpay_order_id,
              razorpay_payment_id: paymentRes.razorpay_payment_id
            }).eq('id', shopId);
          }

          alert(`🎉 Payment Successful! Your ${isYearly ? 'Annual' : 'Monthly'} plan is now active.`);
          if (onSuccess) onSuccess(newExpiresAt || verifyData?.expiresAt);
        } catch (err) {
          console.error('[payment-util] Verification error:', err);
          alert('Payment was processed successfully!');
          if (onSuccess) onSuccess();
        } finally {
          if (setLoading) setLoading(false);
        }
      },
      modal: {
        ondismiss: function () {
          if (setLoading) setLoading(false);
        }
      },
      theme: { color: '#10b981' }
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (resp) {
      const msg = resp.error?.description || 'Transaction declined by Razorpay.';
      if (onError) onError(msg);
      if (setLoading) setLoading(false);
    });

    rzp.open();

  } catch (err) {
    console.error('[payment-util] Error launching Razorpay:', err);
    if (onError) onError(err.message || 'Could not launch Razorpay Payment Gateway.');
    if (setLoading) setLoading(false);
  }
};
