import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => existsSync(path.join(root, file))
  ? parseEnv(readFileSync(path.join(root, file), 'utf8')) : {};
// Report names/status only. Never print environment values.
const frontend = { ...read('frontend/.env'), ...read('frontend/.env.local'), ...read('frontend/.env.development'), ...read('frontend/.env.development.local'), ...process.env };
const server = { ...read('frontend/.env'), ...read('frontend/.env.local'), ...process.env };
let missing = 0;
function check(label, present) {
  console.log(`${present ? 'OK' : 'MISSING'}: ${label}`);
  if (!present) missing++;
}
const [major, minor] = process.versions.node.split('.').map(Number);
check('Node 22.12+ or 24.x (24 recommended)', (major === 22 && minor >= 12) || major === 23 || major === 24);
for (const file of ['node_modules/vercel/package.json', 'node_modules/supabase/package.json', 'node_modules/@supabase/supabase-js/package.json', 'frontend/node_modules/vite/package.json']) {
  check(file, existsSync(path.join(root, file)));
}
check('Vercel frontend project link', existsSync(path.join(root, 'frontend/.vercel/project.json')));
check('Frontend Supabase URL', !!frontend.VITE_SUPABASE_URL);
check('Frontend Supabase public key', !!(frontend.VITE_SUPABASE_ANON_KEY || frontend.VITE_SUPABASE_PUBLISHABLE_KEY));
for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'CRON_SECRET', 'REGISTRATION_SECRET', 'REQUEST_LOG_SECRET']) {
  check(`Local server configuration: ${name}`, !!server[name]);
}
check('Local order signing secret (explicit or supported fallback)', !!(server.ORDER_SESSION_SECRET || server.REGISTRATION_SECRET || server.REQUEST_LOG_SECRET));
console.log('Presence checks only; this does not validate credentials, hosted settings, or database policies.');
console.log('Vercel dev uses frontend env files; root-only variables are intentionally not counted.');
if (missing) process.exitCode = 1;
