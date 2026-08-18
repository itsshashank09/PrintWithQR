import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Printer, Shield, QrCode, Monitor, Check, ArrowRight, DollarSign, 
  Zap, FileText, Instagram, PhoneCall, Smartphone, Lock, Volume2, 
  Sparkles, CheckCircle2 
} from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();
  
  // Hero Interactive View State
  const [heroTab, setHeroTab] = useState('customer'); // 'customer' | 'shop' | 'stand'

  return (
    <div className="neo-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header Bar */}
      <header className="neo-header" style={{ marginBottom: '40px', flexWrap: 'wrap', gap: '15px' }}>
        {/* Top Left Corner: Clickable Instagram Button */}
        <a 
          href="https://www.instagram.com/_its.shashank" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="neo-btn"
          style={{ padding: '8px 16px', fontSize: '0.85rem', gap: '8px', borderRadius: 'var(--radius-sm)' }}
          title="Visit Instagram Profile @_its.shashank"
        >
          <Instagram size={18} style={{ color: 'var(--accent)' }} />
          <span>Created By <strong>_its.shashank</strong></span>
        </a>

        {/* Center: Brand Logo */}
        <div className="logo-container" onClick={() => navigate('/home')} style={{ cursor: 'pointer' }}>
          <Printer size={28} style={{ color: 'var(--accent)' }} />
          <span className="logo-text">PrintWithQR.in</span>
        </div>

        {/* Top Right Corner: Clickable Phone Call Button & Auth Nav */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <a 
            href="tel:+919483030043" 
            className="neo-btn"
            style={{ padding: '8px 16px', fontSize: '0.85rem', gap: '8px', borderRadius: 'var(--radius-sm)' }}
            title="Call +919483030043"
          >
            <PhoneCall size={16} style={{ color: 'var(--accent)' }} />
            <span>+919483030043</span>
          </a>
          <button className="neo-btn" onClick={() => navigate('/login')}>Login</button>
          <button className="neo-btn neo-btn-primary" onClick={() => navigate('/register')}>Register Shop</button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '60px' }}>
        
        {/* HERO SECTION */}
        <section style={{ display: 'flex', flexWrap: 'wrap', gap: '40px', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
          
          {/* Hero Text Content */}
          <div style={{ flex: '1 1 450px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="neo-card-inset" style={{ display: 'inline-flex', alignSelf: 'flex-start', padding: '8px 16px', borderRadius: '30px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)', gap: '8px', alignItems: 'center', margin: 0 }}>
              <Zap size={15} /> ZERO-SETUP QR CHECKOUT FOR XEROX SHOPS
            </div>
            
            <h1>
              Connect Customers Directly <br />
              to Your Printer <span style={{ color: 'var(--accent)' }}>via QR</span>
            </h1>
            
            <p style={{ fontSize: '1.1rem' }}>
              Let customers upload files, preview documents, select print options, and checkout in 3 steps from their mobile browser. No app installs, no WhatsApp chat clutter, no manual file sharing.
            </p>
            
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '10px' }}>
              <button 
                className="neo-btn neo-btn-primary" 
                style={{ padding: '14px 32px', fontSize: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '10px' }} 
                onClick={() => navigate('/register')}
              >
                Start Free Trial <ArrowRight size={18} />
              </button>
              <button 
                className="neo-btn" 
                style={{ padding: '14px 28px', fontSize: '1rem', borderRadius: 'var(--radius-md)' }} 
                onClick={() => navigate('/login')}
              >
                Partner Log In
              </button>
            </div>
          </div>

          {/* Creative Interactive Ecosystem Showcase (Hero Right) */}
          <div style={{ flex: '1 1 420px', display: 'flex', justifyContent: 'center', position: 'relative' }}>
            
            {/* Main Interactive Neumorphic Card */}
            <div className="neo-card" style={{ width: '100%', maxWidth: '440px', padding: '24px', position: 'relative', overflow: 'visible', margin: 0 }}>
              
              {/* Floating Badge Top Right */}
              <div style={{ position: 'absolute', top: '-14px', right: '-10px', padding: '6px 14px', borderRadius: '20px', background: 'var(--bg)', border: '1px solid var(--accent)', color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', boxShadow: 'var(--shadow-extrude-sm)', zIndex: 10 }}>
                <Zap size={14} /> &lt; 2s Direct Route
              </div>

              {/* Top View Selector Tabs */}
              <div className="neo-tabs" style={{ marginBottom: '20px' }}>
                <div 
                  className={`neo-tab ${heroTab === 'customer' ? 'active' : ''}`}
                  onClick={() => setHeroTab('customer')}
                >
                  <Smartphone size={14} style={{ marginRight: '6px' }} /> 1. Upload
                </div>
                <div 
                  className={`neo-tab ${heroTab === 'shop' ? 'active' : ''}`}
                  onClick={() => setHeroTab('shop')}
                >
                  <Monitor size={14} style={{ marginRight: '6px' }} /> 2. Queue
                </div>
                <div 
                  className={`neo-tab ${heroTab === 'stand' ? 'active' : ''}`}
                  onClick={() => setHeroTab('stand')}
                >
                  <QrCode size={14} style={{ marginRight: '6px' }} /> 3. QR Stand
                </div>
              </div>

              {/* Dynamic View Content */}
              {heroTab === 'customer' && (
                <div className="step-enter" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Phone Header simulation */}
                  <div className="neo-card-inset" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderRadius: 'var(--radius-sm)', margin: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      <Lock size={13} style={{ color: 'var(--accent)' }} />
                      <span>printwithqr.in/shop/demo_xerox</span>
                    </div>
                    <span className="neo-badge status-completed" style={{ padding: '2px 8px', fontSize: '0.7rem' }}>LIVE</span>
                  </div>

                  {/* Document Card */}
                  <div className="neo-card-inset" style={{ padding: '16px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '10px', margin: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileText size={20} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>Final_Exam_Notes.pdf</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>18 Pages • Auto-Counted</div>
                        </div>
                      </div>
                      <span style={{ fontWeight: 800, color: 'var(--accent)', fontSize: '1rem' }}>₹36</span>
                    </div>

                    {/* Mode selection badge */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <span className="neo-btn neo-btn-primary" style={{ flex: 1, padding: '6px', fontSize: '0.75rem', minHeight: '34px' }}>B&W (₹2/pg)</span>
                      <span className="neo-btn" style={{ flex: 1, padding: '6px', fontSize: '0.75rem', minHeight: '34px', opacity: 0.8 }}>Double Sided</span>
                    </div>
                  </div>

                  {/* Print Submission Trigger */}
                  <button className="neo-btn neo-btn-primary" style={{ padding: '14px', width: '100%', fontSize: '0.92rem' }} onClick={() => setHeroTab('shop')}>
                    <Printer size={18} /> Send File to Counter Printer <ArrowRight size={16} />
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <CheckCircle2 size={14} style={{ color: 'var(--success)' }} /> Customer pays ₹36 cash/UPI at pickup
                  </div>
                </div>
              )}

              {heroTab === 'shop' && (
                <div className="step-enter" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  <div className="neo-card-inset" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderRadius: 'var(--radius-sm)', margin: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent)' }}>
                      <Volume2 size={15} />
                      <span>Audio Notification Active</span>
                    </div>
                    <span className="neo-badge status-printing" style={{ padding: '2px 8px', fontSize: '0.7rem' }}>REALTIME</span>
                  </div>

                  {/* Incoming Job Queue Card */}
                  <div className="neo-card-inset" style={{ padding: '16px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '3px solid var(--accent)', margin: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>JOB #8492 • JUST NOW</span>
                      <span className="neo-badge status-pending" style={{ padding: '2px 8px', fontSize: '0.7rem' }}>⚡ IN QUEUE</span>
                    </div>

                    <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Final_Exam_Notes.pdf</div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '6px 10px', background: 'var(--accent-light)', borderRadius: '8px' }}>
                      <span>18 Pages (B&W A4)</span>
                      <strong style={{ color: 'var(--text-primary)' }}>Collect ₹36</strong>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="neo-btn neo-btn-primary" style={{ flex: 1, padding: '10px', fontSize: '0.82rem' }}>
                        <Printer size={15} /> Print Now
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <Shield size={14} style={{ color: 'var(--accent)' }} /> File auto-purges from storage in 5 minutes
                  </div>
                </div>
              )}

              {heroTab === 'stand' && (
                <div className="step-enter" style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center' }}>
                  
                  {/* Acrylic Stand Header */}
                  <div className="neo-card-inset" style={{ width: '100%', padding: '16px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', position: 'relative', overflow: 'hidden', margin: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>Shashank Xerox & DTP Center</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Scan QR Code to Upload & Print Documents</div>

                    {/* QR Code Container */}
                    <div style={{ position: 'relative', width: '140px', height: '140px', background: '#FFFFFF', padding: '10px', borderRadius: '16px', boxShadow: 'var(--shadow-extrude-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <QrCode size={120} style={{ color: '#111111' }} />
                    </div>

                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Sparkles size={14} /> Instant Camera Scan • No WhatsApp Needed
                    </div>
                  </div>

                </div>
              )}

              {/* Bottom Floating Privacy Badge */}
              <div style={{ position: 'absolute', bottom: '-14px', left: '-10px', padding: '6px 14px', borderRadius: '20px', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', boxShadow: 'var(--shadow-extrude-sm)', zIndex: 10, margin: 0 }}>
                <Shield size={14} style={{ color: 'var(--accent)' }} /> 100% Private 5-Min Storage Purge
              </div>

            </div>
          </div>

        </section>

        {/* HERO HIGHLIGHTS STRIP */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '18px', width: '100%' }}>
          
          <div className="neo-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px', margin: 0 }}>
            <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Smartphone size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>100% App-Free</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Works in Chrome & Safari</div>
            </div>
          </div>

          <div className="neo-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px', margin: 0 }}>
            <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Zap size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>No WhatsApp Clutter</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>No phone numbers saved</div>
            </div>
          </div>

          <div className="neo-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px', margin: 0 }}>
            <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Shield size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>5-Min Data Purge</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Automatic document wipe</div>
            </div>
          </div>

          <div className="neo-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px', margin: 0 }}>
            <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <DollarSign size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Zero Commission</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Keep 100% print earnings</div>
            </div>
          </div>

        </div>

        {/* HOW IT WORKS SECTION */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '8px' }}>How It Works</h2>
            <p>Streamline your checkout flow into 3 simple, automated steps.</p>
          </div>

          <div className="neo-grid">
            
            <div className="neo-card" style={{ padding: '32px 24px', textAlign: 'center', margin: 0 }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--bg)', boxShadow: 'var(--shadow-extrude-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', color: 'var(--accent)', fontWeight: 800, fontSize: '1.3rem', border: '1px solid var(--accent-border)' }}>
                1
              </div>
              <h3 style={{ marginBottom: '10px' }}>Scan QR Code</h3>
              <p style={{ fontSize: '0.9rem' }}>
                Customers enter your shop and scan the QR code printed at your counter. It instantly redirects them to your private checkout page on their mobile web browser.
              </p>
            </div>

            <div className="neo-card" style={{ padding: '32px 24px', textAlign: 'center', margin: 0 }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--bg)', boxShadow: 'var(--shadow-extrude-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', color: 'var(--accent)', fontWeight: 800, fontSize: '1.3rem', border: '1px solid var(--accent-border)' }}>
                2
              </div>
              <h3 style={{ marginBottom: '10px' }}>Upload & Configure</h3>
              <p style={{ fontSize: '0.9rem' }}>
                They drag-and-drop their files (PDFs, Images), inspect the document print preview, choose color/duplex settings, see the auto-calculated price, and place the order.
              </p>
            </div>

            <div className="neo-card" style={{ padding: '32px 24px', textAlign: 'center', margin: 0 }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--bg)', boxShadow: 'var(--shadow-extrude-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', color: 'var(--accent)', fontWeight: 800, fontSize: '1.3rem', border: '1px solid var(--accent-border)' }}>
                3
              </div>
              <h3 style={{ marginBottom: '10px' }}>Instantly Print</h3>
              <p style={{ fontSize: '0.9rem' }}>
                The job pops up in real-time on your dashboard queue. Hit "Print" to route it straight to your connected system printer, collect cash, and deliver.
              </p>
            </div>

          </div>
        </section>

        {/* WHY CHOOSE QRPRINT SECTION */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '8px' }}>Why Print Shops Love QRPrint</h2>
            <p>Designed specifically for Indian Xerox centers, DTP hubs, and cyber cafes.</p>
          </div>

          <div className="neo-grid">
            
            <div className="neo-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '14px', margin: 0 }}>
              <div style={{ display: 'inline-flex', width: '44px', height: '44px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-light)', color: 'var(--accent)', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={22} />
              </div>
              <h3 style={{ margin: 0 }}>Zero WhatsApp Clutter</h3>
              <p style={{ fontSize: '0.9rem', margin: 0 }}>
                Never save unknown customer phone numbers again just to receive a 2-page print file. Customers scan your counter QR and upload directly.
              </p>
            </div>

            <div className="neo-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '14px', margin: 0 }}>
              <div style={{ display: 'inline-flex', width: '44px', height: '44px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-light)', color: 'var(--accent)', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={22} />
              </div>
              <h3 style={{ margin: 0 }}>5-Minute Privacy Purge</h3>
              <p style={{ fontSize: '0.9rem', margin: 0 }}>
                Customer documents (Aadhaar, Marksheets, Contracts) are automatically deleted from server storage 5 minutes after upload for 100% privacy compliance.
              </p>
            </div>

            <div className="neo-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '14px', margin: 0 }}>
              <div style={{ display: 'inline-flex', width: '44px', height: '44px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-light)', color: 'var(--accent)', alignItems: 'center', justifyContent: 'center' }}>
                <Monitor size={22} />
              </div>
              <h3 style={{ margin: 0 }}>Live Audio & Realtime Queue</h3>
              <p style={{ fontSize: '0.9rem', margin: 0 }}>
                Your dashboard updates in real-time with an instant chime whenever a new order arrives. Route to your printer with a single click.
              </p>
            </div>

            <div className="neo-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '14px', margin: 0 }}>
              <div style={{ display: 'inline-flex', width: '44px', height: '44px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-light)', color: 'var(--accent)', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={22} />
              </div>
              <h3 style={{ margin: 0 }}>Custom B&W & Color Pricing</h3>
              <p style={{ fontSize: '0.9rem', margin: 0 }}>
                You control your rates per page. Set your B&W and Color rates, paper size options (A4), and double-sided (duplex) rules in your settings.
              </p>
            </div>

          </div>
        </section>

        {/* PRICING PLANS SECTION */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '8px' }}>Simple, Commission-Free Pricing</h2>
            <p>No hidden charges. Keep 100% of the money you make printing.</p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '28px', justifyContent: 'center', maxWidth: '850px', margin: '0 auto', width: '100%' }}>
            
            {/* Monthly Card */}
            <div className="neo-card" style={{ flex: '1 1 300px', padding: '36px 28px', display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: '380px', margin: 0 }}>
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Monthly Subscription</span>
                <div style={{ display: 'flex', alignItems: 'baseline', marginTop: '10px', gap: '4px' }}>
                  <span style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>₹99</span>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>/ month</span>
                </div>
                <p style={{ fontSize: '0.85rem', marginTop: '8px' }}>
                  Great for shops looking to test the waters and automate checkout.
                </p>
              </div>

              <div className="neo-card-inset" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', margin: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}>
                  <Check size={16} style={{ color: 'var(--success)' }} />
                  <span>Custom Shop QR Code</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}>
                  <Check size={16} style={{ color: 'var(--success)' }} />
                  <span>Real-time Dashboard Queue</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}>
                  <Check size={16} style={{ color: 'var(--success)' }} />
                  <span>Print Previews & Settings</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}>
                  <Check size={16} style={{ color: 'var(--success)' }} />
                  <span>Unlimited Submissions</span>
                </div>
              </div>

              <button className="neo-btn" style={{ width: '100%', padding: '14px', marginTop: 'auto' }} onClick={() => navigate('/register')}>
                Select Monthly
              </button>
            </div>

            {/* Yearly Card (Recommended) */}
            <div className="neo-card" style={{ flex: '1 1 300px', padding: '36px 28px', position: 'relative', display: 'flex', flexDirection: 'column', gap: '22px', border: '1px solid var(--accent)', maxWidth: '380px', margin: 0 }}>
              
              {/* Promo Badge */}
              <div style={{ position: 'absolute', top: '-14px', right: '20px', background: 'var(--bg)', color: 'var(--accent)', border: '1px solid var(--accent)', padding: '4px 14px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 800, boxShadow: 'var(--shadow-extrude-sm)' }}>
                ★ 50% OFF ANNUAL
              </div>

              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' }}>Annual Subscription</span>
                <div style={{ display: 'flex', alignItems: 'baseline', marginTop: '10px', gap: '4px' }}>
                  <span style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--accent)' }}>₹599</span>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>/ year</span>
                </div>
                <p style={{ fontSize: '0.85rem', marginTop: '8px' }}>
                  Best value for established Xerox & cyber cafe businesses.
                </p>
              </div>

              <div className="neo-card-inset" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', margin: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', fontWeight: 600 }}>
                  <Check size={16} style={{ color: 'var(--success)' }} />
                  <span>Everything in Monthly Plan</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}>
                  <Check size={16} style={{ color: 'var(--success)' }} />
                  <span>Save ₹589 (Get 6 months free)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}>
                  <Check size={16} style={{ color: 'var(--success)' }} />
                  <span>No monthly payment hassles</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}>
                  <Check size={16} style={{ color: 'var(--success)' }} />
                  <span>Priority installation support</span>
                </div>
              </div>

              <button className="neo-btn neo-btn-primary" style={{ width: '100%', padding: '14px', marginTop: 'auto' }} onClick={() => navigate('/register')}>
                Select Annual Plan
              </button>
            </div>

          </div>
        </section>

        {/* FREQUENTLY ASKED QUESTIONS (FAQ) SECTION */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '8px' }}>Frequently Asked Questions</h2>
            <p>Everything you need to know about setting up QRPrint at your counter.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
            
            <div className="neo-card" style={{ padding: '22px 26px', margin: 0 }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--accent)' }}>
                Q: Do customers need to install an app to send files?
              </h3>
              <p style={{ fontSize: '0.92rem', margin: 0 }}>
                No app installation is required! Customers simply open their smartphone camera, scan your counter QR code, and your upload page opens instantly in their browser (Chrome, Safari, Edge, etc.).
              </p>
            </div>

            <div className="neo-card" style={{ padding: '22px 26px', margin: 0 }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--accent)' }}>
                Q: How does document privacy work?
              </h3>
              <p style={{ fontSize: '0.92rem', margin: 0 }}>
                We prioritize user privacy. All uploaded documents (PDFs, images) are automatically deleted from server storage 5 minutes after submission, ensuring private customer records stay confidential.
              </p>
            </div>

            <div className="neo-card" style={{ padding: '22px 26px', margin: 0 }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--accent)' }}>
                Q: Can I set my own printing rates?
              </h3>
              <p style={{ fontSize: '0.92rem', margin: 0 }}>
                Yes! From your Shop Profile dashboard, you can adjust your per-page Black & White rate (e.g. ₹2/pg or ₹5/pg) and Color rate (e.g. ₹10/pg). The customer checkout page automatically calculates the bill based on your custom rates.
              </p>
            </div>

            <div className="neo-card" style={{ padding: '22px 26px', margin: 0 }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--accent)' }}>
                Q: How do customers pay for prints?
              </h3>
              <p style={{ fontSize: '0.92rem', margin: 0 }}>
                Customers pay you directly at your shop counter (via Cash or your shop's existing PhonePe / GooglePay / Paytm UPI QR code) when they pick up their physical printed document.
              </p>
            </div>

          </div>
        </section>

      </main>

      {/* Footer */}
      <footer style={{ textAlign: 'center', marginTop: '60px', padding: '30px 0', borderTop: '1px solid rgba(163, 177, 198, 0.2)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        <p style={{ margin: '0 0 8px 0' }}>&copy; {new Date().getFullYear()} PrintWithQR.in. All rights reserved. Built for modern Xerox & print shops in India.</p>
        <p style={{ fontSize: '0.85rem', opacity: 0.85, margin: 0 }}>Created & Managed by <strong>Shashank Madiwal</strong> (Contact: +919483030043)</p>
      </footer>
    </div>
  );
};

export default Landing;
