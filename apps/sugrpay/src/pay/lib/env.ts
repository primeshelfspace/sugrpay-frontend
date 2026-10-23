/**
 * The Sugrpay API's base URL — the only API the payment pages talk to — with
 * the same local-dev fallback every call site in this section needs. NEXT_PUBLIC_ vars are inlined at build time regardless of
 * which module they're read from, so importing this instead of repeating
 * `process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'` costs nothing.
 */
export const API_URL =
  process.env['NEXT_PUBLIC_SUGRPAY_API_URL'] ??
  process.env['NEXT_PUBLIC_API_URL'] ??
  'http://localhost:4002';
