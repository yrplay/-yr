# Deployment and storage decision

## Preferred target

Keep the frontend and API on Vercel if the API can be refactored to the currently supported Express deployment shape and validated in a Vercel Preview deployment. The current `server.ts` starts its own listener and persists mutable data to `data/database.json`; neither the local file nor the current SPA catch-all should be treated as the production persistence/routing design.

Target shape:
- Vercel serves the Vite frontend and routes `/api/*` to a supported Express/Vercel function entry point.
- The API is exported in a form Vercel supports; it does not rely on a long-lived manually opened listener.
- PostgreSQL is the system of record; Vercel's filesystem is not used for durable mutable application data.
- Credentials are stored only in environment variables, separately for Preview and Production.
- A Preview deployment is tested before changing production configuration.

Vercel's current Express guide: https://vercel.com/kb/guide/ship-a-express-app-on-vercel
Vercel backend platform overview: https://vercel.com/backends

## Managed PostgreSQL comparison

| Option | Cost profile | Fit |
| --- | --- | --- |
| Neon PostgreSQL | Usage-based compute and storage; no base fee on the Launch plan according to its published comparison | Preferred initial candidate for a low/variable-traffic app, subject to region, backup, and connection-pooling verification |
| Supabase PostgreSQL | Free tier advertises 500 MB database storage and can pause inactive projects; Pro starts at $25/month and includes additional managed features | Good alternative if its integrated platform features are useful, but account for the fixed plan and project compute costs |

Official pricing references (re-check before provisioning):
- Neon: https://neon.tech/pricing
- Supabase: https://supabase.com/pricing
- Supabase billing details: https://supabase.com/docs/guides/platform/billing-on-supabase

**Provisional choice: Neon PostgreSQL.** The app's traffic and storage needs have not yet been measured, so this is a cost-profile recommendation, not a final capacity decision. Before provisioning, confirm the desired region, connection pooling, restore window, backup requirements, and expected monthly usage. Do not store production records in a free tier without checking its inactivity, backup, and recovery limits.

## Data migration requirements

1. Export and checksum the current JSON database without modifying the source.
2. Design relational tables and a mapping for users, circles, students, plans, attendance, exams, results, settings, and audit logs.
3. Run an idempotent migration against a disposable database.
4. Compare record counts and key relationships, then test representative read/write workflows.
5. Take a verified backup before any production cutover; keep rollback instructions.
6. After cutover, remove the operational JSON file from the deployment path only when the new database is verified. Public Git history may still contain older copies of tracked data, so assess exposure separately.

## Current branch verification boundary

The current branch adds signed, expiring cookie sessions, server-side authentication middleware, a leader-only guard for administrative endpoints, removal of universal/default PIN fallbacks, response redaction, and CI type-check/build steps. These changes are not a complete security certification: rate limiting, per-circle authorization, password hashing, migration, and Vercel Preview API testing remain outstanding.

Required runtime configuration for the current authentication patch:
- `SESSION_SECRET`: random secret of at least 32 characters.
- `GHAYM_INITIAL_LEADER_PASSCODE`: one-time/initial leader credential while the leader account has no stored passcode. Set a unique value in environment settings, not in Git.
- `ALLOWED_ORIGINS`: only needed for exact trusted origins when frontend and API use different origins.

Do not deploy the branch until these values are configured and the login/API flow is tested in Preview.
