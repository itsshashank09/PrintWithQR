import { useEffect, useState } from 'react';

function readTheme() { try { return localStorage.getItem('theme') === 'dark'; } catch { return document.documentElement.classList.contains('dark-theme'); } }
export default function ThemeToggle() {
  const [dark, setDark] = useState(readTheme);
  useEffect(() => {
    document.documentElement.classList.toggle('dark-theme', dark);
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch { /* usable without storage */ }
  }, [dark]);
  useEffect(() => {
    const sync = event => { if (event.key === 'theme') setDark(readTheme()); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  return <div className="theme-toggle-floating-container"><button className="theme-toggle" type="button" role="switch" aria-checked={dark} aria-label={label} title={label} onClick={() => setDark(value => !value)}><span className="theme-toggle-track" aria-hidden="true"><span className="theme-toggle-sun">☀</span><span className="theme-toggle-moon">☾</span><span className="theme-toggle-thumb" /></span></button></div>;
}
