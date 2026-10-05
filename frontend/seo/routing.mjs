import { SITE, PRIVATE_ROBOTS, MARKETING_PATHS, INDEXABLE_PATHS } from './site.mjs';

const productionHosts = new Set(['www.printwithqr.in', 'printwithqr.in', 'printwithqr.com', 'www.printwithqr.com']);
const assets = new Set(['/marketing.css', '/design-system.css', '/marketing-theme.js', '/favicon.ico', '/favicon.svg', '/favicon-48x48.png', '/apple-touch-icon.png', '/logo192.png', '/logo512.png', '/qr_poster_template.png', '/icons.svg']);
export const notFoundHtml = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow, nosnippet, noimageindex"><title>Page not found | PrintWithQR</title></head><body><main><h1>Page not found</h1><p>This address does not have a page.</p><a href="/">Return to PrintWithQR</a></main></body></html>';

export function routeRequest(input) {
  const url = new URL(input);
  const { pathname: path } = url;
  const isProductionHost = productionHosts.has(url.hostname);
  const privateHeaders = { 'X-Robots-Tag': PRIVATE_ROBOTS, 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'private, no-store' };
  // Normalize only known public pages, preserving parameters so they cannot become indexable accidentally.
  let normal = path.replace(/\/+$/, '') || '/';
  if (normal.endsWith('/index.html')) normal = normal.slice(0, -11) || '/';
  if (normal === '/home' || normal === '/index.html') normal = '/';
  if (normal !== path && MARKETING_PATHS.includes(normal)) {
    return { kind: 'redirect', status: 308, location: normal + url.search, headers: privateHeaders };
  }
  if (MARKETING_PATHS.includes(path)) {
    const indexable = isProductionHost && !url.search && INDEXABLE_PATHS.includes(path);
    return { kind: 'marketing', path, destination: path === '/' ? '/index.html' : path + '/index.html', headers: indexable ? { 'X-Robots-Tag': 'index, follow', 'Link': `<${SITE}${path}>; rel="canonical"`, 'Referrer-Policy': 'strict-origin-when-cross-origin' } : privateHeaders };
  }
  if (path === '/robots.txt' || path === '/sitemap.xml' || path === '/llms.txt') return { kind: 'next', headers: { 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer' } };
  if (assets.has(path) || path.startsWith('/assets/') || path.startsWith('/_vercel/')) {
    const noindexAsset = path.endsWith('.js') || path.endsWith('.css') || path.startsWith('/assets/');
    return { kind: 'next', headers: noindexAsset || !isProductionHost ? { 'X-Robots-Tag': PRIVATE_ROBOTS } : {} };
  }
  if (path === '/api' || path.startsWith('/api/') || path === '/print.html' || path === '/app.html') return { kind: 'next', headers: privateHeaders };
  // This deliberately excludes unknown paths and file URLs from the SPA fallback.
  if (/^\/(?:login|register\/start|dashboard|profile|admin)(?:\/.*)?$/.test(path) || /^\/(?:shop|order|payment)\/[^/]+\/?$/.test(path)) {
    return { kind: 'app', destination: '/app.html', headers: privateHeaders };
  }
  return { kind: 'not-found', status: 404, headers: { ...privateHeaders, 'Content-Type': 'text/html; charset=utf-8' } };
}
