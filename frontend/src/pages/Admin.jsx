import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Printer, Search, Edit, Trash2, Power, Calendar, 
  DollarSign, CheckCircle2, XCircle, ArrowLeft, LogOut, 
  RefreshCw, AlertTriangle, UserCheck, Shield, Lock, User, Key, Phone
} from 'lucide-react';
import { supabase } from '../supabaseClient';

const Admin = () => {
  const navigate = useNavigate();
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, inactive, expired
  const [editingShop, setEditingShop] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [renewingShop, setRenewingShop] = useState(null);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewalDays, setRenewalDays] = useState('30');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null); // stores shop object to delete

  // Admin login states
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');
  const [adminSubmitting, setAdminSubmitting] = useState(false);

  // Fetch all shops
  const fetchShops = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: fetchErr } = await supabase
        .from('shops')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setShops(data || []);
    } catch (err) {
      console.error('Error fetching shops:', err);
      setError(err.message || 'Failed to load shops.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkAdminAuth = async () => {
      setCheckingAuth(true);
      try {
        const storedAdminSession = sessionStorage.getItem('adminSession') || localStorage.getItem('adminSession');
        if (storedAdminSession === 'true') {
          setIsAdminUser(true);
          fetchShops();
          setCheckingAuth(false);
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: currentShop } = await supabase
            .from('shops')
            .select('is_admin')
            .eq('id', user.id)
            .single();

          if (currentShop && currentShop.is_admin) {
            setIsAdminUser(true);
            localStorage.setItem('adminSession', 'true');
            fetchShops();
            setCheckingAuth(false);
            return;
          }
        }

        setIsAdminUser(false);
      } catch (err) {
        setIsAdminUser(false);
      } finally {
        setCheckingAuth(false);
      }
    };

    checkAdminAuth();
  }, []);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAdminLoginError('');
    setAdminSubmitting(true);

    try {
      const u = adminUsername.trim();
      const p = adminPassword.trim();

      // Verify master credentials: Username: Shashank, Password: Shashu(079)
      if (
        (u.toLowerCase() === 'shashank' || u === '9483030043' || u.toLowerCase() === 'shashank@gmail.com') &&
        p === 'Shashu(079)'
      ) {
        sessionStorage.setItem('adminSession', 'true');
        localStorage.setItem('adminSession', 'true');
        localStorage.setItem('isAdmin', 'true');
        setIsAdminUser(true);
        fetchShops();
        return;
      }

      // Fallback: Check Supabase Auth credentials for admin flag
      const email = u.includes('@') ? u : `${u.replace(/\D/g, '')}@gmail.com`;
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password: p
      });

      if (!authErr && authData?.user) {
        const { data: currentShop } = await supabase
          .from('shops')
          .select('is_admin')
          .eq('id', authData.user.id)
          .single();

        if (currentShop && currentShop.is_admin) {
          sessionStorage.setItem('adminSession', 'true');
          localStorage.setItem('adminSession', 'true');
          localStorage.setItem('isAdmin', 'true');
          setIsAdminUser(true);
          fetchShops();
          return;
        }
      }

      throw new Error('Invalid Super Admin Username or Password.');
    } catch (err) {
      setAdminLoginError(err.message || 'Invalid Admin Credentials.');
    } finally {
      setAdminSubmitting(false);
    }
  };

  // Filtered shops list
  const filteredShops = shops.filter(shop => {
    // 1. Search Query filter
    const matchesSearch = 
      shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (shop.phone && shop.phone.includes(searchQuery)) ||
      (shop.id && shop.id.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    // 2. Status filter
    const isExpired = shop.subscription_expires_at && new Date(shop.subscription_expires_at) < new Date();
    const isActive = shop.is_paid === 1 && !isExpired && shop.subscription_status === 'active';

    if (filterStatus === 'active') return isActive;
    if (filterStatus === 'inactive') return shop.subscription_status !== 'active' || shop.is_paid !== 1;
    if (filterStatus === 'expired') return isExpired;

    return true;
  });

  // Calculate high-level stats
  const totalShops = shops.length;
  const activeShops = shops.filter(s => {
    const isExpired = s.subscription_expires_at && new Date(s.subscription_expires_at) < new Date();
    return s.is_paid === 1 && !isExpired && s.subscription_status === 'active';
  }).length;
  const inactiveShops = totalShops - activeShops;
  const totalRevenueEst = shops.filter(s => s.is_paid === 1).length * 99; // Estimate based on Setup fee

  // Toggle active/inactive status
  const handleToggleStatus = async (shop) => {
    try {
      const isExpired = shop.subscription_expires_at && new Date(shop.subscription_expires_at) < new Date();
      const currentActive = shop.is_paid === 1 && !isExpired && shop.subscription_status === 'active';
      const newStatus = currentActive ? 'inactive' : 'active';
      const newIsPaid = currentActive ? 0 : 1;

      // If activating and subscription is expired or not set, set it to 30 days from now
      let newExpiry = shop.subscription_expires_at;
      if (!currentActive && (!shop.subscription_expires_at || isExpired)) {
        newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + 30);
      }

      const { error: updateErr } = await supabase
        .from('shops')
        .update({ 
          subscription_status: newStatus, 
          is_paid: newIsPaid,
          subscription_expires_at: newExpiry
        })
        .eq('id', shop.id);

      if (updateErr) throw updateErr;

      // Update state local
      setShops(prev => prev.map(s => {
        if (s.id === shop.id) {
          return { ...s, subscription_status: newStatus, is_paid: newIsPaid, subscription_expires_at: newExpiry };
        }
        return s;
      }));
    } catch (err) {
      alert('Failed to update shop status: ' + err.message);
    }
  };

  // Renew/Extend subscription
  const handleRenewSubscription = async () => {
    if (!renewingShop) return;
    try {
      const days = parseInt(renewalDays);
      let baseDate = new Date();
      
      // If current subscription is active and not expired, extend it from the expiry date
      if (renewingShop.subscription_expires_at && new Date(renewingShop.subscription_expires_at) > new Date()) {
        baseDate = new Date(renewingShop.subscription_expires_at);
      }

      baseDate.setDate(baseDate.getDate() + days);

      const { error: updateErr } = await supabase
        .from('shops')
        .update({ 
          subscription_expires_at: baseDate,
          subscription_status: 'active',
          is_paid: 1
        })
        .eq('id', renewingShop.id);

      if (updateErr) throw updateErr;

      setShops(prev => prev.map(s => {
        if (s.id === renewingShop.id) {
          return { ...s, subscription_expires_at: baseDate, subscription_status: 'active', is_paid: 1 };
        }
        return s;
      }));

      setShowRenewModal(false);
      setRenewingShop(null);
    } catch (err) {
      alert('Failed to extend subscription: ' + err.message);
    }
  };

  // Edit shop details
  const handleSaveDetails = async (e) => {
    e.preventDefault();
    if (!editingShop) return;
    try {
      const cleanPhone = editingShop.phone ? String(editingShop.phone).replace(/\D/g, '') : null;
      
      const shopDetailsToUpdate = {
        name: editingShop.name,
        phone: cleanPhone,
        address: editingShop.address,
        bw_rate: parseFloat(editingShop.bw_rate) || 2.0,
        color_rate: parseFloat(editingShop.color_rate) || 10.0
      };

      const passRes = await fetch('/api/update-shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          shopId: editingShop.id, 
          shopDetails: shopDetailsToUpdate,
          newPassword: editingShop.newPassword ? editingShop.newPassword.trim() : null
        })
      });
      
      const passData = await passRes.json();
      if (!passRes.ok) {
        throw new Error(passData.error || 'Failed to update shop via secure API');
      }

      setShops(prev => prev.map(s => {
        if (s.id === editingShop.id) {
          return { ...s, ...editingShop, phone: cleanPhone };
        }
        return s;
      }));

      setShowEditModal(false);
      setEditingShop(null);
    } catch (err) {
      alert('Failed to update shop details: ' + err.message);
    }
  };

  // Delete shop account permanently
  const handleDeleteShop = async () => {
    if (!showDeleteConfirm) return;
    const shopIdToDelete = showDeleteConfirm.id;
    const shopNameToDelete = showDeleteConfirm.name;

    try {
      setLoading(true);

      // 1. Call serverless delete-shop endpoint to purge orders, shop, and auth user
      const response = await fetch('/api/delete-shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId: shopIdToDelete })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete shop via API');
      }

      // We still run client-side fallback just in case the API had issues but didn't throw
      await supabase.from('orders').delete().eq('shop_id', shopIdToDelete);
      await supabase.from('shops').delete().eq('id', shopIdToDelete);
      
      setShops(prev => prev.filter(s => s.id !== shopIdToDelete));
      setShowDeleteConfirm(null);
      alert(`Shop account (${shopNameToDelete}) and all associated orders/data have been permanently deleted. The user can now register fresh as a new shop owner.`);
    } catch (err) {
      alert('Failed to delete shop account: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('adminSession');
    localStorage.removeItem('adminSession');
    localStorage.removeItem('isAdmin');
    setIsAdminUser(false);
    setAdminUsername('');
    setAdminPassword('');
  };

  const formatExpiryDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    const isExpired = d < new Date();
    return (
      <span style={{ color: isExpired ? 'var(--danger-color)' : 'var(--text-color)', fontWeight: isExpired ? '600' : 'normal' }}>
        {d.toLocaleDateString()} {isExpired ? '(Expired)' : ''}
      </span>
    );
  };

  if (checkingAuth) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <RefreshCw size={36} className="neo-upload-icon" />
      </div>
    );
  }

  if (!isAdminUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '90vh', padding: '20px' }}>
        <div className="neo-card" style={{ width: '100%', maxWidth: '440px', padding: '40px 30px' }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <div style={{ display: 'inline-flex', width: '60px', height: '60px', borderRadius: '50%', background: 'var(--bg-color)', boxShadow: 'var(--shadow-light), var(--shadow-dark)', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-color)', marginBottom: '15px' }}>
              <Shield size={32} />
            </div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Super Admin Portal</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '6px' }}>
              Enter master credentials to manage print shops & subscriptions
            </p>
          </div>

          {adminLoginError && (
            <div className="neo-card-inset" style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger-color)', fontSize: '0.85rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>{adminLoginError}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin}>
            <div className="neo-input-group">
              <label className="neo-label">Admin Username</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-secondary)' }} />
                <input 
                  type="text" 
                  className="neo-input" 
                  style={{ paddingLeft: '42px' }} 
                  placeholder="Username (e.g. Shashank)" 
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="neo-input-group" style={{ marginBottom: '30px' }}>
              <label className="neo-label">Admin Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-secondary)' }} />
                <input 
                  type="password" 
                  className="neo-input" 
                  style={{ paddingLeft: '42px' }} 
                  placeholder="Enter Password" 
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="neo-btn neo-btn-primary" 
              style={{ width: '100%', padding: '14px', borderRadius: '14px', fontSize: '1rem' }}
              disabled={adminSubmitting}
            >
              {adminSubmitting ? 'Authenticating Admin...' : 'Login to Admin Panel'}
            </button>
          </form>

          <div style={{ marginTop: '25px', textAlign: 'center' }}>
            <button 
              type="button" 
              className="neo-btn" 
              style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '0.85rem' }}
              onClick={() => navigate('/')}
            >
              ← Back to Main Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '30px 20px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header Panel */}
      <div className="neo-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ display: 'flex', width: '50px', height: '50px', borderRadius: '50%', background: 'var(--bg-color)', boxShadow: 'var(--shadow-light), var(--shadow-dark)', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-color)' }}>
            <Printer size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Ultra Access Admin Panel</h1>
            <p style={{ margin: 0, opacity: 0.7, fontSize: '0.9rem' }}>Secure system-level print platform manager</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button 
            className="neo-btn" 
            onClick={() => navigate('/dashboard')} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '12px' }}
          >
            <ArrowLeft size={16} /> Dashboard
          </button>
          <button 
            className="neo-btn" 
            onClick={handleLogout} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '12px', color: 'var(--danger-color)' }}
          >
            <LogOut size={16} /> Log Out
          </button>
        </div>
      </div>

      {/* Stats Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div className="neo-card" style={{ padding: '20px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 10px 0', opacity: 0.7, fontSize: '0.95rem' }}>Total Partners</p>
          <h2 style={{ fontSize: '2rem', margin: 0, fontWeight: '800', color: 'var(--accent-color)' }}>{totalShops}</h2>
        </div>
        <div className="neo-card" style={{ padding: '20px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 10px 0', opacity: 0.7, fontSize: '0.95rem' }}>Active Shops</p>
          <h2 style={{ fontSize: '2rem', margin: 0, fontWeight: '800', color: '#10b981' }}>{activeShops}</h2>
        </div>
        <div className="neo-card" style={{ padding: '20px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 10px 0', opacity: 0.7, fontSize: '0.95rem' }}>Inactive / Expired</p>
          <h2 style={{ fontSize: '2rem', margin: 0, fontWeight: '800', color: 'var(--danger-color)' }}>{inactiveShops}</h2>
        </div>
        <div className="neo-card" style={{ padding: '20px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 10px 0', opacity: 0.7, fontSize: '0.95rem' }}>Est. Setup Revenue</p>
          <h2 style={{ fontSize: '2rem', margin: 0, fontWeight: '800', color: '#f59e0b' }}>₹{totalRevenueEst}</h2>
        </div>
      </div>

      {/* Main Database Table Container */}
      <div className="neo-card" style={{ padding: '30px 25px' }}>
        
        {/* Filters and Search toolbar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '20px', marginBottom: '25px' }}>
          <div className="neo-card-inset" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 15px', borderRadius: '12px', width: '100%', maxWidth: '350px' }}>
            <Search size={18} style={{ opacity: 0.6 }} />
            <input 
              type="text" 
              placeholder="Search shops by name, address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: 'var(--text-color)' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>Filter Status:</span>
            <div className="neo-card-inset" style={{ padding: '5px', borderRadius: '12px', display: 'flex', gap: '5px' }}>
              {['all', 'active', 'inactive', 'expired'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  style={{
                    border: 'none',
                    background: filterStatus === status ? 'var(--bg-color)' : 'transparent',
                    boxShadow: filterStatus === status ? 'var(--shadow-light), var(--shadow-dark)' : 'none',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    color: filterStatus === status ? 'var(--accent-color)' : 'var(--text-color)',
                    textTransform: 'capitalize'
                  }}
                >
                  {status}
                </button>
              ))}
            </div>
            <button 
              className="neo-btn" 
              onClick={fetchShops} 
              style={{ display: 'inline-flex', padding: '10px', borderRadius: '12px' }}
              title="Refresh List"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {error && (
          <div className="neo-card-inset" style={{ padding: '15px', color: 'var(--danger-color)', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderRadius: '12px' }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Database List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ opacity: 0.7 }}>Loading partner registers...</p>
          </div>
        ) : filteredShops.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ opacity: 0.7 }}>No registered shops found matching the filters.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.05)' }}>
                  <th style={{ padding: '15px 10px', fontSize: '0.9rem', opacity: 0.6 }}>Shop Details</th>
                  <th style={{ padding: '15px 10px', fontSize: '0.9rem', opacity: 0.6 }}>Phone Number</th>
                  <th style={{ padding: '15px 10px', fontSize: '0.9rem', opacity: 0.6 }}>Address</th>
                  <th style={{ padding: '15px 10px', fontSize: '0.9rem', opacity: 0.6 }}>Rates</th>
                  <th style={{ padding: '15px 10px', fontSize: '0.9rem', opacity: 0.6 }}>Plan Details</th>
                  <th style={{ padding: '15px 10px', fontSize: '0.9rem', opacity: 0.6 }}>Device Risk</th>
                  <th style={{ padding: '15px 10px', fontSize: '0.9rem', opacity: 0.6 }}>Subscription Expiry</th>
                  <th style={{ padding: '15px 10px', fontSize: '0.9rem', opacity: 0.6 }}>Status</th>
                  <th style={{ padding: '15px 10px', fontSize: '0.9rem', opacity: 0.6, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredShops.map(shop => {
                  const isExpired = shop.subscription_expires_at && new Date(shop.subscription_expires_at) < new Date();
                  const isActive = shop.is_paid === 1 && !isExpired && shop.subscription_status === 'active';

                  return (
                    <tr key={shop.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      <td style={{ padding: '15px 10px' }}>
                        <div style={{ fontWeight: '700', fontSize: '1.05rem' }}>{shop.name}</div>
                        <div style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '2px' }}>ID: {shop.id.substring(0, 8)}...</div>
                      </td>
                      <td style={{ padding: '15px 10px', fontSize: '0.95rem' }}>
                        {shop.phone ? (
                          <a 
                            href={`tel:${shop.phone}`} 
                            style={{ color: 'var(--accent-color)', fontWeight: '700', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            title="Call Partner"
                          >
                            <Phone size={14} />
                            {shop.phone}
                          </a>
                        ) : (
                          <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Not Set</span>
                        )}
                      </td>
                      <td style={{ padding: '15px 10px', fontSize: '0.95rem' }}>{shop.address}</td>
                      <td style={{ padding: '15px 10px', fontSize: '0.95rem' }}>
                        <div>B&W: ₹{shop.bw_rate}</div>
                        <div style={{ opacity: 0.7, fontSize: '0.85rem' }}>Color: ₹{shop.color_rate}</div>
                      </td>
                      <td style={{ padding: '15px 10px', fontSize: '0.95rem' }}>
                        {shop.is_paid === 1 && shop.subscription_status === 'active' 
                          ? (shop.subscription_plan === 'monthly' ? '₹99/mo (Unlimited)' : shop.subscription_plan === 'yearly' ? '₹599/yr (Unlimited)' : 'Paid (Unlimited)')
                          : `Free Trial (${Number(shop.free_prints_used || 0)}/${Number(shop.free_prints_allowed || 10)})`
                        }
                      </td>
                      <td style={{ padding: '15px 10px', fontSize: '0.95rem' }}>{shop.registration_device_risk || 'normal'}</td>
                      <td style={{ padding: '15px 10px', fontSize: '0.95rem' }}>{formatExpiryDate(shop.subscription_expires_at)}</td>
                      <td style={{ padding: '15px 10px' }}>
                        <span style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '6px', 
                          padding: '6px 12px', 
                          borderRadius: '20px', 
                          fontSize: '0.8rem', 
                          fontWeight: '700',
                          background: isActive ? '#e6f7ed' : isExpired ? '#fff3e6' : '#ffebe6',
                          color: isActive ? '#10b981' : isExpired ? '#f59e0b' : 'var(--danger-color)'
                        }}>
                          {isActive ? <CheckCircle2 size={12} /> : isExpired ? <Calendar size={12} /> : <XCircle size={12} />}
                          {isActive ? 'Active' : isExpired ? 'Expired' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '15px 10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                          <button
                            onClick={() => handleToggleStatus(shop)}
                            className="neo-btn"
                            style={{ 
                              padding: '8px', 
                              borderRadius: '8px', 
                              color: isActive ? 'var(--danger-color)' : '#10b981' 
                            }}
                            title={isActive ? 'Deactivate Shop' : 'Activate Shop'}
                          >
                            <Power size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setRenewingShop(shop);
                              setShowRenewModal(true);
                            }}
                            className="neo-btn"
                            style={{ padding: '8px', borderRadius: '8px', color: '#f59e0b' }}
                            title="Renew / Extend Subscription"
                          >
                            <Calendar size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingShop(shop);
                              setShowEditModal(true);
                            }}
                            className="neo-btn"
                            style={{ padding: '8px', borderRadius: '8px', color: 'var(--accent-color)' }}
                            title="Edit Details"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(shop)}
                            className="neo-btn"
                            style={{ padding: '8px', borderRadius: '8px', color: 'var(--danger-color)' }}
                            title="Delete Shop"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Shop Modal */}
      {showEditModal && editingShop && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="neo-card" style={{ width: '100%', maxWidth: '500px', padding: '30px' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '1.25rem', fontWeight: '800' }}>Edit Shop Details</h3>
            <form onSubmit={handleSaveDetails}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: '600' }}>Shop Name</label>
                <div className="neo-card-inset" style={{ padding: '10px 15px', borderRadius: '12px' }}>
                  <input 
                    type="text" 
                    value={editingShop.name} 
                    onChange={e => setEditingShop({ ...editingShop, name: e.target.value })}
                    required
                    style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: 'var(--text-color)' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: '600' }}>Phone Number</label>
                <div className="neo-card-inset" style={{ padding: '10px 15px', borderRadius: '12px' }}>
                  <input 
                    type="text" 
                    value={editingShop.phone || ''} 
                    onChange={e => setEditingShop({ ...editingShop, phone: e.target.value })}
                    placeholder="e.g. 9483030043"
                    style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: 'var(--text-color)' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: '600' }}>Shop Address</label>
                <div className="neo-card-inset" style={{ padding: '10px 15px', borderRadius: '12px' }}>
                  <input 
                    type="text" 
                    value={editingShop.address} 
                    onChange={e => setEditingShop({ ...editingShop, address: e.target.value })}
                    required
                    style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: 'var(--text-color)' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: '600' }}>New Password (Leave empty to keep current)</label>
                <div className="neo-card-inset" style={{ padding: '10px 15px', borderRadius: '12px' }}>
                  <input 
                    type="password" 
                    value={editingShop.newPassword || ''} 
                    onChange={e => setEditingShop({ ...editingShop, newPassword: e.target.value })}
                    placeholder="Enter new password"
                    style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: 'var(--text-color)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: '600' }}>B&W Rate (₹/page)</label>
                  <div className="neo-card-inset" style={{ padding: '10px 15px', borderRadius: '12px' }}>
                    <input 
                      type="number" 
                      step="0.1"
                      value={editingShop.bw_rate} 
                      onChange={e => setEditingShop({ ...editingShop, bw_rate: e.target.value })}
                      required
                      style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: 'var(--text-color)' }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: '600' }}>Color Rate (₹/page)</label>
                  <div className="neo-card-inset" style={{ padding: '10px 15px', borderRadius: '12px' }}>
                    <input 
                      type="number" 
                      step="0.1"
                      value={editingShop.color_rate} 
                      onChange={e => setEditingShop({ ...editingShop, color_rate: e.target.value })}
                      required
                      style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: 'var(--text-color)' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end' }}>
                <button type="button" className="neo-btn" onClick={() => setShowEditModal(false)} style={{ padding: '10px 20px', borderRadius: '12px' }}>
                  Cancel
                </button>
                <button type="submit" className="neo-btn" style={{ padding: '10px 20px', borderRadius: '12px', color: 'var(--accent-color)' }}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renew Subscription Modal */}
      {showRenewModal && renewingShop && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="neo-card" style={{ width: '100%', maxWidth: '400px', padding: '30px' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '1.25rem', fontWeight: '800' }}>Renew Subscription</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.95rem', opacity: 0.8 }}>
              Extend the subscription period for <strong>{renewingShop.name}</strong>.
            </p>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '600' }}>Renewal Period</label>
              <div className="neo-card-inset" style={{ padding: '5px', borderRadius: '12px', display: 'flex', gap: '5px' }}>
                {[
                  { label: '30 Days', value: '30' },
                  { label: '90 Days', value: '90' },
                  { label: '1 Year', value: '365' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRenewalDays(opt.value)}
                    style={{
                      border: 'none',
                      flex: 1,
                      background: renewalDays === opt.value ? 'var(--bg-color)' : 'transparent',
                      boxShadow: renewalDays === opt.value ? 'var(--shadow-light), var(--shadow-dark)' : 'none',
                      padding: '8px 0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      color: renewalDays === opt.value ? 'var(--accent-color)' : 'var(--text-color)'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end' }}>
              <button className="neo-btn" onClick={() => setShowRenewModal(false)} style={{ padding: '10px 20px', borderRadius: '12px' }}>
                Cancel
              </button>
              <button className="neo-btn" onClick={handleRenewSubscription} style={{ padding: '10px 20px', borderRadius: '12px', color: '#f59e0b' }}>
                Confirm Renewal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="neo-card" style={{ width: '100%', maxWidth: '400px', padding: '30px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--danger-color)', marginBottom: '15px' }}>
              <AlertTriangle size={24} />
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800' }}>Confirm Deletion</h3>
            </div>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.95rem', opacity: 0.8, lineHeight: '1.5' }}>
              Are you sure you want to delete the shop <strong>{showDeleteConfirm.name}</strong>?<br />
              <span style={{ color: 'var(--danger-color)', fontWeight: '600' }}>This action is permanent and deletes all associated orders.</span>
            </p>
            
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end' }}>
              <button className="neo-btn" onClick={() => setShowDeleteConfirm(null)} style={{ padding: '10px 20px', borderRadius: '12px' }}>
                Cancel
              </button>
              <button className="neo-btn" onClick={handleDeleteShop} style={{ padding: '10px 20px', borderRadius: '12px', color: 'white', background: 'var(--danger-color)' }}>
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Admin;
