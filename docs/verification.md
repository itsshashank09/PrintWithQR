# Verification

## Reproducible checks

From the repository root:

```sh
npm run setup
npm run check
```

`check` verifies both API roots, runs lint, offline workflow tests, SEO checks and the production build. Offline tests use dummy credentials and controlled responses; they do not create payment orders or contact production. Lint currently passes with existing warnings.

## Isolated Supabase integration

Apply the baseline to a new disposable Supabase project. Create an ignored `.env.integration.local` in the repository root with:

```text
SUPABASE_URL=https://<development-ref>.supabase.co
SUPABASE_ANON_KEY=<development-public-key>
SUPABASE_SERVICE_ROLE_KEY=<development-server-key>
TEST_SUPABASE_PROJECT_REF=<development-ref>
```

Then run `npm run test:integration`. The script requires that exact project URL/ref, rejects the original production ref, has no remote/production mode and never loads application `.env`. It creates synthetic users, shops and small PDFs, executes the repository's real API handlers against Supabase Auth/Postgres/Storage, and removes its fixtures in `finally`. Use a disposable project because cleanup reads the test project's eligible records.

On 2026-10-05, all **47 checks passed** after restoring the baseline into a separate Supabase project. Coverage included authenticated membership, exact-object multipart upload, private Storage restrictions, cross-shop denial, server PDF pricing, batch receipt isolation, idempotency, RLS, privileged RPC denial, status transitions, expiry and authenticated file cleanup.

The restored catalog matched the recovered seven tables, 66 columns, 19 constraints, 12 indexes, three RLS policies, table grants, function execution grants, private bucket and two Realtime publication tables. Function bodies matched after normalizing line endings; PostgreSQL renders CHECK parentheses differently between catalog formatting modes.

## Scope still requiring verification

The integration harness exercises real services through source handlers; it does not test a deployed Vercel HTTP stack or a complete browser journey. Razorpay checkout/webhooks, SMTP, live Realtime delivery, malformed image/ZIP combinations and load behaviour require separate checks. Offline suites cover additional ZIP/image/queue edge cases, but that is not evidence of full hosted workflow coverage.

No production users, documents, payment orders or database rows were used as test fixtures. Scheduler secrets and jobs were not copied or activated in the development project.
