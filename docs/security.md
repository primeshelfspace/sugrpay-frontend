# Security in the web app

The API enforces every permission; this app's job is to keep the session
token away from browser scripts and to make sure nothing a browser sends can
steer the server's own API calls. The API side, the full audit and the list of
what is still open are in
[platform/docs/security.md](https://github.com/primeshelfspace/platform/blob/main/docs/security.md).

| Rule                                                                                                                                                                                                           | Where                                                 | Tested in                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------- |
| The session token lives only in the httpOnly `platform_session` cookie; pages and server actions replay it to the API from the server. Browser code never imports the API client except as types.              | `src/accounts/lib/session.ts`, `src/lib/api.ts`       | —                                            |
| **The cookie is always `Secure` in a production build** (not dependent on proxy headers).                                                                                                                      | `src/accounts/lib/session.ts`                         | —                                            |
| **After sign-in the `?next=` address must stay on this site**: `/\evil.com`, `/<tab>/evil.com` and the like are ignored.                                                                                       | `packages/platform-contracts/src/session.ts` (copy)   | `session.test.ts` in the backend's contracts |
| **Every API path is checked before it is fetched**: no `..`, no `#`, no backslash, no encoded slash or dot — so an id taken from the URL cannot redirect a call to another endpoint.                           | `src/lib/request-guards.ts` → both `apiFetch`s        | `src/lib/request-guards.test.ts`             |
| **Route handlers check their ids are UUIDs; POST handlers refuse other sites** (`Sec-Fetch-Site`, else `Origin` vs host). Server actions get Next's own origin check.                                          | `src/app/(app)/settings/zoho/*/route.ts`              | `src/lib/request-guards.test.ts`             |
| **OAuth connects only ever redirect to the provider's consent screen** (Zoho, Stripe, Square) or the API itself; failures travel as fixed codes, and pages show only known messages, never text from the URL.  | `src/lib/oauth-connect.ts`, `brand-settings/page.tsx` | `src/lib/request-guards.test.ts`             |
| `/pay`: a fresh nonce Content-Security-Policy on every request, Stripe's card fields in Stripe's iframe, `no-store`, `no-referrer`.                                                                            | `src/pay/middleware.ts`, `next.config.mjs`            | —                                            |
| **Every page: HSTS, `nosniff`, `X-Frame-Options: DENY`, and a baseline CSP** (`frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`). No `X-Powered-By`, no production source maps. | `next.config.mjs`                                     | —                                            |
| **Check review: the reviewer types the amount on the check**; that is what is recorded.                                                                                                                        | `src/app/(app)/payments/check-review-drawer.tsx`      | API: `checks.service.test.ts`                |
| Next.js `^15.5.28` (past the middleware-bypass and RSC fixes).                                                                                                                                                 | `apps/sugrpay/package.json`                           | —                                            |

**Bold** = added in the October 2026 audit. Run the app's tests with
`pnpm --filter @platform/sugrpay-web test` (they also run in `pnpm check`).
