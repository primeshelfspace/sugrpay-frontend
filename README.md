# Sugrpay front end

Every Sugrpay web app. They talk to the backend —
[primeshelfspace/platform](https://github.com/primeshelfspace/platform) —
over HTTP, and share one sign-in.

| App               | What it is                                                   | Address               |
| ----------------- | ------------------------------------------------------------ | --------------------- |
| **Accounts**      | Sign in, sign up, team, brands, locations, billing, launcher | http://localhost:3002 |
| **Sugrpay admin** | Invoices, customers, payments, brand settings, integrations  | http://localhost:3000 |
| **Payment pages** | Public pages customers pay invoices on                       | http://localhost:3001 |
| **HQ**            | Placeholder — not built yet                                  | —                     |

```
apps/
  accounts/               Accounts (Next.js)
  invoicing/              Sugrpay admin (Next.js)
  payment/                public payment pages (Next.js)
  hq/                     HQ (placeholder)
packages/
  ui/                     React components shared by the apps
  kernel/                 money, validation, design tokens      ┐ copies of the
  platform-contracts/     roles, request schemas, session       │ backend's packages —
  invoicing-contracts/    invoice schemas, statuses, renderers  ┘ see packages/README.md
deploy/                   staging deploy (pm2 + build-slot script)
scripts/                  env loader, dependency check
```

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

`pnpm dev` builds the shared packages, then starts all three apps. Open
**http://localhost:3002** and sign in as `owner@sugrpay.test` /
`sugrpay-dev-password` (the backend's demo data). **Open Sugrpay** from the
launcher takes you into the admin app, still signed in.

## How sign-in works

The backend issues a session token; Accounts stores it in one httpOnly cookie,
`platform_session`, which every app reads and replays to the API from the
server — the token never reaches browser scripts. Sugrpay has no sign-in page
of its own: its middleware forwards `/login`, `/signup`, `/set-password` and
the other auth pages to Accounts, which sends the user back afterwards.

- **Locally** every app is on `localhost`, and browsers share cookies across
  ports — nothing to configure.
- **In production** set `COOKIE_DOMAIN` to the parent domain (for example
  `.primeshelfspace.com`) so the cookie reaches every app's subdomain.

What a user may do is decided by the backend on every request; the apps only
hide what the API says the user cannot reach.

## Commands

| Command                                    | Does                                                |
| ------------------------------------------ | --------------------------------------------------- |
| `pnpm dev`                                 | Run every app, reloading on change                  |
| `pnpm build`                               | Production build of every app                       |
| `pnpm typecheck`                           | TypeScript across every app and package             |
| `pnpm check`                               | Formatting, lint, dependency check, types and tests |
| `pnpm --filter @platform/accounts-web dev` | Run one app only                                    |

## Ports in use?

Set `ADMIN_PORT`, `PAYMENT_PORT` or `ACCOUNTS_PORT` in `.env`, and change the
matching `NEXT_PUBLIC_*_URL`. The backend must also know the new Accounts
address (`ACCOUNTS_PUBLIC_URL` in its `.env`) because set-password emails link
there.

## Deploying

`bash deploy/deploy.sh` on the server builds every app beside the live one and
switches pm2 over only when all of them built. Deploy the backend first when a
release changes the API.
