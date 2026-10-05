# Database and access policies

`migrations/20261005000000_application_baseline.sql` is a fresh-install baseline recovered from the existing Supabase application's catalog on 2026-10-05. It includes all seven public application tables, types/defaults, constraints, indexes, four functions, grants, RLS, the private Storage bucket and Realtime publication membership.

It contains **no customer rows, Auth users, documents, credentials, Vault values or scheduled jobs**. Supabase-managed Auth/Storage schemas are provided by the platform and are not recreated by this file.

## Fresh development installation

Use a new Supabase project. Apply the baseline through the SQL editor, or link the CLI to that development project and run `supabase db push`. Check the selected project ref before applying it. The baseline intentionally fails if the application tables already exist; it is not an upgrade/reset script.

**Do not apply this baseline to existing production.** The three files in `history/` preserve already-applied production migrations as reference and are outside the executable migrations directory. The root `schema_update.sql` is an older incremental reference, not the complete installer. For future changes, add a new reviewed migration after the baseline.

## Access map

| Object | Browser access | Privileged server access |
| --- | --- | --- |
| `shop_members` | Authenticated user can read their own active memberships | Manage verified ownership/agent membership |
| `shops` | Active members can read their own shop | Public field whitelist, shop configuration and billing after authorization |
| `orders` | Active members can read their shop's orders | Validate customer capabilities, inspect documents, commit and change state |
| `platform_admins` | No browser table access | Determine platform role |
| `registration_attempts`, `print_request_limits` | No browser access | Abuse/rate-limit bookkeeping |
| `print_upload_intents` | No browser table access | Create and consume exact-object capabilities |
| Four SQL functions | No `anon`/`authenticated` execute permission | `service_role` and database administrator only |
| `print-jobs` | No general read/write/list/delete policy | Issue exact-file signed upload/download capabilities after authorization |

All seven application tables have RLS enabled. `shops` and `orders` belong to the Realtime publication. The bucket is private, capped at 50 MB, and allows PDF, PNG, JPEG and ZIP MIME types. Supabase's inherited default privileges still need explicit revokes/grants and RLS in any future table migration.

## Cleanup definitions

`configure_print_cleanup` is preserved from production and contains the existing production worker URL. Defining it does not schedule anything. Do not call it in development. Configure an environment-specific scheduler separately.

`delete_old_print_jobs` is a restricted legacy metadata-only function, preserved for recovery completeness. Do not use it for physical object cleanup. The app's authenticated worker uses the Storage API, checks queue/status expiry and retains order metadata.

## Recovery confidence

The baseline was restored successfully into an empty isolated Supabase project and its catalog/access boundaries were compared with production metadata. The real-service integration tests then passed. This establishes a reproducible application schema, not a copy of the production service's full operational configuration. Auth provider settings, email delivery, payment settings, scheduler secrets and monitoring remain environment-specific.
