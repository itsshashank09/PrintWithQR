# Architecture and tradeoffs

## Customer flow

1. A shop QR code opens `/shop/:shopId`.
2. The upload page reads shop settings and requests a short-lived order token from `GET /api/create-print-order`.
3. Documents go to the Supabase `print-jobs` bucket.
4. `POST /api/create-print-order` checks the token's signature, expiry, action and shop ID. It calculates the price using stored shop rates and writes the order.
5. The customer can follow `/order/:orderId`; the shop dashboard receives order changes through Supabase Realtime.

The order token binds a request to a shop and time window. It is publicly issuable to eligible shops, so it is not proof of customer identity.

## Shop subscriptions

The browser requests a Razorpay order from `api/create-order.js`. The handler chooses the amount from its own monthly/yearly price table. `api/verify-payment.js` checks the signature with a constant-time comparison and looks up the gateway order before updating shop subscription data.

The current implementation includes subscription payments. Customer print-order creation is a separate workflow; the presence of a payment screen does not imply that every print job is charged through Razorpay.

## Access boundaries

- The browser uses a public Supabase key. Its table and Storage requests need reviewed policies.
- Server handlers use a privileged Supabase key and must perform their own authorization checks.
- React route guards check local browser state for navigation; they are not an access-control boundary.
- Admin screens make direct Supabase requests as well as API requests. An admin flag in browser storage must never be sufficient for database authorization.

## Known engineering work

- Version the complete schema, row policies, Storage rules and Realtime configuration.
- Consolidate the duplicated `api/` directories after settling the Vercel project root.
- Move rate-limit and idempotency state out of process memory for reliable coordination across instances.
- Reconcile upload code that calls `getPublicUrl` with dashboard code that requests signed URLs. Private customer documents require a consistent private-bucket design.
- Make document retention and cleanup scheduling agree.
- Replace the hardcoded fallback project configuration with an explicit development configuration.
- Review token storage, admin authorization and remaining lint warnings.

These are known gaps, rather than claims that the project has been audited or is ready for every production use case.
