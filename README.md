# PrintWithQR

A web app that lets customers send documents to a local print shop by scanning its QR code. The customer chooses print settings in the browser, and the shop manages the order from a dashboard.

**[Visit PrintWithQR](https://www.printwithqr.in/)** · [Setup](docs/setup.md) · [Architecture](docs/architecture.md) · [Verification](docs/verification.md)

![PrintWithQR landing page](docs/screenshots/landing.png)

## What it does

- Gives each shop a QR code linked to its upload page.
- Accepts PDFs and images, with document preview, copies, colour options and page selection. The browser applies a 100 MB limit per file.
- Shows incoming orders in a shop dashboard using Supabase Realtime.
- Supports shop registration, sign-in, print rates and subscription plans.
- Creates Razorpay subscription orders and checks payment signatures on the server.
- Issues short-lived, shop-specific tokens for submitting print orders.

Customers still need a print shop to fulfil the order. This repository does not include a desktop printer agent or direct printer integration.

## Stack

| Part | Technologies |
| --- | --- |
| Interface | React, JavaScript, React Router, Vite, CSS, Lucide icons |
| API | JavaScript serverless handlers on Vercel |
| Data | Supabase Postgres, Auth, Storage and Realtime |
| Payments | Razorpay Checkout and REST API |
| Other integrations | QRCode, FingerprintJS, BotD, PDF.js loaded by the page |

## Try it locally

Use Node.js 22.12 or newer within the Node 22 release line.

```sh
git clone https://github.com/itsshashank09/PrintWithQR.git
cd PrintWithQR/frontend
npm ci
npm run dev
```

Open the URL Vite prints, normally `http://localhost:5173`. This starts the **frontend only**. Shop registration, payments and order submission also need the API and a configured Supabase project. See [setup](docs/setup.md) for the environment variables and the current database setup gap.

```sh
npm run build
npm run lint
```

## Code worth reading

- [`api/create-print-order.js`](api/create-print-order.js): signed order tokens, subscription checks and server-side price calculation.
- [`api/verify-payment.js`](api/verify-payment.js): HMAC verification and payment-order lookup.
- [`frontend/src/pages/Upload.jsx`](frontend/src/pages/Upload.jsx): file preparation, preview and order submission.
- [`frontend/src/pages/Dashboard.jsx`](frontend/src/pages/Dashboard.jsx): order updates, file access and the shop workflow.

## Repository layout

```text
api/                  Serverless handlers when deploying from the repo root
frontend/
  api/                Handler copies for deployments rooted in frontend/
  src/pages/          Customer, shop and admin screens
  src/utils/          Payment, fingerprint and cleanup helpers
  public/             Branding, print page and crawler files
tests/                Offline API checks
docs/                 Setup, architecture and verification notes
schema_update.sql     An incremental update, not a complete database schema
```

## Current limitations

A fresh installation is not yet fully reproducible: the base database schema and Storage policies are not included. Client route guards also do not replace server authorization or database policies.

Fingerprinting supplies a browser identifier and bot signals; it is not a permanent hardware identity or a guarantee against abuse. Some order rate limits and retry tracking use process memory, so they do not coordinate across serverless instances. Storage access and document retention need review before handling sensitive files. See the [architecture notes](docs/architecture.md) for details.

## Licence

The project is proprietary, as stated in the original repository documentation. No open-source licence is granted by this README.
