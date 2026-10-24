# Deploying the Sugrpay web app on AWS Amplify

Sugrpay is **one** Next.js app (`apps/sugrpay`) and **one** Amplify app:

| Address                     | What                                      |
| --------------------------- | ----------------------------------------- |
| `https://<site>/`           | Sugrpay admin                             |
| `https://<site>/accounts/…` | sign-in, sign-up, team, brands, billing   |
| `https://<site>/pay/…`      | the public page customers pay invoices on |

No subdomains and no forwarding rules: it is all one app on one address.

## 1. Connect the repository

Amplify → **Create new app** → GitHub → `primeshelfspace/sugrpay-frontend`,
branch `main`. Tick **My app is a monorepo** and enter the app root
**`apps/sugrpay`**. Amplify reads `amplify.yml` from the repository.

## 2. Settings

**Hosting → Environment variables** (`<site>` is the Amplify app's address,
e.g. `https://main.<id>.amplifyapp.com`, or your own domain later):

```
AMPLIFY_MONOREPO_APP_ROOT=apps/sugrpay
NEXT_PUBLIC_API_URL=https://api.sugrpay.com
NEXT_PUBLIC_INVOICING_URL=https://<site>
NEXT_PUBLIC_ACCOUNTS_URL=https://<site>/accounts
NEXT_PUBLIC_PAYMENT_PUBLIC_URL=https://<site>/pay
NEXT_PUBLIC_ASSET_ORIGIN=https://invoice-dev-839810213531-us-east-1-an.s3.us-east-1.amazonaws.com
```

**App settings → General:** Platform **Web Compute**, framework **Next.js - SSR**.

The same from CloudShell (replace `<app id>`; the site is filled in from it):

```bash
APP=<app id>; R=us-west-1; SITE=https://main.$APP.amplifyapp.com
aws amplify update-app --app-id $APP --region $R --platform WEB_COMPUTE \
  --environment-variables "AMPLIFY_MONOREPO_APP_ROOT=apps/sugrpay,NEXT_PUBLIC_API_URL=https://api.sugrpay.com,NEXT_PUBLIC_INVOICING_URL=$SITE,NEXT_PUBLIC_ACCOUNTS_URL=$SITE/accounts,NEXT_PUBLIC_PAYMENT_PUBLIC_URL=$SITE/pay,NEXT_PUBLIC_ASSET_ORIGIN=https://invoice-dev-839810213531-us-east-1-an.s3.us-east-1.amazonaws.com"
aws amplify update-branch --app-id $APP --branch-name main --region $R --framework "Next.js - SSR" --enable-auto-build
aws amplify start-job --app-id $APP --branch-name main --region $R --job-type RELEASE
```

Every push to `main` then deploys by itself. `NEXT_PUBLIC_*` values are built
into the app, so after changing one, start a new build.

## 3. Tell the backend the site's address

On the API server:

```bash
cd ~/platform && bash deploy/set-public-urls.sh --site https://<site>
```

## Moving to your own domain later

1. Amplify → **Hosting → Custom domains** → add the domain.
2. Change `<site>` in the three `*_URL` variables and start a new build.
3. On the API server: `bash deploy/set-public-urls.sh --site https://<new domain>`.

## Check it works

- `https://<site>/` while signed out → `https://<site>/accounts/login`.
- Sign in → back on `https://<site>/`, signed in.
- `https://<site>/accounts/team` shows the team page, still signed in.
- An invoice's payment link is `https://<site>/pay/i/…`.

## Changing the backend addresses

The backend is three APIs. The web app calls the platform API and the Sugrpay API, each at its
own address (, ); unset, both fall back to
, the front door (https://api.sugrpay.com) that routes every path to the right
API. To change them without touching the other settings, run [set-api-urls.sh](set-api-urls.sh) in
AWS CloudShell (it rebuilds the app).
