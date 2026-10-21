#!/usr/bin/env bash
# Builds the current checkout of the Sugrpay web app on the staging box and switches
# pm2 over to it without taking the live apps down. Manual deploy:
#
#   cd ~/sugrpay-frontend && git pull && bash deploy/deploy.sh
#
# The backend (primeshelfspace/platform) deploys on its own, from its own
# checkout; deploy it first when a release changes the API.
#
# Why not just `pnpm build` + `pm2 reload`: `next build` empties .next before
# it writes the new build, and the running `next start` reads pages and chunks
# from that same .next lazily. For the whole build every request either hit
# missing files or crashed the process, and nginx answered 502; a build that
# failed halfway left the box with no usable build at all.
#
# Instead the app builds into its idle slot (.next-a or .next-b, recorded in
# apps/<app>/.next-slot, which deploy/ecosystem.config.cjs hands to next
# start), and nothing live is touched until it has built. A failed
# build exits here with the old version still serving.
set -euo pipefail
cd "$(dirname "$0")/.."

pnpm install --frozen-lockfile
pnpm --filter "./packages/*" build

declare -A slot
for app in sugrpay; do
  dir="apps/$app"
  live=$(cat "$dir/.next-slot" 2>/dev/null || echo .next)
  if [ "$live" = .next-a ]; then slot[$app]=.next-b; else slot[$app]=.next-a; fi

  rm -rf "${dir:?}/${slot[$app]}"
  # Route types are build-time only. The live build's would be typechecked
  # alongside the new ones and fail the build on any route this deploy removed.
  rm -rf "${dir:?}/$live/types"

  NEXT_DIST_DIR=${slot[$app]} pnpm --filter "@platform/$app-web" build
done

# next build rewrites these to point at the slot it built into; keep the
# tracked copies clean so the next `git reset --hard` / `git pull` is quiet.
git checkout -- apps/sugrpay/next-env.d.ts

# --- everything built: go live ---
for app in sugrpay; do echo "${slot[$app]}" > "apps/$app/.next-slot"; done

pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save

# The pre-slot build is unused once every app is on a slot.
rm -rf apps/sugrpay/.next

pm2 status
