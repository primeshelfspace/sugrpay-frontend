/**
 * Guards for the server code that calls the API with the user's session.
 *
 * Ids from the browser (a `?brandId=` in the URL, a form field) end up inside
 * API paths. `fetch` resolves `..` and drops everything after `#`, so an id of
 * `../../users/me#` would turn "this brand's settings" into a call to some
 * other endpoint — made with the user's token. Every path is checked before it
 * leaves, and the route handlers check their ids up front.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a well-formed id (every brand, invoice, user… id is a UUID). */
export function isId(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/**
 * Throws if an API path could reach somewhere other than it says: dot
 * segments, a fragment, backslashes, encoded slashes or dots, or control
 * characters. Query strings built with URLSearchParams pass untouched.
 */
export function assertSafeApiPath(path: string): void {
  const [pathname = ''] = path.split('?');
  const unsafe =
    !pathname.startsWith('/') ||
    /(^|\/)\.{1,2}(\/|$)/.test(pathname) ||
    /%2e|%2f|%5c/i.test(pathname) ||
    // eslint-disable-next-line no-control-regex
    /[#\\\u0000-\u001f\u007f]/.test(path);
  if (unsafe) throw new Error('refusing an unsafe API path');
}

/**
 * Whether a state-changing request came from this app's own pages. Route
 * handlers do not get the origin check Next.js gives server actions, so a
 * POST handler asks this itself: a browser always sends Origin on a
 * cross-site POST, and it must match the address the request arrived at.
 */
export function isSameOrigin(request: Request): boolean {
  // Every current browser says where a request came from in
  // Sec-Fetch-Site. It does not depend on how the host sees its own address
  // (behind CloudFront the Host header can be an internal name).
  const site = request.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin';
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Provider consent screens an OAuth connect may send the browser to. */
const OAUTH_HOSTS = [
  /^accounts\.zoho\.(com|eu|in|com\.au|jp|ca|sa|com\.cn)$/,
  /^connect\.stripe\.com$/,
  /^(connect\.)?squareup(sandbox)?\.com$/,
];

/** True when a redirect target is an https URL on a known provider. */
export function isProviderConsentUrl(location: string): boolean {
  try {
    const url = new URL(location);
    return url.protocol === 'https:' && OAUTH_HOSTS.some((host) => host.test(url.hostname));
  } catch {
    return false;
  }
}
