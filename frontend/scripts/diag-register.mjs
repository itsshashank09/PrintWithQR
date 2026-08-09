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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(path.join(repoRoot, '.env'));

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const testPhone = `9${String(Date.now()).slice(-9)}`;
const email = `${testPhone}@gmail.com`;

const { data: userData, error: userError } = await admin.auth.admin.createUser({
  email,
  password: 'test1234',
  email_confirm: true,
  user_metadata: { phone: testPhone, name: 'Diag Test' }
});

if (userError) {
  console.log('AUTH_ERROR', userError.message);
  process.exit(1);
}

const userId = userData.user.id;
const now = new Date().toISOString();

const shopRecord = {
  id: userId,
  name: 'Diag Test',
  phone: testPhone,
  address: 'Test',
  printer_model: 'x',
  bw_rate: 5.0,
  color_rate: 10.0,
  color_enabled: 1,
  is_paid: 0,
  subscription_status: 'free',
  subscription_plan: 'free',
  free_prints_allowed: 10,
  free_prints_used: 0,
  trial_completed: false,
  device_hash: 'diag-hash',
  ip_hash: 'diag-ip',
  registration_device_risk: 'botScore:0.00',
  registration_ip_risk: 'recorded',
  subscription_started_at: now,
  subscription_expires_at: null,
  created_at: now
};

const { error: shopError } = await admin.from('shops').upsert(shopRecord);
if (shopError) {
  console.log('SHOP_ERROR', shopError.message, shopError.code, shopError.details, shopError.hint);
} else {
  console.log('SHOP_OK', userId);
  await admin.from('shops').delete().eq('id', userId);
}

await admin.auth.admin.deleteUser(userId);
