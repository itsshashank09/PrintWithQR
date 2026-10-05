import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';

// Configure dummy values before importing handlers. Never load a real .env file.
Object.assign(process.env, {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'offline-test-service-key',
  SUPABASE_ANON_KEY: 'offline-test-public-key',
  RAZORPAY_KEY_ID: 'offline-test-key',
  RAZORPAY_KEY_SECRET: 'offline-test-secret',
  ORDER_SESSION_SECRET: 'offline-order-secret',
  CRON_SECRET: 'offline-cron-secret'
});
delete process.env.REQUEST_LOG_SECRET;

let gatewayAmount = null;
let gatewayCalls = 0;
globalThis.fetch = async (url, options) => {
  assert.equal(url, 'https://api.razorpay.com/v1/orders', 'Unexpected network request');
  assert.notEqual(gatewayAmount, null, 'Network access is blocked outside the pricing test');
  assert.equal(options.method, 'POST');
  const order = JSON.parse(options.body);
  assert.equal(order.amount, gatewayAmount);
  assert.equal(order.currency, 'INR');
  gatewayCalls += 1;
  return { ok: true, json: async () => ({ id: 'order_offline', ...order }) };
};

const { default: verifyPayment } = await import('../api/verify-payment.js');
const { default: login } = await import('../api/login.js');
const { default: createOrder } = await import('../api/create-order.js');
const { default: updateShop } = await import('../api/update-shop.js');
const { default: deleteShop } = await import('../api/delete-shop.js');
const { default: cleanup } = await import('../api/cleanup.js');
const { signOrderCapability, verifyOrderCapability } = await import('../api/create-print-order.js');

function response() {
  return {
    statusCode: 200, body: null, headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; }
  };
}
async function invoke(handler, body = {}, headers = {}, method = 'POST') {
  const res = response();
  await handler({ method, headers, body }, res);
  return res;
}

for (const [name, handler] of [['update-shop', updateShop], ['delete-shop', deleteShop]]) {
  test(`${name} rejects requests without authorization`, async () => {
    const res = await invoke(handler, { shopId: 'shop_offline' });
    assert.equal(res.statusCode, 401);
  });
}

test('payment verification rejects malformed and forged signatures', async () => {
  for (const signature of ['short-signature', '0'.repeat(64)]) {
    const res = await invoke(verifyPayment, {
      razorpay_order_id: 'order_offline', razorpay_payment_id: 'pay_offline',
      razorpay_signature: signature, shopId: 'shop_offline'
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
  }
});

test('subscription prices come from the server even when the client sends another amount', async () => {
  try {
    for (const [plan, amount] of [['monthly', 9900], ['yearly', 59900]]) {
      gatewayAmount = amount;
      const before = gatewayCalls;
      const res = await invoke(createOrder, { plan, amount: 1 });
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.amount, amount);
      assert.equal(res.body.order_id, 'order_offline');
      assert.equal(gatewayCalls, before + 1, 'The gateway mock must actually be called');
    }
  } finally { gatewayAmount = null; }
});

test('login fails closed when its logging secret is missing', async () => {
  const res = await invoke(login, { phone: '9999999999', password: 'offline-only' });
  assert.equal(res.statusCode, 500);
});

test('cleanup rejects missing and incorrect cron authorization', async () => {
  for (const headers of [{}, { authorization: 'Bearer wrong' }]) {
    assert.equal((await invoke(cleanup, {}, headers, 'GET')).statusCode, 401);
  }
});

test('order capability is accepted only for its intended shop', () => {
  const token = signOrderCapability('shop_offline');
  assert.equal(verifyOrderCapability(token, 'shop_offline').valid, true);
  assert.equal(verifyOrderCapability(token, 'another_shop').valid, false);
});

test('order capability rejects missing, modified and expired tokens', () => {
  const token = signOrderCapability('shop_offline');
  const [payload] = token.split('.');
  assert.equal(verifyOrderCapability(null, 'shop_offline').valid, false);
  assert.equal(verifyOrderCapability(`${payload}.${'0'.repeat(64)}`, 'shop_offline').valid, false);
  const expired = Buffer.from(JSON.stringify({
    shopId: 'shop_offline', action: 'create_print_order', exp: Date.now() - 1000
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', process.env.ORDER_SESSION_SECRET)
    .update(expired).digest('hex');
  assert.equal(verifyOrderCapability(`${expired}.${signature}`, 'shop_offline').valid, false);
});
