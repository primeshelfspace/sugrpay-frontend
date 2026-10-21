/**
 * The site's public host (the admin app at the site root). Accounts is served
 * under /accounts on that same host through a forwarding rule, so form
 * submissions arrive with the site's Origin while this server sees its own
 * Host — Next.js refuses such server actions unless the origin is allowed.
 */
function siteHosts() {
  try {
    return [new URL(process.env.NEXT_PUBLIC_INVOICING_URL ?? '').host];
  } catch {
    return [];
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // One site, one domain: Accounts lives at <site>/accounts.
  basePath: '/accounts',

  // Same build-slot scheme as the other web apps — see deploy/deploy.sh.
  distDir: process.env.NEXT_DIST_DIR || '.next',

  experimental: {
    serverActions: { allowedOrigins: siteHosts() },
  },

  // The shared packages ship compiled CommonJS; transpiling them here keeps
  // the module graph consistent with the app's ESM output.
  transpilePackages: ['@platform/kernel', '@platform/platform-contracts', '@platform/ui'],

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
