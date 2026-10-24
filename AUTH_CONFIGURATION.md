# Authentication configuration for Preview and Production

The current branch requires these server-side environment variables before the new login flow can be used:

- `SESSION_SECRET`: a cryptographically random value of at least 32 characters. Keep it private and separate per environment.
- `GHAYM_INITIAL_LEADER_PASSCODE`: a unique initial leader PIN. The current tracked database has no explicit passcodes for the listed staff, so this value is only a bootstrap credential for the leader account. Do not reuse a previous/default PIN.
- `ALLOWED_ORIGINS`: optional comma-separated exact origins only if the frontend and API use different origins. Same-origin requests do not require this setting.

Configure these values in the hosting provider's environment settings; do not commit real values to Git. After the leader logs in, assign unique passcodes to staff accounts using the authorized account-management flow, then remove or rotate the bootstrap credential as soon as a tested recovery process exists.

Do not deploy until the required variables are configured and the Preview login/session/API flow is tested. The existing JSON-file storage and Vercel routing still need to be replaced/validated before production use.
