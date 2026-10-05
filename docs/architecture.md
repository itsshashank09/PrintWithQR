# Architecture

## Customer to shop

1. A QR link opens `/shop/:shopId` and reads a public, limited view of shop settings.
2. `/api/platform?action=upload_intent` allocates a random object path and stores a hashed, expiring upload capability.
3. The browser uploads only that object to the private `print-jobs` bucket using its signed upload URL.
4. Order creation checks the intent and actual uploaded content. PDF pages and prices come from server-side inspection and stored shop rates. ZIP jobs retain a pending price.
5. `commit_print_orders` locks the shop and upload intents, commits the batch and updates trial usage in one database transaction. Repeated submissions return the existing order IDs.
6. A customer token grants access to the matching batch's receipt/status metadata. It does not grant document downloads. The shop dashboard receives Realtime changes and obtains authorized, short-lived file URLs.

## Access boundaries

Supabase Auth verifies shop users. The server checks active `shop_members` rows or `platform_admins`; browser state does not establish those roles. RLS allows authenticated owners to read their own membership, shops and orders. Browser roles cannot write protected billing/admin fields or execute privileged order/cleanup functions.

Storage has no broad browser read/write policies. Uploads use exact-object signed capabilities; downloads go through server authorization. Server handlers use a privileged key, so every privileged request must check its own caller and shop scope. See the [database access map](../supabase/README.md).

## Queue and retention

Waiting jobs have a ten-minute queue lifetime. Taking a job into Printing and later completing/cancelling it follows the state rules in the API. File access also checks expiry before issuing a URL. The cleanup worker removes eligible objects through Storage, marks `file_deleted_at` and retains order history. Database-only deletion of Storage metadata is not a substitute for that worker.

## Subscriptions

Razorpay subscription order creation selects the amount on the server. Verification checks the HMAC and gateway order before updating the authorized shop. Subscription payments are separate from print-job payment: this project does not imply that every document is paid through Razorpay.

## Tradeoffs

The app retains two API roots for the existing Vercel layouts; parity is enforced in CI. Public pages are generated during the frontend build, while customer and shop screens use React. Fingerprint and bot signals assist abuse detection but are not a permanent device identity. Further work includes broader browser verification, payment sandbox coverage and operation of environment-specific cleanup schedules.
