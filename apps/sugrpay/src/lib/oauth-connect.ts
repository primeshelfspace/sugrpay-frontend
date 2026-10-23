import { NextResponse, type NextRequest } from 'next/server';
import { apiUrlFor } from './api-urls';
import { isId, isProviderConsentUrl } from './request-guards';
import { LOGIN_PATH, readSessionToken } from './session';

/**
 * Starts a provider OAuth handshake from the admin app.
 *
 * The API's connect endpoints are authenticated (@RequirePermission) and answer
 * with a redirect to the provider's consent screen. A browser's top-level
 * navigation cannot carry an Authorization header — and in this BFF the browser
 * has no API session at all, since the token lives in an httpOnly cookie on
 * THIS origin and is only ever replayed server-side. Pointing a link straight
 * at the API therefore arrives unauthenticated and 401s.
 *
 * So the redirect is fetched here, where the token can be attached, and
 * re-issued to the browser as a plain redirect to the provider, which needs no
 * credentials of ours.
 */
export async function startProviderConnect(
  request: NextRequest,
  options: {
    /** Path segment on the API: `zoho` or `stripe`. */
    readonly provider: string;
    /** Where to send the browser back to when something goes wrong. */
    readonly settingsPath: string;
    /** Query key the destination page reads its failure from. Pages differ:
     * the Zoho screen owns the whole page and uses `error`, while the Stripe
     * panel is one section of the payment-methods screen and namespaces its
     * own as `stripeError`. */
    readonly errorParam?: string;
    /** Extra query params merged into every redirect back to settingsPath —
     * e.g. `{ tab: 'payments' }` so a failure lands on the right tab of a
     * page with more than one, without settingsPath itself carrying a `?`
     * that params.toString() would then double up. */
    readonly extraParams?: Record<string, string>;
  },
): Promise<NextResponse> {
  const { provider, settingsPath, errorParam = 'error', extraParams = {} } = options;
  const brandId = request.nextUrl.searchParams.get('brandId');

  const failure = (reason: string, withBrand = true) => {
    const params = new URLSearchParams(extraParams);
    if (withBrand && brandId) params.set('brandId', brandId);
    params.set(errorParam, reason);
    return NextResponse.redirect(new URL(`${settingsPath}?${params}`, request.url));
  };

  if (!isId(brandId)) return failure('missing_brand', false);

  const token = await readSessionToken();
  if (!token) return NextResponse.redirect(new URL(LOGIN_PATH, request.url));

  // Zoho's connect is Sugrpay's; Stripe's and Square's are the platform's.
  const path = `/brands/${brandId}/integrations/${provider}/connect`;
  const apiUrl = apiUrlFor(path);
  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    return failure('api_unreachable');
  }

  const location = upstream.headers.get('location');
  if (!location) {
    // No redirect means the API refused rather than handing us a consent URL —
    // most often the provider is not configured on this deployment, which
    // surfaces as a 400 carrying the reason.
    // The reason travels as a fixed code, never the API's own text: the page
    // that shows it is a trusted one, and its URL must not carry free text.
    if (upstream.status === 400) return failure('not_configured');
    if (upstream.status === 401) return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
    if (upstream.status === 403) return failure('forbidden');
    return failure('connect_failed');
  }

  // Only ever on to a provider's own consent screen (or the API's local
  // stand-in for one), whatever the upstream answered.
  const sameApi = (() => {
    try {
      return new URL(location).origin === new URL(apiUrl).origin;
    } catch {
      return false;
    }
  })();
  if (!isProviderConsentUrl(location) && !sameApi) return failure('connect_failed');

  return NextResponse.redirect(location);
}
