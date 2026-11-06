import { NextResponse, type NextRequest } from 'next/server';
import { SUGRPAY_API_URL } from '@/lib/api-urls';
import { isId } from '@/lib/request-guards';
import { readSessionToken } from '@/lib/session';

/**
 * The Zoho panel polls this with the activity feed, so "Last synced" moves
 * when a pull or push finishes instead of staying at whatever it was when
 * the page opened. Same proxy as activity/route.ts: the session token is in
 * an httpOnly cookie, so the browser cannot call the API itself.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const brandId = request.nextUrl.searchParams.get('brandId');
  if (!isId(brandId)) {
    return NextResponse.json({ message: 'missing brandId' }, { status: 400 });
  }

  const token = await readSessionToken();
  if (!token) return NextResponse.json({ message: 'not signed in' }, { status: 401 });

  const upstream = await fetch(`${SUGRPAY_API_URL}/brands/${brandId}/integrations/zoho/status`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
