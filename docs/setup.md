# Local setup and configuration

## Frontend preview

From `frontend/`, run `npm ci` and `npm run dev`. The committed lockfile determines the installed versions. The installed Vite toolchain requires a newer Node version than the old README and deployment workflow specified; use Node 22.12+.

Copy `frontend/.env.example` to `frontend/.env.local` and set the public Supabase values for a development project. The current client also contains a fallback to the original public project configuration. Supply your own values before testing any data flows; do not use the live project for development.

## Environment variables

| Variable | Where it is used | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Browser build | Development Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser build | Public Supabase key; `VITE_SUPABASE_ANON_KEY` is also supported |
| `VITE_API_URL` | Some payment requests | Optional API base URL; other screens still use relative `/api` paths |
| `VITE_RAZORPAY_KEY_ID` | Browser checkout | Optional public key ID; normally returned by the API |
| `SUPABASE_URL` | API | Same project's server URL |
| `SUPABASE_SERVICE_ROLE_KEY` | API | Privileged server key, under the name currently read by the handlers |
| `SUPABASE_ANON_KEY` | API/Vite compatibility | Optional legacy public key fallback |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | API | Gateway credentials; use test mode during development |
| `REGISTRATION_SECRET` | API | HMAC secret for registration signals |
| `REQUEST_LOG_SECRET` | API | HMAC secret for login request logs |
| `ORDER_SESSION_SECRET` | API | HMAC secret for shop-bound order tokens |
| `CRON_SECRET` | API | Authorizes the cleanup handler |
| `ALLOWED_ORIGIN` | API | Additional allowed frontend origin |

Generate separate random server secrets, for example with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Keep secret values out of `VITE_*` variables and out of source control. Public Supabase keys rely on database and Storage policies for authorization; they do not protect data on their own. See [Supabase's key documentation](https://supabase.com/docs/guides/getting-started/api-keys).

## Database and Storage

`schema_update.sql` alters an existing `shops` table and creates `registration_attempts`. It does **not** create the complete application database. The code also references `orders` and `request_logs`, and relies on Supabase Auth users, a `print-jobs` Storage bucket and Realtime publication settings.

The base schema, complete row policies, Storage policies and publication configuration are not currently versioned. Obtain a reviewed schema export for a development project before trying the complete workflow. Do not run the incremental file against an empty database and expect a working installation. Do not enable broad anonymous access as a workaround.

## API development

`npm run dev` only starts Vite. The configured proxy forwards `/api` to `http://localhost:5000`, but no local backend process is supplied. For a complete local environment, use a Vercel development setup configured for either the repository root or `frontend/`, and adjust the frontend proxy to its actual port. Avoid proxy loops if the Vercel development command itself starts Vite.

The two `vercel.json` files support those two project-root layouts. The root build outputs `frontend/dist`; a frontend-root deployment uses `dist`. Verify which root your Vercel project uses before changing deployment settings. Do not run the production deploy command just to preview the interface.

## Cleanup

Both deployment configurations schedule `/api/cleanup` daily. The handler removes documents older than five minutes **when invoked** and orders from before the current day. The daily schedule is not a five-minute deletion guarantee. Use disposable files in a development bucket when checking this behaviour.
