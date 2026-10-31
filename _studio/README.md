# Private writing service

Production: https://jaehun-studio.manfromearth11.workers.dev
OAuth app: Jaehun Writing Studio (GitHub app settings ID 3979821).
Callback: https://jaehun-studio.manfromearth11.workers.dev/auth/callback

Run `npm ci`, `npm test`, and `npm run deploy` here. Wrangler authenticates to the
owner's Cloudflare account. Secrets GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET
are configured with Wrangler Secret, never committed. D1 schema is in schema.sql.
The database stores server-side GitHub tokens and expiring sessions. Daily cleanup
removes expired rows. Do not expose D1 queries or its credentials to the browser.

OAuth uses state bound to a Secure HttpOnly cookie, PKCE, and an allowlisted
numeric GitHub owner ID. Every private asset runs through the Worker first.
Mutation requests require same-origin and a CSRF token. A short-lived, one-time
bridge gives github.io a read-only navigation token; it cannot open the editor
or publish. It is stored in sessionStorage, so a new browser tab may require
visiting /login/ again. Logout revokes the server session and navigation tokens.

The OAuth public_repo permission allows public repository operations. Worker
publishing is hardcoded to manfromearth11/manfromearth11.github.io, _notes/ and
assets/notes/. Do not change this to accept arbitrary repositories or paths from
requests. Publish verifies the GitHub owner again and uses a non-forced atomic
Git ref update. A conflict must be retried instead of overwriting other work.

Tests use an in-memory SQLite database and mocked GitHub responses. They cover
private asset gating, CSRF, OAuth owner checks, one-time bridge exchange, logout,
HTML sanitization, and publication paths. They do not publish test posts.
