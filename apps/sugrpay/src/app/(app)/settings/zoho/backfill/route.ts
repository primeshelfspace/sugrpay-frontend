import { NextResponse, type NextRequest } from 'next/server';
import { SUGRPAY_API_URL } from '@/lib/api-urls';
import { isId, isSameOrigin } from '@/lib/request-guards';
import { readSessionToken } from '@/lib/session';

/** Client-callable proxy for the backfill action — same reason as
 * activity/route.ts: the session token is server-only. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const brandId = request.nextUrl.searchParams.get('brandId');
  // Route handlers get no CSRF check from Next.js; refuse other sites.
  if (!isSameOrigin(request)) return NextResponse.json({ message: 'forbidden' }, { status: 403 });
  if (!isId(brandId)) return NextResponse.json({ message: 'missing brandId' }, { status: 400 });

  const token = await readSessionToken();
  if (!token) return NextResponse.json({ message: 'not signed in' }, { status: 401 });

  const upstream = await fetch(`${SUGRPAY_API_URL}/brands/${brandId}/integrations/zoho/backfill`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
