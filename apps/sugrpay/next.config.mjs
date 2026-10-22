/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // deploy/deploy.sh builds into the idle slot (.next-a / .next-b) while the
  // live server keeps serving the other, then repoints pm2 (see
  // deploy/ecosystem.config.cjs). Unset locally and in CI, so those still use .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',

  // The shared packages ship compiled CommonJS; transpiling them here keeps
  // the module graph consistent with the app's ESM output.
  transpilePackages: [
    '@platform/kernel',
    '@platform/platform-contracts',
    '@platform/invoicing-contracts',
    '@platform/ui',
  ],

  // Every Brand Settings save posts the logo file through a server action
  // (see saveLogo in brand-settings/actions.ts), and Next's default server
  // action body cap is 1MB — well under the API's own 5MB logo limit
  // (MAX_LOGO_BYTES in apps/api/src/shared/common/logo-upload.ts), so any real
  // photo over ~1MB crashed the whole form with an unhandled "Body exceeded
  // 1 MB limit" error before the request ever reached the API. Raised past
  // the API's cap so that limit is the one that actually applies.
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },

  // No source maps in production and no X-Powered-By: the public payment pages
  // should reveal as little about internals as possible.
  productionBrowserSourceMaps: false,
  poweredByHeader: false,

  // The admin's headers are standard; the public /pay section's are stricter
  // (TDD-001 §3.3), and its per-request CSP is set in src/pay/middleware.ts.
  // When two rules set the same header, the later one wins.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // HTTPS only, on every page — sign-in included, where it matters most.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          // A baseline policy for the admin and Accounts pages: no framing, no
          // plugins, no <base> hijack, forms post only here. (Scripts are not
          // restricted here; /pay has the full per-request nonce policy.)
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
          },
        ],
      },
      {
        source: '/pay/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // A payment page must never be cached by a shared proxy.
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
    ];
  },
};

export default nextConfig;
