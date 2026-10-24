# Security, deployment, and data-integrity review

Status: remediation is in progress. This branch is not production-ready and has not received a live deployment or API integration test.

## Confirmed findings in the original `main`

1. The primary and secondary login gates accepted universal PINs and performed credential checks in the browser.
2. The leader passcode defaulted to `1234`; user records without a passcode were assigned that fallback.
3. API routes exposed state, user switching, passcode changes, user/settings writes, and backup restore without server-side authentication middleware.
4. The state endpoint returned user records directly, potentially including passcodes.
5. CORS allowed every origin.
6. Mutable state was stored in a JSON file. Write errors were logged but not propagated to callers.
7. The frontend fell back to local/sample data on API failure and could show a successful sync even when no server sync occurred.
8. `vercel.json` used a Vite static build and an SPA catch-all while `server.ts` depended on a long-lived Express listener and a writable local JSON file.
9. `data/database.json` is tracked in the public repository and includes user/student contact fields. Removing a default PIN does not remove historic copies from Git history or make the remaining records private.

## Implemented on this branch

- Added signed, expiring HMAC session cookies, a server-side login endpoint, logout, and authentication middleware for protected API routes.
- Added a leader-only guard for user management, settings, backup, grading configuration, and account switching; passcode changes are restricted to the current user or leader.
- Removed universal/default PIN acceptance and removed the default leader PIN from the tracked JSON and bundled initial data. Existing staff accounts without explicit PINs must be provisioned before use.
- Changed both login gates to call the server authentication endpoint instead of checking PINs in the browser.
- Redacted passcodes from state and selected user/settings responses.
- Restricted CORS to an explicit origin allowlist and reduced the JSON body limit to 5 MB.
- Changed data refresh to report local fallback as a failed server sync instead of a successful sync.
- Added CI for locked dependency installation, TypeScript type-checking, and Vite build.
- Added deployment/storage and authentication configuration notes.

## Remaining high-priority work

### Authentication and authorization
- Add a shared/distributed login rate limiter; the current branch does not implement brute-force throttling.
- Replace plaintext PIN storage with a password-hashing scheme and a tested reset/recovery workflow.
- Complete authorization per role and per circle/student scope. The current leader-only guard is not a complete permissions matrix.
- Make all audit events use the authenticated request identity rather than the JSON database's global `currentUser`.
- Review every API response and backup path for sensitive data; the current redaction is not a complete data-classification review.

### Durable storage and migration
- Select and provision a managed PostgreSQL database.
- Design and test an idempotent migration from JSON to relational tables, including relationship validation and rollback.
- Replace whole-file read/modify/write operations with transactions.
- Remove operational data from the deployment path only after a verified migration and backup.
- Assess the privacy implications of personal records already present in public Git history; repository file changes alone do not erase history.

### Vercel and runtime validation
- Refactor the Express entry point into the currently supported Vercel deployment shape and route `/api/*` separately from the SPA fallback.
- Replace JSON-file persistence before deploying the API to a serverless environment.
- Configure `SESSION_SECRET` and `GHAYM_INITIAL_LEADER_PASSCODE` in Preview/Production environment settings, never in Git.
- Test login, logout, unauthorized requests, role boundaries, API read/write, and data persistence in a Vercel Preview deployment.

### Reliability and tests
- Many mutation handlers in the frontend still show success before confirming server persistence; they need a shared request layer and failure-state handling.
- Add automated API/security/migration tests. The current CI only type-checks and builds; it does not exercise runtime security behavior.

## Verification status

The GitHub Actions CI run at https://github.com/yrplay/-yr/actions/runs/40083586514 completed successfully for dependency installation, TypeScript type-check, and frontend build on commit `9995b03b1a3a71ab70d2ab2f93a43efe03e40338`. This is evidence only for those CI steps at that commit, not for later commits or runtime behavior. The latest branch head still needs its own completed CI result, and no API integration test, migration test, browser test, or live Vercel Preview test has been run.
