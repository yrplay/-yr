# Security, deployment, and data-integrity review

Status: initial review; remediation is not complete and this application must not be treated as production-secure.

## Confirmed findings

1. `src/components/StaffLoginGate.tsx` accepts universal PINs `1234` and `0000`, checks credentials in the browser, and stores an authentication flag in `sessionStorage`.
2. `src/context/AppContext.tsx` and `server.ts` default the leader passcode to `1234`; `server.ts` also assigns that value to users without a passcode.
3. `server.ts` exposes `GET /api/state`, user switching, passcode changes, user/setting writes, and backup restore without visible server-side authentication or authorization middleware.
4. `GET /api/state` returns the database object directly; user records can include passcodes.
5. `server.ts` enables wildcard CORS and uses a JSON file for mutable application state. The write helper logs failures but does not report failure to callers.
6. `src/context/AppContext.tsx` falls back to cached/sample data and clears the error state when the API is unavailable. Many mutations ignore fetch failures and show success before confirming server persistence.
7. `vercel.json` forces a Vite static build and rewrites all routes to `/index.html`, while the Express server expects to run as a long-lived server and reads/writes a local JSON file. This configuration is not yet validated as a combined Vercel frontend/API deployment.
8. `data/database.json` is tracked in Git and includes user/student records and a default leader PIN. Treat it as potentially sensitive until every field is reviewed.

## Required remediation sequence

### P0 — Identity and access control
- Implement a server-side login endpoint and secure session mechanism; never trust a browser-only flag.
- Enforce authentication on every data endpoint and role-based authorization on sensitive operations.
- Remove universal/default credentials only as part of a safe credential-provisioning and recovery flow. The currently tracked database has no explicit passcodes for its listed users, so removing the fallback without provisioning would lock out existing users.
- Redact passcodes and other secrets from all API responses and backup flows.
- Add login throttling and security event logging.

### P0 — Durable storage and migration
- Choose a managed PostgreSQL provider after checking current pricing, region, connection pooling, backup/restore and operational limits.
- Design and test an idempotent migration from the current JSON shape before changing the production data path.
- Replace whole-file read/modify/write operations with transactional, validated repository methods.
- Keep database credentials in deployment environment variables only.

### P1 — Vercel architecture
- Make the Express application exportable as a Vercel-compatible function and configure static asset delivery separately; Vercel Functions do not serve files via Express `express.static()`.
- Keep `/api/*` routing separate from SPA fallback.
- Validate preview deployments with real API requests before considering production deployment.

### P1 — Reliability and tests
- Propagate HTTP and persistence failures to the UI; do not show success until the server confirms the write.
- Add tests for unauthorized access, role boundaries, secret redaction, failed writes, concurrent writes, migrations, backup/restore and API routing.
- Run type-check/build in CI. Add test execution to CI once the test suite exists.

## Verification status

No build, type-check, browser test, API integration test, migration test, or live deployment test is claimed by this review. The CI workflow added alongside this document is intended to run type-check and frontend build on GitHub Actions; its results must be inspected after it runs.
