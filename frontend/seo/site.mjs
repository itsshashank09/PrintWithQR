export const SITE = 'https://www.printwithqr.in';
export const PRIVATE_ROBOTS = 'noindex, nofollow, nosnippet, noimageindex';
export const SOCIALS = [
  ['Instagram', 'https://www.instagram.com/printwithqr/'],
  ['YouTube', 'https://www.youtube.com/@printwithqr'],
];
// Owner approved all three policy pages and production publication on 2 October 2026.
export const POLICIES_APPROVED = true;
export const PUBLIC_PATHS = ['/', '/features', '/how-it-works', '/pricing', '/for-print-shops', '/online-printing', '/online-xerox', '/qr-printing', '/faq', '/setup-guide', '/register', '/contact'];
export const POLICY_PATHS = ['/privacy-policy', '/terms', '/refund-policy'];
export const MARKETING_PATHS = [...PUBLIC_PATHS, ...POLICY_PATHS];
export const INDEXABLE_PATHS = POLICIES_APPROVED ? MARKETING_PATHS : PUBLIC_PATHS;
export const NAV = [['Home', '/'], ['Features', '/features'], ['How It Works', '/how-it-works'], ['For Businesses', '/for-print-shops'], ['Pricing', '/pricing'], ['FAQ', '/faq'], ['Contact', '/contact']];
