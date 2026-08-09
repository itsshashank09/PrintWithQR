const getBackendUrl = () => {
  // If Vercel environment variable is set, use it
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }
  // Otherwise fall back to local IP detection
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `http://${hostname}:5000`;
};

export const SOCKET_URL = getBackendUrl();

// Production Vercel serverless functions are served at '/api'.
// Override only if VITE_API_URL is explicitly set in environment.
export const API_URL = import.meta.env.VITE_API_URL || '/api';
