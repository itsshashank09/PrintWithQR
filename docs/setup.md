# Local setup

## Install and preview

Use Node.js 24 and npm. From the repository root, run `npm run setup`, then `npm run dev:ui` for the interface only. Run `npm run dev` for the Vercel development environment on port 3000. Vite alone does not provide the API; its standalone proxy expects a backend on port 5000.

Create a separate Supabase project and apply the [fresh-install baseline](../supabase/README.md). Never use the production project for local tests. Copy `frontend/.env.example` to `frontend/.env.local` and supply your development values. PHP-style or client-side route guards do not replace database policies.

## Environment

| Variable | Scope | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Browser | Development Supabase URL and public key; `VITE_SUPABASE_PUBLISHABLE_KEY` is also supported |
| `VITE_API_URL` | Browser | API base; normally `/api` |
| `VITE_RAZORPAY_KEY_ID` | Browser | Optional public checkout key ID |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Server | Same development project's URL and public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Privileged key used only by authorized API handlers |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Server | Use Razorpay test mode in development |
| `REGISTRATION_SECRET` | Server | Hashes registration abuse signals |
| `REQUEST_LOG_SECRET` | Server | Hashes request/rate-limit identifiers |
| `ORDER_SESSION_SECRET` | Server | Signs compatibility order capabilities |
| `PRINT_CLEANUP_SECRET` | Server | Authenticates file cleanup; `CRON_SECRET` is a fallback |
| `ALLOWED_ORIGIN` | Server | Additional frontend origin, such as `http://localhost:3000` |

Generate a different random value for each signing secret. Keep server secrets out of `VITE_*` variables, Git and browser bundles. The client has no fallback connection to production when its public configuration is missing.

## Deployment layouts

The existing Vercel project is linked to this repository with no root-directory override. Repository-root deployment uses `vercel.json` and outputs `frontend/dist`. A project deliberately rooted in `frontend/` uses `frontend/vercel.json` and outputs `dist`. Both layouts use the same checked API source.

Main-branch automatic Git deployments are disabled in both configurations. The GitHub deployment workflow is manual, defaults to preview and requires an explicit production target. A future production release should be reviewed separately from a source or documentation merge.

## File cleanup

Pending jobs expire after ten minutes. Completed or manually cancelled files become eligible after ten minutes. The authenticated `/api/cleanup` worker removes eligible objects through the Storage API and preserves order rows. Timing depends on worker invocations and successful deletion; it is not an exact deletion deadline.

The recovered `configure_print_cleanup` SQL function references the existing production domain. **Do not invoke its configure action in development.** No cron job or Vault secret is installed by the baseline. The isolated test invokes the handler directly with a random test secret. For another hosted environment, provision an environment-specific scheduler and target URL separately.
