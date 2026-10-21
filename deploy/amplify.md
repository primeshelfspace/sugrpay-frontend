# Deploying the web apps on AWS Amplify — one site, one domain

The three web apps are served as **one site**:

| Address                     | App           | Amplify app root |
| --------------------------- | ------------- | ---------------- |
| `https://<site>/`           | Sugrpay admin | `apps/invoicing` |
| `https://<site>/accounts/…` | Accounts      | `apps/accounts`  |
| `https://<site>/pay/…`      | Payment pages | `apps/payment`   |

On Amplify each app is its own Amplify app (each is a separate Next.js
server). Visitors only ever use the **admin app's address**; it forwards
`/accounts` and `/pay` to the other two. Because everything is on one
address, the sign-in cookie is shared with no extra setup.

## 1. Create the three Amplify apps

For each of `apps/invoicing`, `apps/accounts` and `apps/payment`:

1. Amplify → **Create new app** → GitHub → `primeshelfspace/sugrpay-frontend`, branch `main`.
2. Tick **My app is a monorepo** and enter the app root from the table above.
3. Amplify picks up `amplify.yml` from the repository. Leave it.
4. Under **Advanced settings → Environment variables**, add the variables in step 2.
5. **Save and deploy.**

Note each app's default address (`https://main.<id>.amplifyapp.com`).

## 2. Environment variables (the same on all three apps)

`<site>` is the admin app's address — its `amplifyapp.com` address for now,
your own domain later.

```
NEXT_PUBLIC_API_URL=https://api.13-56-132-111.sslip.io
NEXT_PUBLIC_INVOICING_URL=https://<site>
NEXT_PUBLIC_ACCOUNTS_URL=https://<site>/accounts
NEXT_PUBLIC_PAYMENT_PUBLIC_URL=https://<site>/pay
NEXT_PUBLIC_HQ_URL=
NEXT_PUBLIC_ASSET_ORIGIN=https://invoice-dev-839810213531-us-east-1-an.s3.us-east-1.amazonaws.com
NEXT_PUBLIC_GATEWAY_ORIGIN=
COOKIE_DOMAIN=
```

These are built into the apps: after changing one, **redeploy** the app.

## 3. Forward `/accounts` and `/pay` (admin app only)

Admin Amplify app → **Hosting → Rewrites and redirects → Manage → Edit JSON**,
paste this with the other two apps' addresses filled in, and save:

```json
[
  { "source": "/accounts", "target": "https://<accounts app>.amplifyapp.com/accounts", "status": "200" },
  { "source": "/accounts/<*>", "target": "https://<accounts app>.amplifyapp.com/accounts/<*>", "status": "200" },
  { "source": "/pay", "target": "https://<payment app>.amplifyapp.com/pay", "status": "200" },
  { "source": "/pay/<*>", "target": "https://<payment app>.amplifyapp.com/pay/<*>", "status": "200" }
]
```

`200` means the browser stays on the site's address while the page comes from
the other app.

## 4. Tell the backend the site's address

On the API server:

```bash
cd ~/platform && bash deploy/set-public-urls.sh --site https://<site>
```

That sets the admin, `/accounts` and `/pay` addresses used in emails, payment
links and sign-in redirects, and restarts the API.

## Changing the domain later

1. Add the domain to the **admin** Amplify app (Hosting → Custom domains).
2. On all three Amplify apps, change `<site>` in the variables (step 2) and redeploy.
3. On the API server: `bash deploy/set-public-urls.sh --site https://<new domain>`.

The forwarding rules (step 3) point at the other apps' own addresses, which
do not change.

## Check it works

- `https://<site>/` while signed out → goes to `https://<site>/accounts/login`.
- Sign in → you land back on `https://<site>/`, signed in.
- `https://<site>/accounts/team` shows the team page, still signed in.
- An invoice's payment link is `https://<site>/pay/i/…`.
