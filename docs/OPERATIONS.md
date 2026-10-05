# Development tools and releases

`npm run doctor` checks local prerequisites. `npm run gh -- <arguments>` and `npm run vercel -- <arguments>` wrap installed CLIs and reuse existing local authentication without printing a token. The GitHub wrapper supports a locally installed `gh` or an ignored portable copy at `.tools/gh/bin/gh.exe` on Windows.

Use a separate development Supabase project and Razorpay test credentials. Start from [setup](setup.md) and [verification](verification.md). Real keys belong in ignored local environment files or the hosting provider, not GitHub documents.

The deployment Action runs only through workflow dispatch and defaults to preview. Main-branch automatic Vercel deployment is disabled in both project layouts. Choose production only for a deliberate approved release after checking the branch, environment and database compatibility. The recovered database baseline is for fresh databases and must not be reapplied to existing production.
