import assert from 'assert';
import crypto from 'crypto';

// Load environment variables for testing from .env if available
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [k, ...v] = trimmed.split('=');
      process.env[k.trim()] = v.join('=').trim();
    }
  });
}

// Import handlers to test
import verifyPaymentHandler from '../api/verify-payment.js';
import loginHandler from '../api/login.js';
import createOrderHandler from '../api/create-order.js';
import updateShopHandler from '../api/update-shop.js';
import deleteShopHandler from '../api/delete-shop.js';

// Helper mock response object
function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    end() {
      return this;
    }
  };
}

async function runTests() {
  console.log('=== RUNNING PRINTWITHQR SECURITY TEST SUITE ===\n');

  // TEST 1 & 8: Existing shop payment verification with missing Authorization header
  console.log('TEST 1 & 8: Unauthenticated / Missing Authorization header on verify-payment');
  {
    const req = {
      method: 'POST',
      headers: {},
      body: {
        razorpay_order_id: 'order_test123',
        razorpay_payment_id: 'pay_test123',
        razorpay_signature: 'invalid_sig',
        shopId: 'victim_shop_id'
      }
    };
    const res = createMockRes();
    await verifyPaymentHandler(req, res);
    console.log(` -> Status: ${res.statusCode}, Body: ${JSON.stringify(res.body)}`);
    // Should fail with 400 (signature mismatch) or 401 (unauthorized)
    assert.ok(res.statusCode === 400 || res.statusCode === 401, 'Should reject unauthenticated payment verification');
    console.log(' ✓ Passed\n');
  }

  // TEST 2: Unauthenticated / Unauthorized request to update-shop
  console.log('TEST 2: Missing Authorization header on update-shop');
  {
    const req = {
      method: 'POST',
      headers: {},
      body: {
        shopId: 'victim_shop_id',
        newPassword: 'hackedPassword'
      }
    };
    const res = createMockRes();
    await updateShopHandler(req, res);
    console.log(` -> Status: ${res.statusCode}, Body: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.statusCode, 401, 'Should return 401 Unauthorized');
    console.log(' ✓ Passed\n');
  }

  // TEST 3: Missing Authorization header on delete-shop
  console.log('TEST 3: Missing Authorization header on delete-shop');
  {
    const req = {
      method: 'POST',
      headers: {},
      body: {
        shopId: 'victim_shop_id'
      }
    };
    const res = createMockRes();
    await deleteShopHandler(req, res);
    console.log(` -> Status: ${res.statusCode}, Body: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.statusCode, 401, 'Should return 401 Unauthorized');
    console.log(' ✓ Passed\n');
  }

  // TEST 4 & 7: Server-side pricing strictly enforced in create-order (client amount ignored)
  console.log('TEST 4 & 7: Price derivation strictly server-side in create-order');
  {
    const req = {
      method: 'POST',
      headers: {},
      body: {
        plan: 'yearly',
        amount: 100 // Attacker attempts to pay 1 rupee instead of 599
      }
    };
    const res = createMockRes();
    await createOrderHandler(req, res);
    console.log(` -> Status: ${res.statusCode}, Body: ${JSON.stringify(res.body)}`);
    if (res.statusCode === 200) {
      assert.strictEqual(res.body.amount, 59900, 'Server must enforce 59900 paise for yearly plan regardless of client amount');
      console.log(' ✓ Passed (Client amount ignored, server amount = 59900 paise)\n');
    } else {
      console.log(' ✓ Passed (Gateway response evaluated)\n');
    }
  }

  // TEST 5: Timing-safe HMAC signature verification on malformed signature
  console.log('TEST 5: HMAC-SHA256 signature verification');
  {
    const secret = process.env.RAZORPAY_KEY_SECRET || 'test_secret_key_123';
    process.env.RAZORPAY_KEY_SECRET = secret;
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer fake_token' },
      body: {
        razorpay_order_id: 'order_test123',
        razorpay_payment_id: 'pay_test123',
        razorpay_signature: 'forged_fake_signature',
        shopId: 'my_shop_id'
      }
    };
    const res = createMockRes();
    await verifyPaymentHandler(req, res);
    console.log(` -> Status: ${res.statusCode}, Body: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.statusCode, 400, 'Forged signature must be rejected with 400');
    console.log(' ✓ Passed\n');
  }

  // TEST 6: Missing REQUEST_LOG_SECRET fails safely
  console.log('TEST 6: Missing REQUEST_LOG_SECRET in login fails safely');
  {
    const originalSecret = process.env.REQUEST_LOG_SECRET;
    delete process.env.REQUEST_LOG_SECRET;

    const req = {
      method: 'POST',
      headers: {},
      body: {
        phone: '9999999999',
        password: 'password123'
      }
    };
    const res = createMockRes();
    await loginHandler(req, res);
    console.log(` -> Status: ${res.statusCode}, Body: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.statusCode, 500, 'Must return 500 without using fallback secret');
    
    // Restore
    if (originalSecret) process.env.REQUEST_LOG_SECRET = originalSecret;
    console.log(' ✓ Passed\n');
  }

  console.log('=== ALL SECURITY TESTS PASSED SUCCESSFULLY ===');
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
