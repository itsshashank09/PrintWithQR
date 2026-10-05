import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pages } from '../frontend/seo/content.mjs';
import { renderPage, renderSitemap, robotsTxt, structuredData } from '../frontend/seo/render.mjs';
import { routeRequest } from '../frontend/seo/routing.mjs';
import { SITE, MARKETING_PATHS, POLICY_PATHS, INDEXABLE_PATHS } from '../frontend/seo/site.mjs';
import middleware from '../frontend/middleware.js';

test('public pages contain unique crawlable content, metadata, links and valid JSON-LD', () => {
  const titles = new Set(), descriptions = new Set(), incoming = new Set();
  for (const path of INDEXABLE_PATHS) {
    const html = renderPage(path);
    assert.equal((html.match(/<h1[ >]/g) || []).length, 1, path);
    assert.equal((html.match(/rel="canonical"/g) || []).length, 1, path);
    assert.ok(html.includes(`href="${SITE}${path}"`));
    assert.ok(!/<meta name="robots" content="[^"]*noindex/.test(html), path);
    assert.ok(!/QRPrintPlatform|QR Print Platform|100% Private|five minutes after upload/i.test(html));
    const behaviorScripts = [...html.matchAll(/<script\b(?! type="application\/ld\+json")([^>]*)>/g)].map(match => match[1]);
    assert.deepEqual(behaviorScripts, [' src="/marketing-theme.js"'], 'only the small theme script runs on marketing pages');
    assert.match(html, /class="theme-toggle"[^>]*role="switch"[^>]*aria-checked="false"/);
    assert.ok(!/razorpay\.com\/v1|pdf\.min\.js|supabase\.co|\/assets\//.test(html));
    assert.ok(!titles.has(pages[path].title), 'unique title'); titles.add(pages[path].title);
    assert.ok(!descriptions.has(pages[path].description), 'unique description'); descriptions.add(pages[path].description);
    const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(schema['@context'], 'https://schema.org');
    assert.deepEqual(schema, structuredData(path));
    assert.ok(!JSON.stringify(schema).match(/aggregateRating|reviewCount/));
    if (path === '/faq') assert.deepEqual(schema['@graph'].find(item => item['@type'] === 'FAQPage').mainEntity.map(item => item.acceptedAnswer.text), pages[path].sections.filter(section => section.heading.endsWith('?')).map(section => section.paragraphs.join(' ')));
    if (path !== '/') {
      assert.ok(html.includes('aria-label="Breadcrumb"'));
      assert.equal(schema['@graph'].find(item => item['@type'] === 'BreadcrumbList').itemListElement[1].item, SITE + path);
    }
    for (const [, href] of html.matchAll(/href="(\/[^"#]*)"/g)) {
      if (MARKETING_PATHS.includes(href) && href !== path) incoming.add(href);
      else assert.ok(['/login', '/register/start', '/favicon.ico', '/favicon.svg', '/apple-touch-icon.png', '/marketing.css'].includes(href) || href === path, `Unexpected link ${href}`);
    }
  }
  for (const path of MARKETING_PATHS) assert.ok(incoming.has(path), `No incoming link for ${path}`);
});

test('sitemap contains canonical public pages and approved policies without draft notices', () => {
  const locations = [...renderSitemap().matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  assert.deepEqual(locations, INDEXABLE_PATHS.map(path => SITE + path));
  assert.equal(new Set(locations).size, locations.length);
  assert.ok(robotsTxt.includes(`Sitemap: ${SITE}/sitemap.xml`));
  assert.ok(!/^Disallow:\s*\S/m.test(robotsTxt), 'Google must be able to read noindex');
  for (const path of POLICY_PATHS) {
    const html = renderPage(path);
    assert.ok(!/<meta name="robots" content="[^"]*noindex/.test(html));
    assert.ok(locations.includes(SITE + path));
    assert.ok(!/draft|proposed|before publication|must be confirmed/i.test(html));
    assert.ok(html.includes('Effective date: 2 October 2026'));
    assert.equal(routeRequest(SITE + path).headers['X-Robots-Tag'], 'index, follow');
  }
});

test('the public theme script is served without opening other dynamic file URLs', () => {
  const script = routeRequest('https://www.printwithqr.in/marketing-theme.js');
  assert.equal(script.kind, 'next');
  assert.match(script.headers['X-Robots-Tag'], /noindex/);
  assert.match(routeRequest('https://www.printwithqr.in/assets/app.js').headers['X-Robots-Tag'], /noindex/);
  assert.equal(routeRequest('https://preview.vercel.app/marketing-theme.js').kind, 'next');
  assert.equal(routeRequest('https://www.printwithqr.in/private-upload.pdf').kind, 'not-found');
});

test('default deny indexing: private, file, API, unknown and parameterized URLs', () => {
  const privatePaths = ['/login', '/register/start', '/dashboard', '/dashboard/queue', '/profile', '/admin', '/shop/example', '/shop/example/', '/order/example', '/payment/example?plan=yearly', '/customer/example', '/checkout/example', '/print-queue', '/queue', '/uploaded-file/example.pdf', '/uploads/example.pdf', '/files/example.pdf', '/print.html?file=example.pdf', '/app.html', '/unknown', '/features/secret', '/api/create-order', '/api/future-endpoint', '/?shopId=example', '/?utm_source=test', '/features?file=example', '/shop%2Fexample', '/%64ashboard', '/privacy-policy?file=example', '/terms/secret', '/refund-policy?order=example'];
  for (const path of privatePaths) {
    const route = routeRequest(SITE + path);
    assert.match(route.headers['X-Robots-Tag'], /noindex/, path);
    assert.ok(!route.headers.Link, path);
  }
  for (const path of INDEXABLE_PATHS) {
    assert.equal(routeRequest(SITE + path).headers['X-Robots-Tag'], 'index, follow');
    for (const host of ['preview.vercel.app', 'localhost:3000', 'unknown.example']) assert.match(routeRequest(`https://${host}${path}`).headers['X-Robots-Tag'], /noindex/);
  }
  assert.equal(routeRequest(SITE + '/unknown').status, 404);
  assert.equal(routeRequest(SITE + '/uploads/file.pdf').status, 404);
});

test('both domain families serve the same site without changing the hostname', () => {
  for (const host of ['www.printwithqr.in', 'printwithqr.in', 'printwithqr.com', 'www.printwithqr.com']) {
    const publicRoute = routeRequest(`https://${host}/features`);
    assert.equal(publicRoute.kind, 'marketing');
    assert.equal(publicRoute.destination, '/features/index.html');
    assert.equal(publicRoute.headers['X-Robots-Tag'], 'index, follow');
    assert.equal(publicRoute.headers.Link, `<${SITE}/features>; rel="canonical"`);
    const privateRoute = routeRequest(`https://${host}/dashboard`);
    assert.equal(privateRoute.kind, 'app');
    assert.match(privateRoute.headers['X-Robots-Tag'], /noindex/);
    const queryRoute = routeRequest(`https://${host}/features?utm_source=test`);
    assert.equal(queryRoute.kind, 'marketing');
    assert.match(queryRoute.headers['X-Robots-Tag'], /noindex/);
    assert.equal(routeRequest(`https://${host}/features/`).location, '/features');
  }
  for (const [path, destination] of [['/home', '/'], ['/index.html', '/'], ['/features/', '/features'], ['/features/index.html', '/features']]) {
    const route = routeRequest(SITE + path); assert.equal(route.status, 308); assert.equal(route.location, destination);
  }
  for (const file of ['frontend/index.html', 'frontend/public/print.html']) {
    const html = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    assert.ok(html.includes('noindex'));
    assert.ok(!/rel="canonical"|application\/ld\+json/.test(html));
  }
});

test('Vercel middleware emits response headers and rewrites without losing noindex', () => {
  for (const path of ['/shop/example', '/api/create-order', '/print.html', '/unknown']) {
    const response = middleware(new Request(SITE + path));
    assert.match(response.headers.get('X-Robots-Tag'), /noindex/);
    if (path.startsWith('/shop')) assert.equal(response.headers.get('x-middleware-rewrite'), SITE + '/app.html');
    if (path === '/unknown') assert.equal(response.status, 404);
  }
  for (const host of ['www.printwithqr.in', 'printwithqr.com']) {
    const response = middleware(new Request(`https://${host}/features`));
    assert.equal(response.headers.get('x-middleware-rewrite'), `https://${host}/features/index.html`);
    assert.equal(response.headers.get('X-Robots-Tag'), 'index, follow');
  }
});
