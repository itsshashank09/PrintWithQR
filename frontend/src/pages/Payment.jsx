import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle, QrCode, HardDrive, Terminal, AlertCircle, CreditCard, ShieldCheck, Zap, ArrowRight, X } from 'lucide-react';
import { supabase } from '../supabaseClient';

// Dynamic script loader helper for checkout.js
const loadRazorpayScript = () => {
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

const Payment = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('monthly'); // 'monthly' or 'yearly'

  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const planParam = searchParams.get('plan');
      if (planParam === 'yearly' || planParam === 'monthly') {
        setSelectedPlan(planParam);
      }
    } catch (e) {
      console.error('Error reading query parameters:', e);
    }
  }, []);

  const handleCompleteSubscriptionPayment = async (paymentId, orderId, signature) => {
    setLoading(true);
    setError('');

    try {
      const effectiveShopId = shopId || localStorage.getItem('shopId');
      if (!effectiveShopId) {
        throw new Error('Shop ID is missing. Please sign in again or contact support.');
      }

      const verifyRes = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/verify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
          plan: selectedPlan,
          shopId: effectiveShopId
        })
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.success) {
        throw new Error(verifyData.error || 'Payment verification failed.');
      }

      alert('Payment verified. Your subscription is now active.');
      navigate('/dashboard');
    } catch (err) {
      console.error('[Payment] Subscription completion error:', err);
      setError(err.message || 'Payment verification failed. Please contact support.');
    } finally {
      setLoading(false);
    }
  };



  const handlePay = async () => {
    setLoading(true);
    setError('');

    try {
      // 1. Try launching Razorpay standard checkout
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ plan: selectedPlan })
      });

      const orderData = await response.json();
      const isScriptLoaded = await loadRazorpayScript();

      // If Razorpay API returned a valid order and key is active
      if (response.ok && orderData.isRealOrder && isScriptLoaded && window.Razorpay) {
        const options = {
          key: orderData.key,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: 'QRPrintPlatform',
          description: selectedPlan === 'yearly' ? 'Annual Print Shop Plan (₹599)' : 'Monthly Print Shop Plan (₹99)',
          order_id: orderData.order_id,
          handler: function (res) {
            handleCompleteSubscriptionPayment(res.razorpay_payment_id, res.razorpay_order_id, res.razorpay_signature);
          },
          prefill: {
            contact: localStorage.getItem('saved_phone') || '',
            name: localStorage.getItem('shopName') || ''
          },
          modal: {
            ondismiss: function () {
              setLoading(false);
            }
          },
          theme: {
            color: '#10b981'
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (res) {
          setError('Payment Failed: ' + (res.error?.description || 'Transaction declined by Razorpay.'));
          setLoading(false);
        });
        rzp.open();
        return;
      }

      setError('Razorpay Payment Gateway Error: Could not connect to Razorpay live checkout.');
    } catch (err) {
      console.error('Razorpay Checkout Error:', err);
      setError(err.message || 'Could not initiate Razorpay Payment Gateway.');
    } finally {
      setLoading(false);
    }
  };

  const amountToPay = selectedPlan === 'yearly' ? 599 : 99;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '90vh', padding: '20px' }}>
      <div className="neo-card" style={{ width: '100%', maxWidth: '620px', padding: '40px 30px' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h2>Select Subscription Plan</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '8px' }}>
            Choose a plan to complete payment and activate your account
          </p>
        </div>

        {error && (
          <div className="neo-card-inset" style={{ padding: '12px 15px', color: 'var(--danger-color)', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderRadius: '12px' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{error}</span>
          </div>
        )}

        {/* Plan Selectors */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
          <div 
            className={selectedPlan === 'monthly' ? 'neo-card' : 'neo-card-inset'} 
            style={{ 
              flex: '1 1 200px', 
              padding: '20px', 
              cursor: 'pointer', 
              textAlign: 'center', 
              transition: 'transform 150ms var(--ease-out), box-shadow 150ms var(--ease-out)', 
              border: selectedPlan === 'monthly' ? '1px solid var(--accent)' : '1px solid transparent',
              marginBottom: 0
            }}
            onClick={() => setSelectedPlan('monthly')}
          >
            <span style={{ display: 'block', fontWeight: 700, fontSize: '1rem', color: selectedPlan === 'monthly' ? 'var(--accent)' : 'var(--text-primary)' }}>Monthly Plan</span>
            <span style={{ display: 'block', fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', margin: '8px 0' }}>₹99</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Billed Monthly</span>
          </div>

          <div 
            className={selectedPlan === 'yearly' ? 'neo-card' : 'neo-card-inset'} 
            style={{ 
              flex: '1 1 200px', 
              padding: '20px', 
              cursor: 'pointer', 
              textAlign: 'center', 
              transition: 'transform 150ms var(--ease-out), box-shadow 150ms var(--ease-out)', 
              border: selectedPlan === 'yearly' ? '1px solid var(--accent)' : '1px solid transparent',
              position: 'relative',
              marginBottom: 0
            }}
            onClick={() => setSelectedPlan('yearly')}
          >
            <div style={{ position: 'absolute', top: '-12px', right: '15px', background: 'var(--bg)', border: '1px solid var(--accent)', color: 'var(--accent)', fontSize: '0.7rem', padding: '3px 10px', borderRadius: '12px', fontWeight: 800, boxShadow: 'var(--shadow-extrude-sm)' }}>
              ★ 50% OFF
            </div>
            <span style={{ display: 'block', fontWeight: 700, fontSize: '1rem', color: selectedPlan === 'yearly' ? 'var(--accent)' : 'var(--text-primary)' }}>Annual Plan</span>
            <span style={{ display: 'block', fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', margin: '8px 0' }}>₹599</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Billed Yearly</span>
          </div>
        </div>

        <div className="neo-card-inset" style={{ padding: '25px', borderRadius: '15px', marginBottom: '30px' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            Subscription Benefits:
          </h3>
          {selectedPlan === 'monthly' ? (
            <>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <CheckCircle size={18} style={{ color: 'var(--success-color)', flexShrink: 0 }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <QrCode size={16} className="text-secondary" style={{ flexShrink: 0 }} />
                    <span>Custom Shop QR Code (redirects customers directly to checkout)</span>
                  </div>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <CheckCircle size={18} style={{ color: 'var(--success-color)', flexShrink: 0 }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <HardDrive size={16} className="text-secondary" style={{ flexShrink: 0 }} />
                    <span>Real-time admin dashboard queue</span>
                  </div>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <CheckCircle size={18} style={{ color: 'var(--success-color)', flexShrink: 0 }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Terminal size={16} className="text-secondary" style={{ flexShrink: 0 }} />
                    <span>Unlimited orders, 100% free of transaction commission</span>
                  </div>
                </li>
              </ul>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px' }}>
                * Both the ₹99 Monthly and ₹599 Yearly plans include the exact same premium features. Save more with the Yearly plan!
              </p>
            </>
          ) : (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <CheckCircle size={18} style={{ color: 'var(--success-color)', flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>Everything in Monthly Plan</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <CheckCircle size={18} style={{ color: 'var(--success-color)', flexShrink: 0 }} />
                <span>Save ₹489 annually (Get 5 months free)</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <CheckCircle size={18} style={{ color: 'var(--success-color)', flexShrink: 0 }} />
                <span>No monthly payment hassles</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <CheckCircle size={18} style={{ color: 'var(--success-color)', flexShrink: 0 }} />
                <span>Priority developer installation help</span>
              </li>
            </ul>
          )}
        </div>

        <button className="neo-btn neo-btn-primary" style={{ width: '100%', padding: '16px', borderRadius: '15px', fontSize: '1.05rem' }} onClick={handlePay} disabled={loading}>
          {loading ? 'Opening Payment Gateway...' : `Pay ₹${amountToPay} via Razorpay`}
        </button>
      </div>
    </div>
  );
};

export default Payment;
