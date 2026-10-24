# Security, deployment, and data-integrity review

Status: the first hardening tranche is implemented on this branch. It is not production-ready: persistent PostgreSQL storage and a real Vercel Preview deployment remain outstanding.

## Confirmed findings in the original `main`

1. The primary and secondary login gates accepted universal PINs and performed credential checks in the browser.
2. The leader passcode defaulted to `1234`; user records without a passcode were assigned that fallback.
3. API routes exposed state, user switching, passcode changes, user/settings writes, and backup restore without server-side authentication middleware.
4. The state endpoint returned user records directly, potentially including passcodes.
5. CORS allowed every origin.
6. Mutable state was stored in a JSON file. Write errors were logged but not propagated to callers.
7. The frontend fell back to local/sample data on API failure and could show a successful sync even when no server sync occurred.
8. `vercel.json` used a Vite static build and an SPA catch-all while `server.ts` depended on a long-lived Express listener and a writable local JSON file.
9. `data/database.json` is tracked in Git and contains staff/student contact fields. Removing the current file does not remove historic copies from Git history.

## Implemented on this branch

- Added signed, expiring HMAC session cookies and server-side login/logout; protected API routes now require an authenticated session.
- Added leader-only guards for global configuration, users, backup, grading configuration, tracks, circles, students, plans, challenges, and exams.
- Added basic circle/student scope checks for selected teacher/supervisor writes and filtered state responses to the authenticated user's allowed circles.
- Removed universal/default PIN acceptance and the default leader PIN from server seed data, tracked JSON, and bundled initial data.
- Added salted scrypt PIN hashing, migration of legacy PINs on successful login, and a basic per-process login throttle. The throttle is not distributed across serverless instances.
- Changed both login gates to use the server login endpoint; added a minimal public login directory that omits contact fields.
- Removed private sample data from the client context fallback and clear cached private state on a 401 response.
- Redacted PINs from state, selected user/settings responses, and downloaded backups; backup restore preserves existing credential hashes by matching user IDs.
- Propagated JSON-file write failures as HTTP 500 for API mutations and stopped several account/settings/backup UI paths from claiming success before server confirmation.
- Exported the Express application and updated Vercel configuration to stage built Vite assets without a catch-all rewrite swallowing API routes.
- Added CI for locked install, type-check, static security/deployment guardrails, API integration checks, and frontend build.

## Remaining high-priority work

### Authentication and authorization
- Replace the in-memory login throttle with a shared/distributed limiter suitable for multiple serverless instances.
- Add a tested account recovery and credential rotation flow; ensure all users without a PIN are provisioned before rollout.
- Complete and independently review the permissions matrix for every API route and every role. Current scope checks are a first layer, not a full authorization certification.
- Review all audit events for consistent attribution to the authenticated actor.
- Add CSRF/origin hardening and broader response/data-classification tests.

### Durable storage and migration
- The API still uses `data/database.json`; no PostgreSQL provider has been provisioned and `DATABASE_URL` is not wired into the data layer yet.
- Design and test an idempotent migration, relationship validation, concurrency-safe transactions, backup/restore, and rollback before switching production data.
- Remove operational records from the deployment path only after a verified migration and backup.
- Assess the privacy implications of personal records already present in public Git history.

### Vercel and runtime validation
- The app is structured for Vercel Express detection, and static assets are staged by the configured build command, but this has not been verified in a Vercel Preview deployment.
- Replace JSON-file persistence before using serverless deployment for operational records.
- Configure `SESSION_SECRET` and `GHAYM_INITIAL_LEADER_PASSCODE` in Preview/Production environment settings, never in Git.
- Verify preview routing, login/logout, cookie behavior, persistence, file uploads, PWA assets, and API error handling.

### Reliability and tests
- Some mutation handlers still update local state or show success before the server confirms persistence; the request layer needs a systematic pass.
- CI's API integration script currently checks authentication, secret redaction, basic scope restrictions, logout cookie clearing, and salted PIN storage in an isolated temporary JSON file.
- No PostgreSQL migration test, browser end-to-end test, or live Vercel Preview test has been run.

## Verification status

GitHub Actions completed successfully for the API hardening branch at commit `79f70a1abbf4be3102694dbfc96b1e36c99104de`: dependency installation, TypeScript type-check, static guardrails, API integration checks, and frontend build all passed. Run details: https://github.com/yrplay/-yr/actions/runs/40086014356.

This result applies to that commit. Any subsequent code changes require a fresh CI result. The tests are not a security certification and do not verify PostgreSQL or Vercel runtime behavior.
