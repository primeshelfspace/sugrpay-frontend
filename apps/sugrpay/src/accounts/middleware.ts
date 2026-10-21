import { NextResponse, type NextRequest } from 'next/server';
import { RETURN_TO_PARAM, SESSION_COOKIE } from '@platform/platform-contracts';

/**
 * The /accounts section's gate, called from src/middleware.ts.
 *
 * The cheap filter: no session cookie, no signed-in page. It cannot tell a
 * live session from an expired one (no API call on the edge) — (app)/layout.tsx
 * asks the API, and the API's own guard is what actually enforces access.
 */
const PUBLIC_PATHS = [
  '/accounts/login',
  '/accounts/signup',
  '/accounts/forgot-password',
  '/accounts/check-inbox',
  '/accounts/set-password',
  '/accounts/terms',
  '/accounts/privacy',
];

export function accountsMiddleware(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const login = request.nextUrl.clone();
  login.pathname = '/accounts/login';
  login.search = '';
  if (pathname !== '/accounts') login.searchParams.set(RETURN_TO_PARAM, `${pathname}${search}`);
  return NextResponse.redirect(login);
}
