import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Phone, MapPin, Printer, Lock, ChevronLeft, Landmark, AlertCircle, Save, Eye, EyeOff, ShieldCheck, Zap, Calendar, Clock } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { processSubscriptionPayment } from '../utils/payment';

const Profile = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [printerModel, setPrinterModel] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [bwRate, setBWRate] = useState('5.0');
  const [colorRate, setColorRate] = useState('10.0');
  const [colorEnabled, setColorEnabled] = useState(true);
  
  // Subscription state
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState('active');
  const [isPaid, setIsPaid] = useState(1);
  const [freePrintsAllowed, setFreePrintsAllowed] = useState(10);
  const [freePrintsUsed, setFreePrintsUsed] = useState(0);
  const [upgradingPlan, setUpgradingPlan] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const shopId = localStorage.getItem('shopId');

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      // Get currently authenticated Supabase user
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) {
        navigate('/login');
        return;
      }

      const activeShopId = user.id;
      const userPhone = user.user_metadata?.phone || localStorage.getItem('saved_phone') || '';
      let shopData = null;

      // 1. Try querying public.shops by user ID
      const { data: shopById } = await supabase
        .from('shops')
        .select('*')
        .eq('id', activeShopId)
        .maybeSingle();

      if (shopById) {
        shopData = shopById;
      } else if (userPhone) {
        // 2. Fallback query by phone number
        const { data: shopByPhone } = await supabase
          .from('shops')
          .select('*')
          .eq('phone', userPhone.replace(/\D/g, ''))
          .maybeSingle();

        if (shopByPhone) {
          shopData = shopByPhone;
          await supabase.from('shops').update({ id: activeShopId }).eq('phone', userPhone.replace(/\D/g, ''));
        }
      }

      // 3. Self-healing fallback: If shop row doesn't exist yet, insert row automatically
      if (!shopData) {
        const defaultShopName = user.user_metadata?.name || localStorage.getItem('shopName') || 'Print Shop';
        const defaultPhone = userPhone.replace(/\D/g, '');
        
        const newShopRow = {
          id: activeShopId,
          name: defaultShopName,
          phone: defaultPhone,
          address: 'Not Provided',
          bw_rate: 5.0,
          color_rate: 10.0,
          color_enabled: 1,
          is_paid: 1,
          subscription_status: 'active',
          subscription_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        };

        const { data: createdShop } = await supabase
          .from('shops')
          .upsert(newShopRow)
          .select()
          .maybeSingle();

        shopData = createdShop || newShopRow;
      }

      // Set state safely
      localStorage.setItem('shopId', activeShopId);
      setName(shopData.name || '');
      setPhone(shopData.phone || userPhone || '');
      setAddress(shopData.address === 'Not Provided' ? '' : (shopData.address || ''));
      setPrinterModel(shopData.printer_model || '');
      setBWRate((shopData.bw_rate ?? 5.0).toString());
      setColorRate((shopData.color_rate ?? 10.0).toString());
      setColorEnabled(shopData.color_enabled !== 0);

      setSubscriptionExpiresAt(shopData.subscription_expires_at || null);
      setSubscriptionStatus(shopData.subscription_status || 'active');
      setIsPaid(shopData.is_paid ?? 1);
      setFreePrintsAllowed(Number(shopData.free_prints_allowed ?? 10));
      setFreePrintsUsed(Number(shopData.free_prints_used ?? 0));
    } catch (err) {
      console.error('Profile fetch error:', err);
      setError(err.message || 'Could not load profile details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [navigate]);

  const handleUpgradePlan = (planType = 'yearly') => {
    const activeShopId = localStorage.getItem('shopId') || shopId;
    processSubscriptionPayment({
      plan: planType,
      shopId: activeShopId,
      phone,
      name,
      setLoading: setUpgradingPlan,
      onSuccess: (newExpiry) => {
        if (newExpiry) setSubscriptionExpiresAt(newExpiry);
        setMessage(`✨ Successfully upgraded to ${planType === 'monthly' ? 'Monthly' : 'Annual'} Plan! Your subscription has been extended.`);
        fetchProfile();
      },
      onError: (errMsg) => {
        setError(errMsg);
      }
    });
  };

  const formatExpiryDate = (isoStr) => {
    if (!isoStr) return 'No active expiry set';
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getDaysRemaining = (isoStr) => {
    if (!isoStr) return null;
    const diff = new Date(isoStr) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const activeShopId = user?.id || localStorage.getItem('shopId');

      if (!activeShopId) {
        navigate('/login');
        return;
      }

      // 1. Update password in Supabase Auth if provided
      if (password.trim() !== '') {
        if (password.length < 6) {
          throw new Error('New password must be at least 6 characters.');
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match. Please re-enter your new password.');
        }
        const { error: authError } = await supabase.auth.updateUser({
          password: password
        });
        if (authError) {
          throw new Error(authError.message || 'Failed to update password.');
        }
      }

      const cleanPhone = phone.replace(/\D/g, '');

      // 2. Update shop fields in public.shops table
      const { error: dbError } = await supabase
        .from('shops')
        .upsert({
          id: activeShopId,
          name,
          phone: cleanPhone,
          address: address && address.trim() !== '' ? address : 'Not Provided',
          bw_rate: parseFloat(bwRate) || 0,
          color_rate: parseFloat(colorRate) || 0,
          color_enabled: colorEnabled ? 1 : 0,
          is_paid: 1
        });

      if (dbError) {
        throw new Error(dbError.message || 'Failed to update shop profile.');
      }

      localStorage.setItem('shopName', name);
      localStorage.setItem('saved_phone', cleanPhone);
      setMessage('Profile settings saved successfully!');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const daysLeft = getDaysRemaining(subscriptionExpiresAt);

  return (
    <div className="neo-container" style={{ padding: '30px 20px', maxWidth: '820px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
        <button className="neo-btn" onClick={() => navigate('/dashboard')} style={{ padding: '10px 15px', borderRadius: '12px' }}>
          <ChevronLeft size={18} /> Back
        </button>
        <h2>Shop Configuration & Plan</h2>
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>Loading settings...</div>
      ) : (
        <div className="neo-card" style={{ padding: '35px 30px' }}>
          {error && (
            <div className="neo-card-inset" style={{ padding: '12px 15px', color: 'var(--danger-color)', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderRadius: '12px' }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{error}</span>
            </div>
          )}

          {message && (
            <div className="neo-card-inset" style={{ padding: '12px 15px', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderRadius: '12px' }}>
              <Save size={18} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{message}</span>
            </div>
          )}

          {/* Subscription Plan & Expiry Display */}
          <div className="neo-card-inset" style={{ padding: '24px', borderRadius: '18px', marginBottom: '30px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '18px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <ShieldCheck size={22} style={{ color: 'var(--accent-color)' }} />
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Subscription & Free Print Status</h3>
                  <span className={`neo-badge ${subscriptionStatus === 'free' ? 'status-warning' : daysLeft !== null && daysLeft <= 3 ? 'status-cancelled' : 'status-completed'}`} style={{ fontSize: '0.78rem', padding: '4px 10px' }}>
                    {subscriptionStatus === 'free' ? 'Free Trial' : daysLeft !== null && daysLeft <= 0 ? 'Expired' : daysLeft !== null && daysLeft <= 3 ? 'Expiring Soon' : 'Active'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.92rem', color: 'var(--text-color)' }}>
                    <Calendar size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                    <span><strong>Expiry Date:</strong> {formatExpiryDate(subscriptionExpiresAt)}</span>
                  </div>

                  {subscriptionStatus === 'free' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                      <Clock size={16} style={{ flexShrink: 0 }} />
                      <span>{freePrintsUsed}/{freePrintsAllowed} free prints used</span>
                    </div>
                  ) : subscriptionExpiresAt && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', color: daysLeft <= 3 ? 'var(--danger-color)' : 'var(--text-secondary)' }}>
                      <Clock size={16} style={{ flexShrink: 0 }} />
                      <span>
                        {daysLeft <= 0
                          ? 'Your subscription has expired'
                          : `${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining until expiry`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <button 
                  type="button"
                  className="neo-btn"
                  onClick={() => handleUpgradePlan('monthly')}
                  disabled={upgradingPlan}
                  style={{ padding: '12px 20px', borderRadius: '12px', fontSize: '0.92rem', display: 'inline-flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'center' }}
                >
                  <Zap size={18} /> {upgradingPlan ? 'Connecting...' : 'Upgrade ₹99/mo'}
                </button>
                <button 
                  type="button"
                  className="neo-btn neo-btn-primary"
                  onClick={() => handleUpgradePlan('yearly')}
                  disabled={upgradingPlan}
                  style={{ padding: '12px 20px', borderRadius: '12px', fontSize: '0.92rem', display: 'inline-flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'center' }}
                >
                  <Zap size={18} /> {upgradingPlan ? 'Connecting...' : 'Upgrade ₹599/yr'}
                </button>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '15px' }}>
                * Both plans include the exact same premium features. Save more with the Yearly plan!
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="neo-grid" style={{ gap: '0 25px', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              
              <div className="neo-input-group">
                <label className="neo-label">Shop Owner Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-secondary)' }} />
                  <input
                    type="text"
                    className="neo-input"
                    style={{ paddingLeft: '45px' }}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              <div className="neo-input-group">
                <label className="neo-label">Phone Number</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-secondary)' }} />
                  <input
                    type="tel"
                    className="neo-input"
                    style={{ paddingLeft: '45px' }}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="neo-input-group">
                <label className="neo-label">Printer Model</label>
                <div style={{ position: 'relative' }}>
                  <Printer size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-secondary)' }} />
                  <input
                    type="text"
                    className="neo-input"
                    style={{ paddingLeft: '45px' }}
                    value={printerModel}
                    onChange={(e) => setPrinterModel(e.target.value)}
                  />
                </div>
              </div>

              <div className="neo-input-group">
                <label className="neo-label">Change Password <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>(Leave blank to keep current)</span></label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="neo-input"
                    style={{ paddingLeft: '45px', paddingRight: '48px' }}
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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

              <div className="neo-input-group">
                <label className="neo-label">Confirm New Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="neo-input"
                    style={{
                      paddingLeft: '45px',
                      paddingRight: '48px',
                      borderColor: confirmPassword && password !== confirmPassword ? 'var(--danger-color)' : ''
                    }}
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '6px' }}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                    title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--danger-color)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <AlertCircle size={13} /> Passwords do not match
                  </p>
                )}
                {confirmPassword && password === confirmPassword && password.length >= 6 && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--success-color)', marginTop: '6px' }}>✓ Passwords match</p>
                )}
              </div>
            </div>

            <div className="neo-input-group">
              <label className="neo-label">Shop Address</label>
              <div style={{ position: 'relative' }}>
                <MapPin size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  className="neo-input"
                  style={{ paddingLeft: '45px' }}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </div>

            {/* Print Rates configuration */}
            <div className="neo-card-inset" style={{ padding: '20px', borderRadius: '15px', marginBottom: '25px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '15px', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Landmark size={18} /> Print Rates Configuration
              </h3>
              <div className="neo-grid" style={{ gap: '0 20px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '20px' }}>
                <div className="neo-input-group" style={{ marginBottom: 0 }}>
                  <label className="neo-label">Black &amp; White Rate (₹/page)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="neo-input"
                    value={bwRate}
                    onChange={(e) => setBWRate(e.target.value)}
                  />
                </div>

                <div className="neo-input-group" style={{ marginBottom: 0 }}>
                  <label className="neo-label">Color Rate (₹/page)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="neo-input"
                    value={colorRate}
                    onChange={(e) => setColorRate(e.target.value)}
                  />
                </div>
              </div>

              {/* Toggle Color Option */}
              <div className="neo-switch-container" style={{ margin: 0, paddingTop: '15px', borderTop: '1px solid var(--border-color)' }}>
                <div>
                  <span className="neo-switch-label" style={{ fontWeight: 600 }}>Enable Color Printing Option</span>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: 0 }}>
                    If disabled, customers will only be able to place Black &amp; White print orders (Color toggle will be hidden).
                  </p>
                </div>
                <label className="neo-switch">
                  <input 
                    type="checkbox" 
                    checked={colorEnabled} 
                    onChange={(e) => setColorEnabled(e.target.checked)} 
                  />
                  <span className="neo-slider"></span>
                </label>
              </div>
            </div>

            {/* Offline Payment Notice */}
            <div className="neo-card-inset" style={{ padding: '15px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '15px' }}>
              <Landmark size={20} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Offline Counter Payment Only</span>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Customer interface only supports Counter Payment (Offline Cash). Online customer checkout is disabled.
                </p>
              </div>
            </div>

            <button type="submit" className="neo-btn neo-btn-primary" style={{ width: '100%', padding: '14px', borderRadius: '15px' }} disabled={loading}>
              Save Settings &amp; Update Rates
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default Profile;
