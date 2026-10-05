import { platform } from '../utils/platform';
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Phone, Lock, Printer, AlertCircle, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { GradientBeamButton } from '../components/RectangleButtons';

const Login = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState(localStorage.getItem('saved_phone') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Validate the session; a stale local flag must not create a dashboard/login loop.
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (active && !error && data?.user && localStorage.getItem('shopId')) navigate('/dashboard', { replace: true });
      else if (active) localStorage.removeItem('token');
    }).catch(() => { if (active) localStorage.removeItem('token'); });
    return () => { active = false; };
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setError('');
    // Load the dashboard code while the sign-in request is in flight.
    void import('./Dashboard').catch(() => {});

    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const email = `${cleanPhone}@gmail.com`;

      // 1. Sign in via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        throw new Error(authError.message || 'Login failed.');
      }

      if (!authData.user) {
        throw new Error('No user profile found.');
      }

      const account = await platform('me', {}, true, 'GET');
      const shop = account.shops[0];
      if (!shop && !account.isAdmin) throw new Error('No registered business is attached to this account. Contact support.');
      if (!shop) { navigate('/admin'); return; }
      shop.is_admin = account.isAdmin;
      const expiryDate = shop.subscription_expires_at ? new Date(shop.subscription_expires_at) : null;
      const isExpired = expiryDate && expiryDate < new Date();
      const isFreePlan = shop.subscription_status === 'free';
      const freeRemaining = Number(shop.free_prints_allowed || 10) - Number(shop.free_prints_used || 0);

      const session = authData.session;
      if (session) {
        localStorage.setItem('token', session.access_token);
      }
      localStorage.setItem('shopId', shop.id);
      localStorage.setItem('shopName', shop.name);
      localStorage.setItem('saved_phone', cleanPhone);
      localStorage.setItem('isAdmin', shop.is_admin ? 'true' : 'false');

      if (shop.is_admin) {
        navigate('/admin');
      } else if (isFreePlan && freeRemaining > 0) {
        navigate('/dashboard');
      } else if (shop.is_paid === 1 && !isExpired && shop.subscription_status === 'active') {
        navigate('/dashboard');
      } else {
        navigate(`/payment/${shop.id}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '90vh', padding: '20px' }}>
      <div className="neo-card" style={{ width: '100%', maxWidth: '420px', padding: '40px 30px' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ display: 'inline-flex', width: '60px', height: '60px', borderRadius: '50%', background: 'var(--bg-color)', boxShadow: 'var(--shadow-light), var(--shadow-dark)', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-color)', marginBottom: '15px' }}>
            <Printer size={28} />
          </div>
          <h2>Partner Login</h2>
          <p>Manage your neomorphic print dashboard</p>
        </div>

        {error && (
          <div className="neo-card-inset" style={{ padding: '12px 15px', color: 'var(--danger-color)', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderRadius: '12px' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="neo-input-group">
            <label className="neo-label">Phone Number</label>
            <div style={{ position: 'relative' }}>
              <Phone size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-secondary)' }} />
              <input
                type="tel"
                className="neo-input"
                style={{ paddingLeft: '45px' }}
                placeholder="Enter registered phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="neo-input-group" style={{ marginBottom: '30px' }}>
            <label className="neo-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                className="neo-input"
                style={{ paddingLeft: '45px', paddingRight: '48px' }}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '6px' }}
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <GradientBeamButton 
            type="submit" 
            style={{ width: '100%', padding: '14px', borderRadius: '15px', justifyContent: 'center' }} 
            disabled={loading}
            icon={<ArrowRight size={16} className="btn-beam-icon" />}
          >
            {loading ? 'Logging in...' : 'Sign In to Dashboard'}
          </GradientBeamButton>
        </form>

        <div style={{ textAlign: 'center', marginTop: '25px', fontSize: '0.95rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Don't have an account? </span>
          <Link to="/register" style={{ color: 'var(--accent-color)', fontWeight: 600, textDecoration: 'none' }}>Register here</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
