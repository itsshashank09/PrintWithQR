# Deployed source reconciliation

GitHub main was behind the newer CLI-deployed application. Reconciliation used the latest production deployment's file hashes rather than trusting its old Git commit metadata.

- Production deployment inspected: `dpl_AYXzwYrXnjUg9iJ3AeEsKrr5eicq`.
- Source type: Vercel CLI; the deployment metadata named main commit `ea93d43019d7622ece067aac76353e65b2e6b732`.
- The owner's saved checkout contained the newer uncommitted source. Every one of the deployment's **84 source files** matched that checkout's SHA-1 file ID.
- The remaining deployment-tree entries were empty directories or generated output. They did not provide evidence of a source mismatch.
- That source, its root API counterparts, lockfiles, build tools and tests were recovered into the existing PR branch. The original saved checkout was retained.

[The source manifest](deployment-source-manifest.json) records the comparison. Subsequent changes in this PR update documentation, add the recovered database baseline and isolated test harness, and disable automatic deployment from main. Those changes are intentionally newer than the inspected deployment.

## Merge and deployment policy

The existing Vercel project is connected to GitHub main. Both `vercel.json` files set `git.deploymentEnabled.main` to `false`. The previous push-triggered production GitHub Action has been replaced by a manual workflow, defaulting to preview. Source reconciliation can therefore be merged without replacing the running production deployment.

Production deployment is a separate action after review. The recovered baseline must not be pushed to production: the live database already contains those objects. The current live site remains the reference deployment until a deliberate release is approved.
