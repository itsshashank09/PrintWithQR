# PrintWithQR frontend

React/Vite customer, shop and admin screens, plus build-generated public pages. Start from the [repository README](../README.md) for the complete app, database setup and verification.

From the repository root, `npm run setup` installs both lockfiles, `npm run dev:ui` starts Vite, and `npm run dev` starts the Vercel API development environment. Use Node.js 24 and a separate development Supabase project.

`api/` mirrors the root handlers for a frontend-root Vercel deployment. Run `npm run check:api` from the root before changing either copy. `vercel.json` disables main-branch automatic deployment; production releases use the manual GitHub workflow.
