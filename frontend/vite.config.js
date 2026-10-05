import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { renderPage, renderSitemap, robotsTxt, llmsTxt } from './seo/render.mjs'
import { routeRequest, notFoundHtml } from './seo/routing.mjs'

function publicHtml() {
  return {
    name: 'printwithqr-public-html',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        if (/^\/(?:src\/|@|node_modules\/)/.test(url.pathname)) return next();
        const route = routeRequest(url);
        for (const [key, value] of Object.entries(route.headers)) res.setHeader(key, value);
        if (route.kind === 'redirect') { res.writeHead(route.status, { Location: route.location }); return res.end(); }
        if (route.kind === 'marketing') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(renderPage(route.path)); }
        if (url.pathname === '/robots.txt') { res.setHeader('Content-Type', 'text/plain'); return res.end(robotsTxt); }
        if (url.pathname === '/sitemap.xml') { res.setHeader('Content-Type', 'application/xml'); return res.end(renderSitemap()); }
        if (url.pathname === '/llms.txt') { res.setHeader('Content-Type', 'text/plain'); return res.end(llmsTxt); }
        if (route.kind === 'not-found') { res.statusCode = 404; return res.end(notFoundHtml); }
        if (route.kind === 'app' || url.pathname === '/app.html') req.url = '/index.html';
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [publicHtml(), react()],
    build: { manifest: true },
    define: {
      'process.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL || env.SUPABASE_URL || ''),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '')
    },
    server: {
      proxy: {
        '/uploads': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        }
      }
    }
  };
})
