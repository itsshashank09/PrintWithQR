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
    <div className="neo-container" style={{ padding: '30px 15px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header Bar */}
      <header className="neo-header" style={{ marginBottom: '40px', flexWrap: 'wrap', gap: '15px' }}>
        {/* Top Left Corner: Clickable Instagram Button with Glimmer Effect */}
        <a 
          href="https://www.instagram.com/_its.shashank" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="instagram-glimmer-btn"
          title="Visit Instagram Profile @_its.shashank"
        >
          <div className="instagram-icon-badge">
            <Instagram size={18} />
          </div>
          <span style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
            <span style={{ opacity: 0.85, fontWeight: 500, fontSize: '0.85rem' }}>Created By</span>
            <strong>_its.shashank</strong>
          </span>
        </a>

        {/* Center: Brand Logo */}
        <div className="logo-container" onClick={() => navigate('/home')} style={{ cursor: 'pointer' }}>
          <Printer size={28} className="neo-upload-icon" style={{ animation: 'none', color: 'var(--accent-color)' }} />
          <span className="logo-text" style={{ fontWeight: 800, letterSpacing: '-0.5px' }}>QRPrintPlatform</span>
        </div>

        {/* Top Right Corner: Clickable Phone Call Button & Auth Nav */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <a 
            href="tel:+919483030043" 
            className="contact-call-btn"
            title="Call +919483030043"
          >
            <div className="phone-icon-badge">
              <PhoneCall size={16} />
            </div>
            <span>+919483030043</span>
          </a>
          <button className="neo-btn" onClick={() => navigate('/login')} style={{ borderRadius: '12px', padding: '10px 18px' }}>Login</button>
          <button className="neo-btn neo-btn-primary" onClick={() => navigate('/register')} style={{ borderRadius: '12px', padding: '10px 18px' }}>Register Shop</button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '60px' }}>
        
        {/* HERO SECTION */}
        <section style={{ display: 'flex', flexWrap: 'wrap', gap: '40px', alignItems: 'center', justifyContent: 'space-between', padding: '20px 0' }}>
          
          {/* Hero Text Content */}
          <div style={{ flex: '1 1 450px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="neo-card-inset" style={{ display: 'inline-flex', alignSelf: 'flex-start', padding: '8px 16px', borderRadius: '30px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-color)', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
              <Zap size={14} /> ZERO-SETUP QR CHECKOUT FOR XEROX SHOPS
            </div>
            
            <h1 style={{ fontSize: '3rem', lineHeight: '1.15', fontWeight: 800, margin: 0, letterSpacing: '-1px' }}>
              Connect Customers Directly <br />
              to Your Printer <span style={{ color: 'var(--accent-color)' }}>via QR</span>
            </h1>
            
            <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
              Let customers upload files, preview documents, select print options, and checkout in 3 steps from their mobile browser. No app installs, no WhatsApp chat clutter, no manual file sharing.
            </p>
            
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '10px' }}>
              <button 
                className="neo-btn neo-btn-primary" 
                style={{ padding: '16px 36px', fontSize: '1.05rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '10px' }} 
                onClick={() => navigate('/register')}
              >
                Start Free Trial <ArrowRight size={18} />
              </button>
              <button 
                className="neo-btn" 
                style={{ padding: '16px 30px', fontSize: '1.05rem', borderRadius: '16px' }} 
                onClick={() => navigate('/login')}
              >
                Partner Log In
              </button>
            </div>
          </div>

          {/* Creative Interactive Ecosystem Showcase (Hero Right) */}
          <div style={{ flex: '1 1 420px', display: 'flex', justifyContent: 'center', position: 'relative' }}>
            
            {/* Main Interactive Glass Card */}
            <div className="neo-card" style={{ width: '100%', maxWidth: '440px', padding: '24px', position: 'relative', overflow: 'visible', border: '1px solid rgba(0, 135, 30, 0.25)', boxShadow: '0 12px 40px rgba(0,0,0,0.15), 0 0 20px rgba(0,135,30,0.15)' }}>
              
              {/* Floating Badge Top Right */}
              <div className="showcase-float-badge neo-card-inset" style={{ position: 'absolute', top: '-18px', right: '-12px', padding: '6px 14px', borderRadius: '20px', background: 'var(--accent-gradient)', color: '#ffffff', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 15px rgba(0,135,30,0.4)', zIndex: 10 }}>
                <Zap size={14} /> &lt; 2s Direct Route
              </div>

              {/* Top View Selector Tabs */}
              <div className="neo-tabs" style={{ padding: '4px', height: '44px', borderRadius: '14px', marginBottom: '20px' }}>
                <div 
                  className={`neo-tab ${heroTab === 'customer' ? 'active' : ''}`}
                  onClick={() => setHeroTab('customer')}
                  style={{ fontSize: '0.75rem', fontWeight: 700, gap: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Smartphone size={14} /> 1. Customer Upload
                </div>
                <div 
                  className={`neo-tab ${heroTab === 'shop' ? 'active' : ''}`}
                  onClick={() => setHeroTab('shop')}
                  style={{ fontSize: '0.75rem', fontWeight: 700, gap: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Monitor size={14} /> 2. Print Queue
                </div>
                <div 
                  className={`neo-tab ${heroTab === 'stand' ? 'active' : ''}`}
                  onClick={() => setHeroTab('stand')}
                  style={{ fontSize: '0.75rem', fontWeight: 700, gap: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <QrCode size={14} /> 3. QR Stand
                </div>
              </div>

              {/* Dynamic View Content */}
              {heroTab === 'customer' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Phone Header simulation */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderRadius: '12px', background: 'rgba(0, 135, 30, 0.08)', border: '1px solid rgba(0, 135, 30, 0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-color)' }}>
                      <Lock size={12} style={{ color: 'var(--accent-color)' }} />
                      <span>printwithqr.in/shop/shashank_xerox</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '8px', background: 'var(--accent-color)', color: '#fff', fontWeight: 800 }}>LIVE</span>
                  </div>

                  {/* Document Card */}
                  <div className="neo-card-inset" style={{ padding: '16px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255,255,255,0.03)', margin: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(0, 135, 30, 0.15)', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileText size={20} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>Final_Exam_Notes.pdf</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>18 Pages • Auto-Counted</div>
                        </div>
                      </div>
                      <span style={{ fontWeight: 800, color: 'var(--accent-color)', fontSize: '0.9rem' }}>₹36</span>
                    </div>

                    {/* Mode selection badge */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <span style={{ flex: 1, padding: '6px', borderRadius: '8px', background: 'var(--accent-color)', color: '#fff', fontSize: '0.72rem', fontWeight: 700, textAlign: 'center' }}>Black & White (₹2/pg)</span>
                      <span style={{ flex: 1, padding: '6px', borderRadius: '8px', background: 'rgba(0,0,0,0.05)', fontSize: '0.72rem', fontWeight: 600, textAlign: 'center', opacity: 0.7 }}>Double Sided</span>
                    </div>
                  </div>

                  {/* Print Submission Trigger */}
                  <div style={{ padding: '14px', borderRadius: '14px', background: 'var(--accent-gradient)', color: '#ffffff', textAlign: 'center', fontWeight: 800, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 6px 20px rgba(0, 135, 30, 0.3)', cursor: 'pointer' }} onClick={() => setHeroTab('shop')}>
                    <Printer size={18} /> Send File to Counter Printer <ArrowRight size={16} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                    <CheckCircle2 size={13} style={{ color: 'var(--accent-color)' }} /> Customer pays ₹36 cash/UPI at pickup
                  </div>
                </div>
              )}

              {heroTab === 'shop' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-color)' }}>
                      <Volume2 size={15} />
                      <span>Audio Notification Active</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '8px', background: '#10b981', color: '#fff', fontWeight: 800 }}>REALTIME</span>
                  </div>

                  {/* Incoming Job Queue Card */}
                  <div className="neo-card-inset" style={{ padding: '16px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '4px solid var(--accent-color)', margin: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>JOB #8492 • JUST NOW</span>
                      <span style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: '10px', background: 'rgba(0,135,30,0.15)', color: 'var(--accent-color)', fontWeight: 800 }}>⚡ PRINTING</span>
                    </div>

                    <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>Final_Exam_Notes.pdf</div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '6px 10px', background: 'rgba(0,0,0,0.03)', borderRadius: '8px' }}>
                      <span>18 Pages (B&W A4)</span>
                      <strong style={{ color: 'var(--text-color)' }}>Collect ₹36</strong>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: 'var(--accent-gradient)', color: '#fff', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <Printer size={15} /> Print Now
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                    <Shield size={13} style={{ color: 'var(--accent-color)' }} /> File auto-purges from storage in 5 minutes
                  </div>
                </div>
              )}

              {heroTab === 'stand' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center' }}>
                  
                  {/* Acrylic Stand Header */}
                  <div className="neo-card-inset" style={{ width: '100%', padding: '16px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', position: 'relative', overflow: 'hidden', margin: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-color)' }}>Shashank Xerox & DTP Center</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Scan QR Code to Upload & Print Documents</div>

                    {/* QR Code Container with Scanning Laser Line */}
                    <div style={{ position: 'relative', width: '140px', height: '140px', background: '#ffffff', padding: '10px', borderRadius: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <QrCode size={120} style={{ color: '#111111' }} />
                      <div className="showcase-laser-line"></div>
                    </div>

                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Sparkles size={14} /> Instant Camera Scan • No WhatsApp Needed
                    </div>
                  </div>

                </div>
              )}

              {/* Bottom Floating Privacy Badge */}
              <div className="showcase-float-badge neo-card-inset" style={{ position: 'absolute', bottom: '-20px', left: '-12px', padding: '6px 14px', borderRadius: '20px', background: 'var(--bg-color)', color: 'var(--text-color)', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', boxShadow: 'var(--shadow-light), var(--shadow-dark)', zIndex: 10, border: '1px solid var(--border-color)', margin: 0 }}>
                <Shield size={14} style={{ color: 'var(--accent-color)' }} /> 100% Private 5-Min Storage Purge
              </div>

            </div>
          </div>

        </section>

        {/* HERO HIGHLIGHTS STRIP */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '18px', width: '100%' }}>
          
          <div className="neo-card-inset" style={{ padding: '16px 20px', borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '14px', margin: 0 }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(0,135,30,0.12)', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Smartphone size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>100% App-Free</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Works in Chrome & Safari</div>
            </div>
          </div>

          <div className="neo-card-inset" style={{ padding: '16px 20px', borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '14px', margin: 0 }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(16,185,129,0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Zap size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>No WhatsApp Clutter</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>No phone numbers saved</div>
            </div>
          </div>

          <div className="neo-card-inset" style={{ padding: '16px 20px', borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '14px', margin: 0 }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(245,158,11,0.12)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Shield size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>5-Min Data Purge</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Automatic document wipe</div>
            </div>
          </div>

          <div className="neo-card-inset" style={{ padding: '16px 20px', borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '14px', margin: 0 }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(99,102,241,0.12)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <DollarSign size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>Zero Commission</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Keep 100% print earnings</div>
            </div>
          </div>

        </div>

        {/* HOW IT WORKS SECTION */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '10px' }}>How It Works</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Streamline your checkout flow into 3 simple, automated steps.</p>
          </div>

          <div className="neo-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '30px' }}>
            
            <div className="neo-card" style={{ padding: '30px', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-color)', boxShadow: 'var(--shadow-light), var(--shadow-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', color: 'var(--accent-color)', fontWeight: 800, fontSize: '1.2rem' }}>
                1
              </div>
              <h3 style={{ marginBottom: '10px' }}>Scan QR Code</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                Customers enter your shop and scan the QR code printed at your counter. It instantly redirects them to your private checkout page on their mobile web browser.
              </p>
            </div>

            <div className="neo-card" style={{ padding: '30px', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-color)', boxShadow: 'var(--shadow-light), var(--shadow-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', color: 'var(--accent-color)', fontWeight: 800, fontSize: '1.2rem' }}>
                2
              </div>
              <h3 style={{ marginBottom: '10px' }}>Upload & Configure</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                They drag-and-drop their files (PDFs, Images), inspect the document print preview, choose color/duplex settings, see the auto-calculated price, and place the order.
              </p>
            </div>

            <div className="neo-card" style={{ padding: '30px', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-color)', boxShadow: 'var(--shadow-light), var(--shadow-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', color: 'var(--accent-color)', fontWeight: 800, fontSize: '1.2rem' }}>
                3
              </div>
              <h3 style={{ marginBottom: '10px' }}>Instantly Print</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                The job pops up in real-time on your dashboard queue. Hit "Print" to route it straight to your connected system printer, collect cash, and deliver.
              </p>
            </div>

          </div>
        </section>

        {/* WHY CHOOSE QRPRINTPLATFORM SECTION */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '10px' }}>Why Print Shops Love QRPrint</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Designed specifically for Indian Xerox centers, DTP hubs, and cyber cafes.</p>
          </div>

          <div className="neo-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '25px' }}>
            
            <div className="neo-card" style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'inline-flex', width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(0, 135, 30, 0.1)', color: 'var(--accent-color)', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={22} />
              </div>
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Zero WhatsApp Clutter</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                Never save unknown customer phone numbers again just to receive a 2-page print file. Customers scan your counter QR and upload directly.
              </p>
            </div>

            <div className="neo-card" style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'inline-flex', width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={22} />
              </div>
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>5-Minute Privacy Purge</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                Customer documents (Aadhaar, Marksheets, Contracts) are automatically deleted from server storage 5 minutes after upload for 100% privacy compliance.
              </p>
            </div>

            <div className="neo-card" style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'inline-flex', width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', alignItems: 'center', justifyContent: 'center' }}>
                <Monitor size={22} />
              </div>
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Live Audio & Realtime Queue</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                Your dashboard updates in real-time with an instant chime whenever a new order arrives. Route to your printer with a single click.
              </p>
            </div>

            <div className="neo-card" style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'inline-flex', width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={22} />
              </div>
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Custom B&W & Color Pricing</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                You control your rates per page. Set your B&W and Color rates, paper size options (A4), and double-sided (duplex) rules in your settings.
              </p>
            </div>

          </div>
        </section>

        {/* PRICING PLANS SECTION */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '10px' }}>Simple, Commission-Free Pricing</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>No hidden charges. Keep 100% of the money you make printing.</p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '30px', justifyContent: 'center', maxWidth: '850px', margin: '0 auto', width: '100%' }}>
            
            {/* Monthly Card */}
            <div className="neo-card" style={{ flex: '1 1 300px', padding: '40px 30px', position: 'relative', display: 'flex', flexDirection: 'column', gap: '25px', maxWidth: '380px' }}>
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Monthly Subscription</span>
                <div style={{ display: 'flex', alignItems: 'baseline', marginTop: '10px', gap: '4px' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 800 }}>₹99</span>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>/ month</span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '10px' }}>
                  Great for shops looking to test the waters and automate checkout.
                </p>
              </div>

              <div className="neo-card-inset" style={{ padding: '20px', borderRadius: '15px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
                  <Check size={16} style={{ color: 'var(--success-color)' }} />
                  <span>Custom Shop QR Code</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
                  <Check size={16} style={{ color: 'var(--success-color)' }} />
                  <span>Real-time Dashboard Queue</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
                  <Check size={16} style={{ color: 'var(--success-color)' }} />
                  <span>Print Previews & Form Settings</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
                  <Check size={16} style={{ color: 'var(--success-color)' }} />
                  <span>Unlimited Print Submissions</span>
                </div>
              </div>

              <button className="neo-btn" style={{ width: '100%', padding: '14px', borderRadius: '12px', marginTop: 'auto' }} onClick={() => navigate('/register')}>
                Select Monthly
              </button>
            </div>

            {/* Yearly Card (Recommended) */}
            <div className="neo-card" style={{ flex: '1 1 300px', padding: '40px 30px', position: 'relative', display: 'flex', flexDirection: 'column', gap: '25px', border: '2px solid var(--accent-color)', maxWidth: '380px' }}>
              
              {/* Promo Badge */}
              <div style={{ position: 'absolute', top: '-15px', right: '20px', background: 'var(--accent-gradient)', color: '#ffffff', padding: '6px 16px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 800, boxShadow: '0 4px 10px rgba(0,135,30,0.2)' }}>
                ★ 50% OFF ANNUAL
              </div>

              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-color)', textTransform: 'uppercase' }}>Annual Subscription</span>
                <div style={{ display: 'flex', alignItems: 'baseline', marginTop: '10px', gap: '4px' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 800 }}>₹599</span>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>/ year</span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '10px' }}>
                  Best value for established Xerox & cyber cafe businesses.
                </p>
              </div>
              <div className="neo-card-inset" style={{ padding: '20px', borderRadius: '15px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', fontWeight: 600 }}>
                  <Check size={16} style={{ color: 'var(--success-color)' }} />
                  <span>Everything in Monthly Plan</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
                  <Check size={16} style={{ color: 'var(--success-color)' }} />
                  <span>Save ₹589 annually (Get 6 months free)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
                  <Check size={16} style={{ color: 'var(--success-color)' }} />
                  <span>No monthly payment hassles</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
                  <Check size={16} style={{ color: 'var(--success-color)' }} />
                  <span>Priority developer installation help</span>
                </div>
              </div>

              <button className="neo-btn neo-btn-primary" style={{ width: '100%', padding: '14px', borderRadius: '12px', marginTop: 'auto' }} onClick={() => navigate('/register')}>
                Select Annual Plan
              </button>
            </div>

          </div>
        </section>

        {/* FREQUENTLY ASKED QUESTIONS (FAQ) SECTION */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '10px' }}>Frequently Asked Questions</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Everything you need to know about setting up QRPrint at your counter.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
            
            <div className="neo-card" style={{ padding: '20px 25px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--accent-color)' }}>
                Q: Do customers need to install an app to send files?
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.6' }}>
                No app installation is required! Customers simply open their smartphone camera, scan your counter QR code, and your upload page opens instantly in their browser (Chrome, Safari, Edge, etc.).
              </p>
            </div>

            <div className="neo-card" style={{ padding: '20px 25px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--accent-color)' }}>
                Q: How does document privacy work?
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.6' }}>
                We prioritize user privacy. All uploaded documents (PDFs, images) are automatically deleted from server storage 5 minutes after submission, ensuring private customer records stay confidential.
              </p>
            </div>

            <div className="neo-card" style={{ padding: '20px 25px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--accent-color)' }}>
                Q: Can I set my own printing rates?
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.6' }}>
                Yes! From your Shop Profile dashboard, you can adjust your per-page Black & White rate (e.g. ₹2/pg or ₹5/pg) and Color rate (e.g. ₹10/pg). The customer checkout page automatically calculates the bill based on your custom rates.
              </p>
            </div>

            <div className="neo-card" style={{ padding: '20px 25px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--accent-color)' }}>
                Q: How do customers pay for prints?
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.6' }}>
                Customers pay you directly at your shop counter (via Cash or your shop's existing PhonePe / GooglePay / Paytm UPI QR code) when they pick up their physical printed document.
              </p>
            </div>

          </div>
        </section>

      </main>

      {/* Footer */}
      <footer style={{ textAlign: 'center', marginTop: '60px', padding: '30px 0', borderTop: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        <p style={{ margin: '0 0 8px 0' }}>&copy; {new Date().getFullYear()} QRPrintPlatform. All rights reserved. Built for modern Xerox & print shops in India.</p>
        <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>Created & Managed by <strong>Shashank Madiwal</strong> (Contact: +919483030043)</p>
      </footer>
    </div>
  );
};

export default Landing;
