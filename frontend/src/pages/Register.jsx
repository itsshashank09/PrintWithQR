import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Phone, MapPin, Printer, Lock, Landmark, AlertCircle, ArrowRight, ArrowLeft, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { getDeviceFingerprint } from '../utils/deviceFingerprint';

const Register = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [registeredShopName, setRegisteredShopName] = useState('');

  const eyeBtnStyle = {
    position: 'absolute',
    right: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    padding: '4px',
    borderRadius: '6px',
    transition: 'color 150ms var(--ease-out)'
  };

  const handleNextStep = (e) => {
    e.preventDefault();
    if (!name || !phone || !password || !confirmPassword) {
      setError('Name, phone number, and password are required.');
      return;
    }
    if (phone.length < 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const cleanPhone = phone.replace(/\D/g, '');
      if (!address.trim()) {
        setError('Shop address is required.');
        setLoading(false);
        return;
      }

      const deviceInfo = await getDeviceFingerprint();
      const payload = {
        name: name.trim(),
        phone: cleanPhone,
        password,
        address: address.trim(),
        printerModel: printerModel.trim(),
        bwRate: parseFloat(bwRate) || 5.0,
        colorRate: parseFloat(colorRate) || 10.0,
        deviceId: deviceInfo.deviceId,
        botScore: deviceInfo.botScore,
        botFlags: deviceInfo.botFlags
      };

      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/register-shop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Registration failed.');
      }

      setRegistrationSuccess(true);
      setRegisteredShopName(name.trim());
      localStorage.setItem('shopId', result.shopId);
      localStorage.setItem('shopName', name.trim());
      localStorage.setItem('saved_phone', cleanPhone);
      localStorage.setItem('token', `free_${result.shopId}_${Date.now()}`);

      await supabase.auth.signInWithPassword({ email: `${cleanPhone}@gmail.com`, password });
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '95vh', padding: '40px 20px' }}>
      <div className="neo-card" style={{ width: '100%', maxWidth: '580px', padding: '40px 30px' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ display: 'inline-flex', width: '60px', height: '60px', borderRadius: '50%', background: 'var(--bg-color)', boxShadow: 'var(--shadow-light), var(--shadow-dark)', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-color)', marginBottom: '15px' }}>
            <Printer size={28} />
          </div>
          <h2>Shop Registration</h2>
          <p>
            {step === 1 ? 'Step 1 of 2: Create Owner Account' : 'Step 2 of 2: Configure Shop Details'}
          </p>
          
          {/* Visual Step Indicator Progress Bar */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '15px' }}>
            <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'var(--accent-color)', opacity: step >= 1 ? 1 : 0.3 }} />
            <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'var(--accent-color)', opacity: step >= 2 ? 1 : 0.3 }} />
          </div>
        </div>

        {error && (
          <div className="neo-card-inset" style={{ padding: '12px 15px', color: 'var(--danger-color)', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderRadius: '12px' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{error}</span>
          </div>
        )}

        {registrationSuccess ? (
          <div style={{ textAlign: 'center', padding: '35px 20px' }}>
            <div style={{ display: 'inline-flex', width: '72px', height: '72px', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16,185,129,0.12)', margin: '0 auto 20px' }}>
              <CheckCircle size={42} style={{ color: 'var(--success-color)' }} />
            </div>
            <h2>Shop Created Successfully!</h2>
            <p style={{ color: 'var(--text-secondary)', margin: '16px 0', lineHeight: '1.6' }}>
              Your shop account is ready and you have received 10 free prints.
            </p>
            <div style={{ margin: '20px 0', color: 'var(--text-color)', fontWeight: 700 }}>
              {registeredShopName}
            </div>
            <button
              className="neo-btn neo-btn-primary"
              style={{ width: '100%', padding: '14px', borderRadius: '15px' }}
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard
            </button>
          </div>
        ) : step === 1 ? (
          /* Step 1 Form */
          <form onSubmit={handleNextStep}>
            <div className="neo-input-group">
              <label className="neo-label">Shop Owner Name *</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  className="neo-input"
                  style={{ paddingLeft: '45px' }}
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="neo-input-group">
              <label className="neo-label">10-Digit Mobile Phone Number *</label>
              <div style={{ position: 'relative' }}>
                <Phone size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-secondary)' }} />
                <input
                  type="tel"
                  className="neo-input"
                  style={{ paddingLeft: '45px' }}
                  placeholder="e.g. 9876543210"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="neo-input-group">
              <label className="neo-label">Account Password *</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-secondary)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="neo-input"
                  style={{ paddingLeft: '45px', paddingRight: '48px' }}
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  style={eyeBtnStyle}
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="neo-input-group">
              <label className="neo-label">Confirm Password *</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-secondary)' }} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="neo-input"
                  style={{
                    paddingLeft: '45px',
                    paddingRight: '48px',
                    borderColor: confirmPassword && password !== confirmPassword ? 'var(--danger-color)' : ''
                  }}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  style={eyeBtnStyle}
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
                <p style={{ fontSize: '0.8rem', color: 'var(--success-color)', marginTop: '6px' }}>
                  ✓ Passwords match
                </p>
              )}
            </div>

            <button type="submit" className="neo-btn neo-btn-primary" style={{ width: '100%', marginTop: '10px' }}>
              Continue to Shop Configuration <ArrowRight size={18} />
            </button>
          </form>
        ) : (
          /* Step 2 Form */
          <form onSubmit={handleSubmit}>
            <div className="neo-input-group">
              <label className="neo-label">Shop Address *</label>
              <div style={{ position: 'relative' }}>
                <MapPin size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  className="neo-input"
                  style={{ paddingLeft: '45px' }}
                  placeholder="Shop number, Street, Area, City"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
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
                  placeholder="e.g. Epson L3210"
                  value={printerModel}
                  onChange={(e) => setPrinterModel(e.target.value)}
                />
              </div>
            </div>

            <div className="neo-card-inset" style={{ padding: '20px', borderRadius: '15px', marginBottom: '25px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', color: 'var(--accent-color)', fontWeight: 600 }}>
                <Landmark size={18} /> Print Rates Configuration
              </div>
              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label className="neo-label" style={{ fontSize: '0.8rem' }}>Black &amp; White Rate (₹/page)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    className="neo-input"
                    value={bwRate}
                    onChange={(e) => setBWRate(e.target.value)}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="neo-label" style={{ fontSize: '0.8rem' }}>Color Rate (₹/page)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1.0"
                    className="neo-input"
                    value={colorRate}
                    onChange={(e) => setColorRate(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <button 
                type="button" 
                className="neo-btn" 
                style={{ flex: '1' }}
                onClick={() => setStep(1)}
              >
                <ArrowLeft size={18} /> Back
              </button>
              <button 
                type="submit" 
                className="neo-btn neo-btn-primary" 
                style={{ flex: '2' }}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Create Shop Account'}
              </button>
            </div>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '30px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--accent-color)', fontWeight: 600 }}>Sign in here</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
