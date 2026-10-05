import { useEffect } from 'react';

// Public pages are complete static documents. Leave the private SPA on navigation.
export default function Landing({ path = '/' }) {
  useEffect(() => { window.location.replace(path); }, [path]);
  return <p><a href={path}>Continue to PrintWithQR</a></p>;
}
