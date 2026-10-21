import type { Metadata } from 'next';
import { headers } from 'next/headers';

export const metadata: Metadata = {
  title: 'Pay invoice',
  // The page is not indexable and reveals no brand until a valid token
  // resolves to one.
  robots: { index: false, follow: false },
};

/**
 * The public /pay section.
 *
 * Reading the nonce here (not just setting it in middleware) is the other
 * half of the CSP contract in src/pay/middleware.ts: Next only threads a nonce
 * onto its own generated script tags — the inline bootstrap script hydration
 * itself depends on — when a Server Component up the tree actually calls
 * `headers()` to read it. Skipped, `'strict-dynamic'` still applies (which
 * makes browsers ignore the `'self'` fallback), so those scripts end up with
 * no valid nonce at all: CSP silently blocks them, React never hydrates, and
 * every button on every page becomes inert with no visible error.
 */
export default async function PayLayout({ children }: { children: React.ReactNode }) {
  await headers();
  return children;
}
