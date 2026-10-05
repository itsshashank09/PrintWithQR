# PrintWithQR frontend

The React interface for customers and print shops. The [main README](../README.md) describes the product and the [setup guide](../docs/setup.md) covers its API and Supabase requirements.

```sh
npm ci
npm run dev
npm run build
npm run lint
```

Use Node.js 22.12+ in the Node 22 release line. Vite serves the interface on port 5173 by default. Its `/api` proxy currently points to port 5000; the repository does not include a standalone server listening there.

The `api/` directory here contains copies of the root serverless handlers for deployments whose project root is `frontend/`. Keep both copies in sync until the deployment structure is consolidated.
