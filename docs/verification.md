# Verification

## Local commands

```sh
# From frontend/
npm ci
npm run build
npm run lint

# From the repository root, after installing root dependencies
npm ci
node tests/security_tests.mjs

# The frontend-root deployment has a copy of the same test suite
cd frontend
node tests/security_tests.mjs
```

The security checks use dummy environment values and a mocked gateway response. They do not load `.env`, contact Supabase or create real payment orders. They cover rejected requests, signature checking, server-selected prices and order-token boundaries. They are not a full security audit.

## Manual checks requiring a development backend

| Flow | Expected result |
| --- | --- |
| Register a development shop | A shop record belongs to the authenticated owner |
| Open its QR upload link | Shop details and print options are shown |
| Submit a small test document | The dashboard receives the order |
| Change an order status | Customer status updates agree with the dashboard |
| Access another shop's data | Database policies and API authorization deny access |
| Submit an expired or modified order token | The API rejects it |
| Use Razorpay test checkout | A verified test payment updates the expected shop |

These integration checks need a complete development schema and reviewed policies. No live customer data or real payments are needed for the offline checks.
