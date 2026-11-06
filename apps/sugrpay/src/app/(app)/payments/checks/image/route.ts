import { NextResponse, type NextRequest } from 'next/server';
import { SUGRPAY_API_URL } from '@/lib/api-urls';
import { isId } from '@/lib/request-guards';
import { readSessionToken } from '@/lib/session';

/**
 * A check photo for the Check Review drawer. Photos are stored encrypted and
 * the API decrypts them only for a signed-in user allowed to see the brand's
 * payments, so the browser cannot load them from storage; this passes the
 * request through with the session token (an httpOnly cookie) attached
 * server-side, the same pattern as invoices/pdf.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const brandId = request.nextUrl.searchParams.get('brandId');
  const id = request.nextUrl.searchParams.get('id');
  const side = request.nextUrl.searchParams.get('side');
  if (!isId(brandId) || !isId(id) || (side !== 'front' && side !== 'back')) {
    return NextResponse.json({ message: 'missing brandId, id or side' }, { status: 400 });
  }

  const token = await readSessionToken();
  if (!token) return NextResponse.json({ message: 'not signed in' }, { status: 401 });

  const upstream = await fetch(`${SUGRPAY_API_URL}/brands/${brandId}/checks/${id}/images/${side}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!upstream.ok) {
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new NextResponse(await upstream.arrayBuffer(), {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      'Content-Disposition': 'inline',
      'Cache-Control': 'no-store, private',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
