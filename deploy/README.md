# Deploying the web apps

The web apps run on the same EC2 server as the backend. The AWS setup, server
preparation and backend come first: follow the platform repository's
[docs/guides/deploy-ec2.md](https://github.com/primeshelfspace/platform/blob/main/docs/guides/deploy-ec2.md)
up to its step 5, until `curl -s localhost:4000/health` answers.

| File                      | What it is                                                   |
| ------------------------- | ------------------------------------------------------------ |
| `deploy.sh`               | Builds every app beside the live one, then switches pm2 over |
| `ecosystem.config.cjs`    | pm2 processes: `accounts`, `invoicing`, `payment`            |
| `.env.production.example` | The `.env` template for a server                             |
| `nginx/web.conf`          | nginx server blocks for the three apps                       |

## First deploy

```bash
cd ~/sugrpay-frontend
cp deploy/.env.production.example .env
nano .env                     # replace every CHANGE-ME and your host names
bash deploy/deploy.sh
pm2 status                    # accounts, invoicing and payment: online
```

Then install `nginx/web.conf` and run certbot, as in step 6 of the platform
guide. Open `https://accounts.<your domain>` and sign in.

`NEXT_PUBLIC_*` settings are compiled into the apps at build time. After
changing one, run `bash deploy/deploy.sh` again; restarting pm2 is not enough.

## Every release

Deploy the backend first when a release changes the API, then:

```bash
cd ~/sugrpay-frontend && git pull && bash deploy/deploy.sh
```

Each app builds into its idle slot (`.next-a` or `.next-b`). Nothing live
changes until all three have built, so a failed build leaves the running
version serving.

## When something is wrong

| Symptom                                     | Check                                                                                                     |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| nginx answers 502                           | `pm2 status`, then `pm2 logs accounts` (or `invoicing`, `payment`)                                         |
| Signed in on Accounts but Sugrpay asks again | `COOKIE_DOMAIN` must be the shared parent domain with a leading dot, and every app must be on HTTPS        |
| Pages load but every action fails           | `NEXT_PUBLIC_API_URL` is wrong, or the backend is down: `curl -s localhost:4000/health`                    |
| Brand logos missing on the payment page     | `NEXT_PUBLIC_ASSET_ORIGIN` must be the S3 bucket's origin; rebuild after changing it                       |
