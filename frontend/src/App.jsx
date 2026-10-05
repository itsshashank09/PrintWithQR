import React, { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import { MARKETING_PATHS, PRIVATE_ROBOTS } from '../seo/site.mjs';
import ThemeToggle from './components/ThemeToggle';
import LoadingSpinner from './components/LoadingSpinner';
import { supabase } from './supabaseClient';

const Payment = lazy(() => import('./pages/Payment'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const UploadPage = lazy(() => import('./pages/Upload'));
const OrderStatus = lazy(() => import('./pages/OrderStatus'));
const Admin = lazy(() => import('./pages/Admin'));

function PrivateMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.body.classList.toggle('customer-view', /^\/(shop|order)\//.test(pathname));
    document.title = 'PrintWithQR – Private application';
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.append(robots); }
    robots.content = PRIVATE_ROBOTS;
    document.querySelectorAll('link[rel="canonical"], script[type="application/ld+json"]').forEach(node => node.remove());
  }, [pathname]);
  return null;
}

function ProtectedRoute({ children }) {
  const [state, setState] = useState('loading');
  useEffect(() => {
    let active = true;
    let authEventVersion = 0;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        authEventVersion += 1;
        setState(session ? 'authenticated' : 'anonymous');
      }
    });
    const initialVersion = authEventVersion;
    supabase.auth.getSession().then(({ data: sessionData, error }) => {
      if (active && authEventVersion === initialVersion) {
        setState(!error && sessionData?.session ? 'authenticated' : 'anonymous');
      }
    }).catch(() => { if (active && authEventVersion === initialVersion) setState('anonymous'); });
    return () => { active = false; data?.subscription?.unsubscribe(); };
  }, []);
  if (state === 'loading') return <LoadingSpinner label="Checking your sign-in" />;
  if (state !== 'authenticated') return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return <Router><PrivateMetadata /><Suspense fallback={<LoadingSpinner label="Loading PrintWithQR" />}><Routes>
    {MARKETING_PATHS.map(path => <Route key={path} path={path} element={<Landing path={path} />} />)}
    <Route path="/home" element={<Landing />} />
    <Route path="/login" element={<Login />} />
    <Route path="/register/start" element={<Register />} />
    <Route path="/payment/:shopId" element={<ProtectedRoute><Payment /></ProtectedRoute>} />
    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
    <Route path="/admin" element={<Admin />} />
    <Route path="/shop/:shopId" element={<UploadPage />} />
    <Route path="/order/:orderId" element={<OrderStatus />} />
    <Route path="*" element={<main className="neo-container"><h1>Page not found</h1><a href="/">Return to PrintWithQR</a></main>} />
  </Routes></Suspense><ThemeToggle /></Router>;
}
