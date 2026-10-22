# Sugrpay front end

The Sugrpay web app: **one** Next.js app on **one** address. It talks to the
backend — [primeshelfspace/platform](https://github.com/primeshelfspace/platform)
— over HTTP. Other products (HQ) have their own repositories.

| Address       | What it is                                               |
| ------------- | -------------------------------------------------------- |
| `/`           | Sugrpay: invoices, customers, payments, brand settings   |
| `/accounts/…` | Sign in, sign up, team, brands, locations, billing       |
| `/pay/…`      | The public page customers pay an invoice on (no sign-in) |

```
apps/
  sugrpay/                  the web app (Next.js)
    src/app/                pages: Sugrpay at /, /accounts/…, /pay/…
    src/accounts/           code used by the /accounts pages
    src/pay/                code used by the /pay pages (and their strict CSP)
    src/middleware.ts       sign-in gate for Sugrpay and /accounts; CSP for /pay
packages/
  ui/                       React components (toasts, pagination)
  kernel/                   money, validation, design tokens      ┐ copies of the
  platform-contracts/       roles, request schemas, session       │ backend's packages —
  invoicing-contracts/      invoice schemas, statuses, renderers  ┘ see packages/README.md
deploy/                     Amplify guide (amplify.md); server deploy (pm2 + nginx)
scripts/                    env loader, dependency check
```

**How it works, in depth:** [docs/architecture.md](docs/architecture.md) — sections, middleware,
how pages talk to the API, sign-up and onboarding, payment pages, shared packages.

**Live:** https://www.sugrpay.com (AWS Amplify, deploys on every push to `main`).

## Run it

You need **Node.js 22+** and **pnpm** (`corepack enable`), and the backend
running first — follow the platform repository's
[getting-started guide](https://github.com/primeshelfspace/platform/blob/main/docs/getting-started.md)
until `http://localhost:4000/health` answers.

```bash
pnpm install
cp .env.example .env      # Windows: Copy-Item .env.example .env
pnpm dev
```

Open **http://localhost:3000** and sign in as `owner@sugrpay.test` /
`sugrpay-dev-password` (the backend's demo data).

## How sign-in works

The backend issues a session token; the sign-in page (`/accounts/login`)
stores it in one httpOnly cookie, `platform_session`, which the app replays to
the API from the server — the token never reaches browser scripts. Everything
is on one address, so the cookie needs no `COOKIE_DOMAIN`.

What a user may do is decided by the backend on every request; the app only
hides what the API says the user cannot reach.

## Commands

| Command          | Does                                                |
| ---------------- | --------------------------------------------------- |
| `pnpm dev`       | Run the app, reloading on change                    |
| `pnpm build`     | Production build                                    |
| `pnpm typecheck` | TypeScript across the app and packages              |
| `pnpm check`     | Formatting, lint, dependency check, types and tests |

## Port in use?

Set `PORT` in `.env` and change the three `NEXT_PUBLIC_*_URL` addresses to
match. The backend must know them too (`ADMIN_PUBLIC_URL`,
`ACCOUNTS_PUBLIC_URL`, `PAYMENT_PUBLIC_URL` in its `.env`), because emails and
payment links point there.

## Deploying

- **Amplify:** [deploy/amplify.md](deploy/amplify.md).
- **A server with pm2 and nginx:** [deploy/README.md](deploy/README.md).

Deploy the backend first when a release changes the API.
