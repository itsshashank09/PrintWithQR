// Preload before the existing regression suite. No real credentials or network.
import assert from 'node:assert/strict';

for (const key of Object.keys(process.env)) {
  if (/SUPABASE|RAZORPAY|CRON_SECRET|REGISTRATION_SECRET|REQUEST_LOG_SECRET|ORDER_SESSION_SECRET/.test(key)) delete process.env[key];
}
Object.assign(process.env, {
  SUPABASE_URL: 'https://printwithqr-test.invalid',
  SUPABASE_SERVICE_ROLE_KEY: 'offline-service-role',
  RAZORPAY_KEY_ID: 'rzp_test_offline',
  RAZORPAY_KEY_SECRET: 'offline-razorpay-secret',
  CRON_SECRET: 'offline-cron-secret',
  REGISTRATION_SECRET: 'offline-registration-secret',
  REQUEST_LOG_SECRET: 'offline-request-log-secret',
  ORDER_SESSION_SECRET: 'offline-order-session-secret'
});

const unexpectedRequests = [];
let checkedPrice = false;
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const method = options.method || (input instanceof Request ? input.method : 'GET');
  const json = (body, headers = {}) => new Response(JSON.stringify(body), {
    status: 200, headers: { 'Content-Type': 'application/json', ...headers }
  });
  if (url.origin === 'https://api.razorpay.com' && url.pathname === '/v1/orders' && method === 'POST') {
    const body = JSON.parse(options.body);
    assert.equal(body.amount, 59900, 'The yearly price must ignore the client-supplied amount');
    assert.equal(body.currency, 'INR');
    checkedPrice = true;
    return json({ id: 'order_offline', amount: body.amount, currency: body.currency });
  }
  if (url.origin === process.env.SUPABASE_URL) {
    if (url.pathname === '/storage/v1/object/list/print-jobs' && method === 'POST') return json([]);
    if (['/rest/v1/orders','/rest/v1/print_upload_intents'].includes(url.pathname) && method === 'GET') return json([]);
    if (url.pathname === '/rest/v1/registration_attempts' && method === 'GET') return json([], { 'Content-Range': '*/0' });
    if (url.pathname === '/rest/v1/registration_attempts' && method === 'POST') return json([]);
  }
  const message = `Unexpected offline test request: ${method} ${url.origin}${url.pathname}`;
  unexpectedRequests.push(message);
  throw new Error(message);
};
process.on('exit', () => {
  if (unexpectedRequests.length || !checkedPrice) {
    console.error(unexpectedRequests.length ? unexpectedRequests.join('\n') : 'Pricing assertion was not reached.');
    process.exitCode = 1;
  }
});
