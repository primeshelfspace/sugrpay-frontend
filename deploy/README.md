# Deploying the Sugrpay web app on a server

The usual host is AWS Amplify — see [amplify.md](amplify.md). This page is for
running it on a server with pm2 and nginx instead.

| File                      | What it is                                                 |
| ------------------------- | ---------------------------------------------------------- |
| `deploy.sh`               | Builds the app beside the live one, then switches pm2 over |
| `ecosystem.config.cjs`    | pm2 process: `sugrpay`                                     |
| `.env.production.example` | The `.env` template                                        |
| `nginx/web.conf`          | nginx server block (one address: `/`, `/accounts`, `/pay`) |

## First deploy

```bash
cd ~/sugrpay-frontend
cp deploy/.env.production.example .env
nano .env                     # set your site address in the three *_URL lines
bash deploy/deploy.sh
pm2 status                    # sugrpay: online
```

Then install `nginx/web.conf` (set `server_name` to your domain) and run
`sudo certbot --nginx -d <your domain>`. Open `https://<your domain>` and sign in.

`NEXT_PUBLIC_*` settings are compiled into the app at build time. After
changing one, run `bash deploy/deploy.sh` again; restarting pm2 is not enough.

## Every release

Deploy the backend first when a release changes the API, then:

```bash
cd ~/sugrpay-frontend && git pull && bash deploy/deploy.sh
```

The app builds into its idle slot (`.next-a` or `.next-b`); nothing live
changes until the build has finished, so a failed build leaves the running
version serving.

## When something is wrong

| Symptom                                 | Check                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| nginx answers 502                       | `pm2 status`, then `pm2 logs sugrpay`                                                |
| Pages load but every action fails       | `NEXT_PUBLIC_API_URL` is wrong, or the backend is down: `curl -s <api>/health`       |
| Brand logos missing on the payment page | `NEXT_PUBLIC_ASSET_ORIGIN` must be the S3 bucket's origin; rebuild after changing it |
