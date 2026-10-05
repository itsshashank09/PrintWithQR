import { SITE, PRIVATE_ROBOTS, SOCIALS, NAV, INDEXABLE_PATHS, POLICY_PATHS } from './site.mjs';
import { pages } from './content.mjs';

export const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const floatingDots = `<span class="points_wrapper" aria-hidden="true">${'<i class="point"></i>'.repeat(10)}</span>`;
const arrow = '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
const link = ([label, href], className = '') => {
  const primary = className.split(' ').includes('primary');
  return `<a href="${escapeHtml(href)}"${className ? ` class="${className}${primary ? ' btn-floating-dots' : ''}"` : ''}>${primary ? `${floatingDots}<span class="inner">${escapeHtml(label)}${arrow}</span>` : escapeHtml(label)}</a>`;
};
const linkList = links => `<ul class="related-links">${links.map(item => `<li>${link(item)}</li>`).join('')}</ul>`;

export function structuredData(path) {
  const page = pages[path];
  const url = SITE + path;
  const graph = [
    { '@type': 'Organization', '@id': SITE + '/#organization', name: 'PrintWithQR', url: SITE + '/', logo: SITE + '/logo512.png', description: 'A QR-based print-ordering platform for businesses that receive customer documents at a staffed counter.', sameAs: SOCIALS.map(([, href]) => href), contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: 'shxbuild@gmail.com', telephone: '+919483030043' } },
    { '@type': 'WebSite', '@id': SITE + '/#website', name: 'PrintWithQR', url: SITE + '/', publisher: { '@id': SITE + '/#organization' } },
    { '@type': 'WebPage', '@id': url + '#webpage', url, name: page.title, description: page.description, isPartOf: { '@id': SITE + '/#website' } },
  ];
  if (path === '/') graph.push({ '@type': 'SoftwareApplication', '@id': SITE + '/#application', name: 'PrintWithQR', url: SITE + '/', applicationCategory: 'BusinessApplication', operatingSystem: 'Web browser', description: page.description, publisher: { '@id': SITE + '/#organization' } });
  if (path === '/faq') graph.push({ '@type': 'FAQPage', mainEntity: page.sections.filter(section => section.heading.endsWith('?')).map(section => ({ '@type': 'Question', name: section.heading, acceptedAnswer: { '@type': 'Answer', text: section.paragraphs.join(' ') } })) });
  if (path !== '/') graph.push({ '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
    { '@type': 'ListItem', position: 2, name: page.label, item: url },
  ] });
  return { '@context': 'https://schema.org', '@graph': graph };
}

const plans = `<section aria-labelledby="plans-title"><h2 id="plans-title">Choose your business plan</h2><div class="plans">
  <article class="card"><p class="eyebrow">TRY THE WORKFLOW</p><h3>Free trial</h3><p class="price">₹0</p><p>10 printed pages</p><p>Check your business QR code and order queue with sample files.</p>${link(['Start the business trial', '/register'], 'button')}</article>
  <article class="card"><p class="eyebrow">MONTHLY</p><h3>30 days</h3><p class="price">₹99</p><p>Per business subscription</p><p>Continue using your QR upload page and order dashboard.</p>${link(['Register your business', '/register'], 'button')}</article>
  <article class="card"><p class="eyebrow">YEARLY</p><h3>365 days</h3><p class="price">₹599</p><p>Per business subscription</p><p>A longer access period for your print-order workflow.</p>${link(['Get started with PrintWithQR', '/register'], 'button')}</article>
</div></section>`;

const heroShowcase = `<aside class="hero-showcase" aria-label="Illustration of a PrintWithQR order">
  <div class="showcase-glow" aria-hidden="true"></div>
  <div class="showcase-label"><span class="showcase-label-dot"></span> YOUR QR. YOUR QUEUE.</div>
  <div class="showcase-phone">
    <div class="phone-top"><span class="phone-brand-mark">P</span><strong>PrintWithQR</strong><span class="phone-top-dots" aria-hidden="true">•••</span></div>
    <div class="phone-address"><span aria-hidden="true">⌁</span> <span data-domain-display>printwithqr.in</span>/shop/your-shop</div>
    <div class="phone-content"><p class="phone-eyebrow">YOUR BUSINESS UPLOAD PAGE</p><h2>Files ready. Counter next.</h2><p>Customers choose their print options here.</p>
      <div class="sample-file"><span class="sample-file-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg></span><span><strong>document.pdf</strong><small>2 pages · PDF</small></span><span class="sample-file-check" aria-hidden="true">✓</span></div>
      <div class="sample-settings"><span>B&amp;W</span><span>Page selection</span><span>A4</span></div>
      <div class="sample-send">Send to shop queue <span aria-hidden="true">↗</span></div>
      <p class="phone-footnote">Pay the shop directly when you collect.</p>
    </div>
  </div>
  <div class="queue-float"><div class="queue-float-top"><span class="queue-icon" aria-hidden="true">▤</span><span>BUSINESS DASHBOARD</span><span class="queue-status"><i></i> NEW</span></div><strong>Order received</strong><span>document.pdf · Page selection</span><div class="queue-progress"><i></i></div><small>Ready for your team's review</small></div>
  <div class="scan-float"><span class="scan-symbol" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span><strong>Your business QR</strong><small>Customers scan to upload</small></span></div>
  <p class="showcase-caption">Illustrative order preview</p>
</aside>`;

export function renderPage(path) {
  const page = pages[path];
  if (!page) throw new Error(`No public content for ${path}`);
  const indexable = INDEXABLE_PATHS.includes(path);
  const isDraft = POLICY_PATHS.includes(path) && !indexable;
  const canonical = SITE + path;
  const home = path === '/';
  const head = `<meta name="description" content="${escapeHtml(page.description)}">
  <meta name="robots" content="${indexable ? 'index, follow, max-image-preview:large' : PRIVATE_ROBOTS}">
  ${indexable ? `<link rel="canonical" href="${canonical}">` : ''}
  <meta property="og:site_name" content="PrintWithQR"><meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(page.title)}"><meta property="og:description" content="${escapeHtml(page.description)}">
  <meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE}/logo512.png"><meta property="og:image:alt" content="PrintWithQR logo">
  <meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escapeHtml(page.title)}">
  <meta name="twitter:description" content="${escapeHtml(page.description)}"><meta name="twitter:image" content="${SITE}/logo512.png">
  ${indexable ? `<script type="application/ld+json">${JSON.stringify(structuredData(path)).replace(/</g, '\\u003c')}</script>` : ''}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(page.title)}</title>${head}
<link rel="icon" href="/favicon.ico"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<script src="/marketing-theme.js"></script><link rel="stylesheet" href="/marketing.css"></head><body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header wrap"><a class="brand" href="/" aria-label="PrintWithQR home"><img src="/logo192.png" width="36" height="36" alt="">PrintWithQR</a>
<nav aria-label="Main navigation">${NAV.map(([label, href]) => `<a href="${href}"${href === path ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
<div class="header-actions">${link(['Register Business', '/register/start'], 'button primary header-register')}<a class="section-button login-link" href="/login"><span class="section-button__title">Business Login</span><span class="section-button__circle" aria-hidden="true"></span></a></div></header>
<main id="main" class="wrap">
${home ? '' : `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">${page.label}</li></ol></nav>`}
${isDraft ? '<aside class="draft-notice"><strong>Draft for owner review</strong><p>This page is excluded from search indexing. It is not an effective policy. Business details and policy decisions are still awaiting approval.</p></aside>' : ''}
<section class="hero ${home ? 'hero-home' : ''}"><div class="hero-copy"><p class="eyebrow">${page.eyebrow || 'PRINTWITHQR / ' + page.label.toUpperCase()}</p><h1>${home ? 'One QR code.<br><span class="hero-highlight">Every print request in one queue.</span>' : escapeHtml(page.h1)}</h1><p class="intro">${escapeHtml(page.intro)}</p>
${home ? `<div class="hero-actions">${link(['Start your business trial', '/register/start'], 'button primary')}${link(['See how it works', '/how-it-works'], 'button')}</div><p class="hero-note">For print shops · Cyber cafés · Hospital print desks</p>` : ''}</div>
${home ? heroShowcase : ''}</section>
${page.pricing ? plans : ''}
<div class="page-content ${home ? 'home-content' : ''}">${page.sections.map(({ heading, paragraphs, links }) => `<section><h2>${escapeHtml(heading)}</h2>${paragraphs.map(text => `<p>${escapeHtml(text)}</p>`).join('')}${links.length ? linkList(links) : ''}</section>`).join('')}</div>
${!isDraft && path !== '/register' ? `<section class="cta"><div><h2>Ready to try it at your counter?</h2><p>Start with a 10-page trial and test your first QR order.</p></div>${link(['Register your business', '/register'], 'button primary')}</section>` : ''}
</main>
<footer class="site-footer"><div class="wrap footer-grid"><div><a class="brand" href="/">PrintWithQR</a><p>A QR upload page and print queue for your business.</p></div>
<nav aria-label="Guides"><h2>Printing guides</h2>${linkList([['Online printing', '/online-printing'], ['Online xerox', '/online-xerox'], ['QR printing', '/qr-printing'], ['Shop setup guide', '/setup-guide']])}</nav>
<nav aria-label="Company"><h2>PrintWithQR</h2>${linkList([['Contact', '/contact'], ['Privacy policy' + (isPolicyDraft() ? ' (draft)' : ''), '/privacy-policy'], ['Terms' + (isPolicyDraft() ? ' (draft)' : ''), '/terms'], ['Refund policy' + (isPolicyDraft() ? ' (draft)' : ''), '/refund-policy'], ...SOCIALS])}</nav></div></footer>
<div class="theme-toggle-floating-container"><button class="theme-toggle" type="button" role="switch" aria-checked="false" aria-label="Switch to dark mode" title="Switch to dark mode"><span class="theme-toggle-track" aria-hidden="true"><span class="theme-toggle-sun">☀</span><span class="theme-toggle-moon">☾</span><span class="theme-toggle-thumb"></span></span></button></div>
</body></html>`;
}

function isPolicyDraft() { return !INDEXABLE_PATHS.includes('/privacy-policy'); }

export function renderSitemap() {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${INDEXABLE_PATHS.map(path => `  <url><loc>${SITE}${path}</loc></url>`).join('\n')}\n</urlset>\n`;
}

export const robotsTxt = `User-agent: *\nAllow: /\n\n# Private URLs return noindex headers and HTML. Allow crawling so Google can read them.\n# robots.txt is not an access-control mechanism.\nSitemap: ${SITE}/sitemap.xml\n`;

export const llmsTxt = `# PrintWithQR

> PrintWithQR is a browser-based QR document-upload and print-order queue for businesses with staffed printing counters.

The business registers and displays its QR code. Customers scan that QR, upload PDF, PNG or JPEG files, select print options and submit requests. Authenticated counter staff review and print authorized jobs. It is not a consumer print-delivery marketplace or an unattended printer controller.

## Product facts

- Intended operators: print/Xerox shops, cyber cafés, offices, schools, hotels, clinics, hospital print desks and other staffed business counters.
- Printing options: page selection, black-and-white or colour, paper size and duplex instructions. The operator confirms settings in the physical printer's print dialog.
- Businesses set print rates and collect printing payments directly. A platform subscription does not include paper, ink or printing.
- Trial: 10 printed pages. Paid access: ₹99 for 30 days or ₹599 for 365 days per business.
- Customer files are private working copies. Only authorized shop staff can obtain short-lived document links. Completed/cancelled files become eligible for deletion after 10 minutes; a scheduled worker retries removal. Pending/printing files are preserved. Local downloads and physical copies remain under the business's control.

## Public information

${INDEXABLE_PATHS.map(path => `- [${pages[path].label}](${SITE}${path}): ${pages[path].description}`).join('\n')}

## Support

- Email: shxbuild@gmail.com
- Phone: +91 94830 30043

Private shop upload pages, dashboards, orders, checkout and uploaded documents are not public reference material.
`;
