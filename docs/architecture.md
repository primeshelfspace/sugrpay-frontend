# How the Sugrpay web app works

For someone taking over the front end. The backend has its own guide:
[platform/docs/developer-guide.md](https://github.com/primeshelfspace/platform/blob/main/docs/developer-guide.md),
and the live system is described in
[platform/docs/operations/production.md](https://github.com/primeshelfspace/platform/blob/main/docs/operations/production.md).

## 1. One app, three sections

`apps/sugrpay` is a single Next.js 15 app (App Router, React 18, Tailwind) on
one address:

| Path          | Section                                                                        | Who              | Code                                                               |
| ------------- | ------------------------------------------------------------------------------ | ---------------- | ------------------------------------------------------------------ |
| `/`           | Sugrpay admin: dashboard, invoices, customers, payments, brand settings, users | signed-in staff  | `src/app/(app)/`, `src/app/brands/`, `src/components/`, `src/lib/` |
| `/accounts/…` | Sign in, sign up, set/reset password, team, brands, locations, billing         | everyone / staff | `src/app/accounts/`, `src/accounts/`                               |
| `/pay/…`      | The page a customer pays an invoice on (no sign-in)                            | the public       | `src/app/pay/`, `src/pay/`                                         |

Live at https://www.sugrpay.com (AWS Amplify). Locally at http://localhost:3000.

```
apps/sugrpay/src/
  middleware.ts              routes every request to its section's rules (below)
  app/
    layout.tsx               the page shell: font, global CSS, toasts
    globals.css              Tailwind + shared styles (incl. invoice print rules)
    (app)/                   the signed-in admin; layout.tsx checks the session
                             and onboarding on every render, renders AdminShell
    brands/                  onboarding: company details, structure, brands
    welcome/, awaiting-setup/  public landing; "your admin must finish setup"
    accounts/                Accounts pages; accounts/(app)/ = signed-in part
    pay/                     public payment pages: /pay/i/<token>, …/invoice
  lib/                       admin: API client, session, onboarding, permissions…
  components/                admin: shell, dashboard widgets, UI pieces
  hooks/                     admin hooks
  accounts/{lib,components,hooks}   the same, for /accounts
  pay/                       pay/lib (API address, invoice fetch) and pay/middleware.ts
packages/
  ui/                        shared React components (toasts, pagination)
  kernel/, platform-contracts/, invoicing-contracts/
                             COPIES of the backend's packages — never edit here
```

## 2. How a page talks to the API

The browser never holds an API token. This is a **backend-for-frontend**:

1. **Sign-in** (`src/app/accounts/login/actions.ts`, a server action) calls
   `POST /auth/login` and stores the returned token in an **httpOnly cookie**,
   `platform_session` (`src/accounts/lib/session.ts`). Browser scripts cannot
   read it.
2. **Every page and form runs on the server** (React Server Components and
   server actions — files with `'use server'`). They read the cookie and call
   the API with `Authorization: Bearer <token>`:
   - admin: `src/lib/api.ts` (`apiFetch` + about 80 typed functions),
   - Accounts: `src/accounts/lib/api.ts`,
   - payment pages: `src/pay/lib/invoice.ts` (public, no token).
3. A `401` from the API means the session is over → back to
   `/accounts/login?expired=1`.

So there is no client-side data library: data is fetched on the server per
request (`cache: 'no-store'`), and forms post to server actions that call the
API and return either a redirect or an error message for the form
(`useActionState` + `useFormStatus`). The HTTP status you see in the browser
for a server action is always 200 — the API's own status travels inside the
response as the result.

The API address is `NEXT_PUBLIC_API_URL`. Like every `NEXT_PUBLIC_*` value it
is **built into the app**: change it in Amplify, then rebuild.

## 3. The middleware (`src/middleware.ts`)

Runs before every page, and only checks for the cookie (it cannot ask the API —
that happens in the layouts):

| Path                                   | Rule                                                                                                                                                                                                                                                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/pay/…`                               | `src/pay/middleware.ts`: a fresh **nonce-based Content-Security-Policy** on every request (only our scripts, Stripe's, and the configured asset/gateway origins), so the payment page stays inside PCI SAQ A scope. `src/app/pay/layout.tsx` reads the nonce, which is what lets Next's own scripts run. |
| `/accounts/…`                          | `src/accounts/middleware.ts`: public pages (login, signup, forgot/set password, terms, privacy) pass; the rest need the cookie.                                                                                                                                                                          |
| `/login`, `/signup`, … (old addresses) | redirected to `/accounts/…`                                                                                                                                                                                                                                                                              |
| `/welcome`                             | public                                                                                                                                                                                                                                                                                                   |
| everything else                        | needs the cookie, else → `/accounts/login?next=<page>`                                                                                                                                                                                                                                                   |

`next.config.mjs` adds stricter headers under `/pay` (no referrer, HSTS,
`no-store`) and normal security headers elsewhere.

## 4. The signed-in admin

`src/app/(app)/layout.tsx` runs on every navigation:

1. `getCurrentUser()` — the API decides if the session is real (a cookie is not
   a session).
2. If the user must set a password → `/accounts/set-password`.
3. **Onboarding** (`src/lib/onboarding.ts`): computed from real data each time
   — no stored "step" — so it can never drift. Missing company details →
   `/brands/new`; no brand structure → `/brands/structure`; multi-brand with no
   brands → `/brands/multi`; a user whose role cannot finish setup →
   `/awaiting-setup`.
4. A user without a Sugrpay role is sent to Accounts.
5. Renders `AdminShell` (`src/components/admin-shell.tsx`): sidebar, brand
   switcher (`?brandId=` in the URL), profile menu, sign-out.

What a user may do comes from the API (`user.permissions`);
`src/hooks/use-permissions.tsx` and `src/lib/permissions.ts` only hide what
they cannot reach — the API enforces it.

Pages: dashboard (`(app)/page.tsx` + `components/dashboard/*`), invoices
(list, drawer, create, send), customers, payments (incl. check review),
brand settings (details, email receipt, invoice PDF, payment page,
integrations, gateways), users, status. OAuth connects (Stripe, Square, Zoho)
go through route handlers under `(app)/settings/*/connect`
(`src/lib/oauth-connect.ts`): the server fetches the provider address from the
API with the token, then redirects the browser to the provider.

## 5. Accounts (`/accounts`)

Sign-up is a multi-step flow (the API side is in the backend's
`docs/operations/production.md` §8):

1. `/accounts/signup` — name + email → API creates the company and emails a
   set-password link → `/accounts/check-inbox`.
2. The email link → `/accounts/set-password?token=…` → password set, signed in
   → Sugrpay → onboarding (§4).

The signed-in part (`src/app/accounts/(app)/`) has the launcher, Team
(invite, roles, brands, locations, suspend), Brands (read-only), Locations
and Billing (switch the Sugrpay subscription). It uses its own API client and
components in `src/accounts/`.

## 6. Payment pages (`/pay`)

`/pay/i/<token>` — the token is the 32-character secret in the invoice's
payment link. `src/pay/lib/invoice.ts` fetches `GET /public/invoices/<token>`
on the server; the page (`src/app/pay/i/[token]/`) shows the invoice and the
brand's accepted methods:

- **Card / wallet** — Stripe Elements in Stripe's own iframe
  (`stripe-card-form.tsx`), against the brand's connected Stripe account; card
  data never touches our servers. After confirming, the browser asks the API to
  reconcile with Stripe in case the webhook is slow.
- **ACH** — through the gateway, via the API.
- **Check** — the customer uploads front/back images (`check-upload-form.tsx`);
  staff approve them in Payments.

`…/invoice` shows the printable invoice; the PDF comes from the API.
Keep this section's dependencies minimal: ESLint forbids it from importing the
admin contracts.

## 7. Shared packages

| Package                        | Owned by           | What                                              |
| ------------------------------ | ------------------ | ------------------------------------------------- |
| `packages/ui`                  | this repo          | toasts, pagination                                |
| `packages/kernel`              | **backend** (copy) | money, roles, tokens, Tailwind preset, validation |
| `packages/platform-contracts`  | **backend** (copy) | session cookie name, request schemas, roles       |
| `packages/invoicing-contracts` | **backend** (copy) | invoice statuses, schemas, email/PDF renderers    |

When the backend changes one of them, copy it over — see
[packages/README.md](../packages/README.md). Never edit the copies here.

## 8. Run, check, deploy

| Command      | Does                                                                          |
| ------------ | ----------------------------------------------------------------------------- |
| `pnpm dev`   | Builds the packages, runs the app on :3000 (the API must be running on :4000) |
| `pnpm check` | Formatting, lint, dependency check, types, package tests                      |
| `pnpm build` | Production build (what Amplify runs, via `amplify.yml`)                       |

Deploy = push to `main`; Amplify builds and serves it
([deploy/amplify.md](../deploy/amplify.md)). Settings are Amplify environment
variables (§2).

## 9. Things to know

- **No tests in the app itself** — only in the packages. A first worthwhile
  addition is a Playwright run through sign-in, invoice creation and the
  payment page.
- `/notifications` and parts of the customer drawer are placeholders
  ("coming soon").
- `src/lib/api.ts` and `src/accounts/lib/api.ts` define their own user types;
  they come from two former apps and could be merged.
- In dev mode the Next.js "N" badge sits over the sidebar's bottom-left
  (Sign out); it does not exist in production builds.
