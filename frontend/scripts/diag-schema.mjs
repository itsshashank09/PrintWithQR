import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnv(path.join(repoRoot, '.env'));

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

for (const table of ['shops', 'registration_attempts']) {
  const { data, error } = await admin.from(table).select('*').limit(1);
  if (error) {
    console.log(table, 'ERROR', error.message, error.code);
  } else {
    console.log(table, 'columns', data?.[0] ? Object.keys(data[0]).sort().join(', ') : '(empty table)');
  }
}
