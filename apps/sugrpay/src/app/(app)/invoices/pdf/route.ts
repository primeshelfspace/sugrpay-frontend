import { NextResponse, type NextRequest } from 'next/server';
import { SUGRPAY_API_URL } from '@/lib/api-urls';
import { isId } from '@/lib/request-guards';
import { readSessionToken } from '@/lib/session';

/**
 * Download PDF on the Invoice Details panel, for any status, drafts included.
 * The API's signed-in PDF route needs the session token, which lives in an
 * httpOnly cookie the browser cannot read, so this passes the download
 * through with the token attached server-side (same pattern as the Zoho
 * activity feed).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const brandId = request.nextUrl.searchParams.get('brandId');
  const invoiceId = request.nextUrl.searchParams.get('id');
  if (!isId(brandId) || !isId(invoiceId)) {
    return NextResponse.json({ message: 'missing brandId or id' }, { status: 400 });
  }

  const token = await readSessionToken();
  if (!token) return NextResponse.json({ message: 'not signed in' }, { status: 401 });

  const upstream = await fetch(`${SUGRPAY_API_URL}/brands/${brandId}/invoices/${invoiceId}/pdf`, {
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
      'Content-Type': 'application/pdf',
      'Content-Disposition':
        upstream.headers.get('content-disposition') ?? 'attachment; filename="invoice.pdf"',
      'Cache-Control': 'no-store',
    },
  });
}
