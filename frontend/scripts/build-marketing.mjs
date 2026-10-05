import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MARKETING_PATHS } from '../seo/site.mjs';
import { renderPage, renderSitemap, robotsTxt, llmsTxt } from '../seo/render.mjs';

const dist = resolve('dist');
// Vite's app shell is private. Public pages contain complete HTML and no app bundle.
const appShell = await readFile(resolve(dist, 'index.html'), 'utf8');
if (!appShell.includes('noindex')) throw new Error('The application shell must be noindex before building public pages.');
await writeFile(resolve(dist, 'app.html'), appShell);
// Let the browser fetch the auth app at low priority while the visitor reads a
// marketing page. Login and registration are included in this entry bundle.
const manifest = JSON.parse(await readFile(resolve(dist, '.vite/manifest.json'), 'utf8'));
const authAssets = new Set();
function collectAsset(key) {
  const entry = manifest[key];
  if (!entry) throw new Error(`Missing Vite manifest entry: ${key}`);
  authAssets.add(entry.file);
  for (const css of entry.css || []) authAssets.add(css);
  for (const dependency of entry.imports || []) collectAsset(dependency);
}
collectAsset('index.html');
const authPrefetch = [...authAssets].map(file => `<link rel="prefetch" href="/${file}" as="${file.endsWith('.css') ? 'style' : 'script'}">`).join('');
for (const path of MARKETING_PATHS) {
  const directory = resolve(dist, '.' + path);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'index.html'), renderPage(path).replace('</head>', `${authPrefetch}</head>`));
}
await writeFile(resolve(dist, 'sitemap.xml'), renderSitemap());
await writeFile(resolve(dist, 'robots.txt'), robotsTxt);
await writeFile(resolve(dist, 'llms.txt'), llmsTxt);
console.log(`Generated ${MARKETING_PATHS.length} public/draft HTML pages, sitemap and robots.txt.`);
