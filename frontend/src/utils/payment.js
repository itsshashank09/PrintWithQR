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
    const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan })
    });

    if (!res.ok) {
      let errMsg = 'Failed to create payment order.';
      try {
        const errJson = await res.json();
        if (errJson?.error) errMsg = errJson.error;
      } catch (e) {
        // use default errMsg
      }
      throw new Error(errMsg);
    }

    const orderData = await res.json();
    const isYearly = plan === 'yearly';
    const razorpayKey = orderData?.key || import.meta.env.VITE_RAZORPAY_KEY_ID;

    if (!razorpayKey || !orderData?.order_id) {
      throw new Error('Could not obtain valid payment order from server.');
    }

    // 2. Configure Razorpay modal options
    const options = {
      key: razorpayKey,
      amount: orderData.amount,
      currency: orderData.currency || 'INR',
      name: 'PrintWithQR.in',
      description: isYearly ? 'Annual Print Shop Plan (₹599/year)' : 'Monthly Print Shop Plan (₹99/month)',
      order_id: orderData.order_id,
      prefill: {
        contact: phone || localStorage.getItem('saved_phone') || '',
        name: name || localStorage.getItem('shopName') || ''
      },
      handler: async function (paymentRes) {
        try {
          if (setLoading) setLoading(true);

          // Get auth token if user is signed in
          const { data: { session } } = await supabase.auth.getSession();
          const headers = { 'Content-Type': 'application/json' };
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
          }

          // Verify signature and update backend securely
          const verifyRes = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/verify-payment`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              razorpay_order_id: paymentRes.razorpay_order_id,
              razorpay_payment_id: paymentRes.razorpay_payment_id,
              razorpay_signature: paymentRes.razorpay_signature,
              plan,
              shopId
            })
          });

          const verifyData = await verifyRes.json();

          if (!verifyRes.ok || !verifyData.success) {
            throw new Error(verifyData.error || 'Payment verification failed on server.');
          }

          alert(`🎉 Payment Successful! Your ${isYearly ? 'Annual' : 'Monthly'} plan is now active.`);
          if (onSuccess) onSuccess(verifyData?.expiresAt);
        } catch (err) {
          console.error('[payment-util] Verification error:', err);
          alert(err.message || 'Payment verification error. Please contact support.');
          if (onError) onError(err.message);
        } finally {
          if (setLoading) setLoading(false);
        }
      },
      modal: {
        ondismiss: function () {
          if (setLoading) setLoading(false);
        }
      },
      theme: { color: '#5B7CFA' }
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
