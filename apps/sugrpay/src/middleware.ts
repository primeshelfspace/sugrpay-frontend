import { NextResponse, type NextRequest } from 'next/server';
import { RETURN_TO_PARAM, SESSION_COOKIE } from '@platform/platform-contracts';
import { accountsMiddleware } from './accounts/middleware';
import { payMiddleware } from './pay/middleware';

/**
 * One Sugrpay app, three sections:
 *
 *   /pay/…       public payment pages — no session, strict per-request CSP
 *   /accounts/…  sign-in, sign-up, team, brands, locations, billing
 *   everything else: the Sugrpay admin
 *
 * FR-AUTH-021: no admin page is reachable without a session. This is the
 * cheap filter, not the access decision. It only asks whether a session cookie
 * is present — middleware runs on the edge runtime with no database and no API
 * round trip, so it cannot tell a live session from an expired one. The real
 * check is in (app)/layout.tsx, which asks the API, and behind that the API's
 * own guard, which is the only one that actually enforces anything.
 */

/** Old top-level sign-in addresses, kept working by sending them to /accounts. */
const LEGACY_ACCOUNTS_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  '/check-inbox',
  '/set-password',
  '/terms',
  '/privacy',
];

/**
 * Reachable with no session at all. `/welcome` is the public marketing page —
 * without it here an anonymous visitor has no front door.
 */
const PUBLIC_PATHS = ['/welcome'];

const matches = (pathname: string, paths: readonly string[]) =>
  paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

export function middleware(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  if (matches(pathname, ['/pay'])) return payMiddleware(request);
  if (matches(pathname, ['/accounts'])) return accountsMiddleware(request);

  if (matches(pathname, LEGACY_ACCOUNTS_PATHS)) {
    const target = request.nextUrl.clone();
    target.pathname = `/accounts${pathname}`;
    return NextResponse.redirect(target);
  }

  if (matches(pathname, PUBLIC_PATHS) || request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }

  const login = request.nextUrl.clone();
  login.pathname = '/accounts/login';
  login.search = '';
  if (pathname !== '/') login.searchParams.set(RETURN_TO_PARAM, `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // Static assets carry no session and need no redirect or nonce. `_next/*` in
  // particular must stay out, or pages load without their own CSS.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
