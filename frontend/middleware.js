import { next, rewrite } from '@vercel/functions';
import { routeRequest, notFoundHtml } from './seo/routing.mjs';

export default function middleware(request) {
  const route = routeRequest(request.url);
  if (route.kind === 'redirect') return new Response(null, { status: route.status, headers: { ...route.headers, Location: route.location } });
  if (route.kind === 'not-found') return new Response(notFoundHtml, { status: 404, headers: route.headers });
  if (route.destination) return rewrite(new URL(route.destination, request.url), { headers: route.headers });
  return next({ headers: route.headers });
}

export const config = { matcher: '/:path*' };
