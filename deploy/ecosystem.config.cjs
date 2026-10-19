// pm2 process definitions for the web apps on the staging host. Not used
// locally. The backend's processes (api, worker) are defined in the platform
// repository's own deploy/ecosystem.config.cjs.
const fs = require('node:fs');
const path = require('node:path');

// Repository root — this file lives in deploy/.
const ROOT = path.join(__dirname, '..');

// The build slot deploy/deploy.sh last switched this app to. Re-read on every
// `pm2 startOrReload --update-env`, which is how a deploy goes live. Falls back
// to .next for a box that has never run deploy.sh.
function nextDistDir(app) {
  try {
    return fs.readFileSync(path.join(ROOT, 'apps', app, '.next-slot'), 'utf8').trim() || '.next';
  } catch {
    return '.next';
  }
}

// Each app's own "start" script (with-env.mjs -> next start) loads this
// repository's root .env; pm2 just invokes it as-is.
const webApp = (name) => ({
  name,
  cwd: ROOT,
  script: '/usr/bin/pnpm',
  args: `--filter @platform/${name}-web start`,
  env: { NEXT_DIST_DIR: nextDistDir(name) },
});

module.exports = {
  apps: [webApp('accounts'), webApp('invoicing'), webApp('payment')],
};
