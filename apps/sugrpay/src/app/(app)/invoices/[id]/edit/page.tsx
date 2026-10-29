import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatMinor, formatQuantity, toCurrencyCode } from '@platform/kernel';
import { BrandTheme } from '@/components/brand-theme';
import { PageContainer } from '@/components/page-container';
import { ApiError, getCurrentUser, getInvoice, listBrands, listCustomers } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import { InvoiceForm, type InvoiceFormInitial } from '../../new/invoice-form';

const FALLBACK_THEME_COLOUR = '#16261F';

/** Basis points back to the percent the form takes ("290" → "2.9"). */
function bpToPercent(bp: number): string {
  return String(bp / 100);
}

/**
 * Edit a draft invoice (the Invoice Details panel's Edit). Same form as
 * Create invoice, filled in; saving keeps it a draft. Anything already
 * issued goes back to the list — the API refuses those edits anyway.
 */
export default async function EditInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ brandId?: string }>;
}) {
  const { id } = await params;
  const { brandId } = await searchParams;
  const back = brandId ? `/invoices?brandId=${brandId}` : '/invoices';

  const user = await getCurrentUser();
  if (!brandId || !hasPermission(user, 'INVOICES', 'WRITE')) redirect(back);

  let invoice;
  try {
    invoice = await getInvoice(brandId, id);
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) redirect(back);
    throw cause;
  }
  if (invoice.status !== 'DRAFT') redirect(back);

  let brandName = brandId;
  let themeColour = FALLBACK_THEME_COLOUR;
  try {
    const brand = (await listBrands()).find((b) => b.id === brandId);
    if (brand) {
      brandName = brand.displayName;
      themeColour = brand.themeColor;
    }
  } catch (cause) {
    if (!(cause instanceof ApiError)) throw cause;
  }

  let customers: Awaited<ReturnType<typeof listCustomers>>['data'] = [];
  let customersError: string | null = null;
  try {
    customers = (await listCustomers(brandId)).data;
  } catch (cause) {
    customersError = cause instanceof ApiError ? cause.message : String(cause);
  }

  // The invoice keeps its own currency; the brand's may have changed since.
  const currency = toCurrencyCode(invoice.currency);
  const initial: InvoiceFormInitial = {
    invoiceId: invoice.id,
    customerId: invoice.customerId,
    invoiceDate: invoice.invoiceDate.slice(0, 10),
    dueDate: invoice.dueDate.slice(0, 10),
    taxRatePercent: bpToPercent(invoice.taxRateBpApplied),
    cardFeeRatePercent: bpToPercent(invoice.cardFeeRateBpApplied),
    notes: invoice.notes ?? '',
    rows: invoice.lineItems.map((line) => ({
      itemName: line.itemName,
      description: line.description ?? '',
      // Stored scaled (x10,000), as the API keeps it.
      quantity: formatQuantity(line.quantity),
      unitPrice: formatMinor(line.unitPriceMinor, currency),
      taxExempt: line.taxExempt,
    })),
  };

  return (
    <BrandTheme brandColour={themeColour}>
      <PageContainer narrow>
        <header className="mb-8">
          <p className="text-sm uppercase tracking-widest text-ink-subtle">{brandName}</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink-strong">
            Edit draft {invoice.number}
          </h1>
        </header>

        {customersError ? (
          <div className="rounded-md bg-danger-surface p-4 text-sm text-danger">
            Could not load customers: {customersError}{' '}
            <Link href={back} className="underline">
              Back to invoices
            </Link>
          </div>
        ) : (
          <InvoiceForm
            brandId={brandId}
            currency={currency}
            customers={customers}
            initial={initial}
          />
        )}
      </PageContainer>
    </BrandTheme>
  );
}
