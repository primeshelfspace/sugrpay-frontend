import { NoBrandsState } from '@/components/no-brands-state';
import { toCurrencyCode } from '@platform/kernel/money';
import { BrandTheme } from '@/components/brand-theme';
import { BrandScopeSelect } from '@/components/dashboard/brand-scope-select';
import { ByBrandCards } from '@/components/dashboard/by-brand-cards';
import { CollectionRateTrendChart } from '@/components/dashboard/collection-rate-trend-chart';
import { CrossBrandCustomersTable } from '@/components/dashboard/cross-brand-customers-table';
import { DateRangeSelect } from '@/components/dashboard/date-range-select';
import { InvoicedVsCollectedChart } from '@/components/dashboard/invoiced-vs-collected-chart';
import { InvoiceStatusDonut } from '@/components/dashboard/invoice-status-donut';
import { KpiCards } from '@/components/dashboard/kpi-cards';
import { NeedsAttention } from '@/components/dashboard/needs-attention';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { TopOverdueCustomers } from '@/components/dashboard/top-overdue-customers';
import { DATE_RANGE_LABELS, isDateRangePreset, rangeBoundsFor } from '@/lib/date-range';
import {
  ApiError,
  getDashboardByBrand,
  getDashboardCrossBrandCustomers,
  getDashboardNeedsAttention,
  getDashboardRecentActivity,
  getDashboardStatusBreakdown,
  getDashboardSummary,
  getDashboardTopOverdueCustomers,
  getDashboardTrend,
  listBrands,
  type Brand,
  type BrandRollup,
  type CrossBrandCustomersResult,
  type DashboardStatusBucket,
  type DashboardSummary,
  type DashboardTrendPoint,
  type NeedsAttentionResult,
  type RecentActivityItem,
  type TopOverdueCustomer,
} from '@/lib/api';
import { PageContainer } from '@/components/page-container';

export const dynamic = 'force-dynamic';

const FALLBACK_THEME_COLOUR = '#16261F';

function settled<T>(outcome: PromiseSettledResult<T>, fallback: T): T {
  return outcome.status === 'fulfilled' ? outcome.value : fallback;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ brandId?: string; brandCreated?: string; range?: string }>;
}) {
  const params = await searchParams;

  let brands: Brand[] = [];
  let brandsError: string | null = null;
  try {
    brands = await listBrands();
  } catch (cause) {
    brandsError = cause instanceof ApiError ? cause.message : String(cause);
  }

  // 'all' is the explicit, bookmarkable "All Brands" value — only reachable
  // with more than one brand, same rule the sidebar's switcher enforces.
  const allBrandsSelected = params.brandId === 'all' && brands.length > 1;
  const activeBrand = allBrandsSelected
    ? null
    : (brands.find((b) => b.id === params.brandId) ?? brands[0] ?? null);
  // null means "every brand this session can read" — every dashboard
  // endpoint below treats that as its own request, not a client-side loop.
  const scopeBrandId = allBrandsSelected ? null : (activeBrand?.id ?? null);

  const rangePreset = isDateRangePreset(params.range) ? params.range : 'this_month';
  const range = rangeBoundsFor(rangePreset);
  const rangeLabel = DATE_RANGE_LABELS[rangePreset];

  let summary: DashboardSummary | null = null;
  let trend: DashboardTrendPoint[] = [];
  let statusBreakdown: DashboardStatusBucket[] = [];
  let topOverdueCustomers: TopOverdueCustomer[] = [];
  let needsAttention: NeedsAttentionResult = { items: [], totalCount: 0 };
  let recentActivity: RecentActivityItem[] = [];
  let byBrand: BrandRollup[] = [];
  let crossBrandCustomers: CrossBrandCustomersResult = { rows: [], matchedCount: 0 };
  let dataError: string | null = null;

  if (brands.length > 0) {
    try {
      const [
        summaryOutcome,
        trendOutcome,
        statusOutcome,
        topOverdueOutcome,
        needsAttentionOutcome,
        recentActivityOutcome,
        byBrandOutcome,
        crossBrandOutcome,
      ] = await Promise.allSettled([
        getDashboardSummary(scopeBrandId, range),
        getDashboardTrend(scopeBrandId),
        getDashboardStatusBreakdown(scopeBrandId, range),
        getDashboardTopOverdueCustomers(scopeBrandId),
        getDashboardNeedsAttention(scopeBrandId),
        getDashboardRecentActivity(scopeBrandId),
        // Only meaningful in All Brands mode — skip the round trip otherwise.
        scopeBrandId === null ? getDashboardByBrand(range) : Promise.resolve<BrandRollup[]>([]),
        scopeBrandId === null
          ? getDashboardCrossBrandCustomers()
          : Promise.resolve<CrossBrandCustomersResult>({ rows: [], matchedCount: 0 }),
      ]);

      if (summaryOutcome.status === 'rejected') {
        throw summaryOutcome.reason; // the KPI cards are the one widget worth failing the page over
      }
      summary = summaryOutcome.value;
      trend = settled(trendOutcome, []);
      statusBreakdown = settled(statusOutcome, []);
      topOverdueCustomers = settled(topOverdueOutcome, []);
      needsAttention = settled(needsAttentionOutcome, { items: [], totalCount: 0 });
      recentActivity = settled(recentActivityOutcome, []);
      byBrand = settled(byBrandOutcome, []);
      crossBrandCustomers = settled(crossBrandOutcome, { rows: [], matchedCount: 0 });
      // Every figure here comes from this platform's own database: invoices,
      // payments and customers live here, and Zoho is only kept in step with
      // them in the background. Nothing on this page asks Zoho anything.
    } catch (cause) {
      dataError = cause instanceof ApiError ? cause.message : String(cause);
    }
  }

  const currency = toCurrencyCode(summary?.currency ?? activeBrand?.currency);

  return (
    <BrandTheme brandColour={activeBrand?.themeColor ?? FALLBACK_THEME_COLOUR}>
      <PageContainer compact>
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-ink-strong">Dashboard</h1>
            <p className="text-sm text-ink-muted">Finance overview &amp; collection performance</p>
          </div>
          {brands.length > 0 && (
            <div className="flex shrink-0 items-center gap-3">
              <DateRangeSelect current={rangePreset} />
              <BrandScopeSelect brands={brands} activeBrandId={scopeBrandId} />
            </div>
          )}
        </header>

        {params.brandCreated && (
          <div className="mb-4 rounded-md bg-success-surface p-3 text-sm text-success">
            Brand created.
          </div>
        )}

        {brandsError ? (
          <div className="rounded-md bg-danger-surface p-4 text-sm text-danger">
            Could not load brands: {brandsError}
          </div>
        ) : brands.length === 0 ? (
          <NoBrandsState />
        ) : dataError || !summary ? (
          <div className="rounded-md bg-danger-surface p-4 text-sm text-danger">
            Could not load dashboard data: {dataError ?? 'unknown error'}
          </div>
        ) : (
          <>
            <KpiCards summary={summary} rangeLabel={rangeLabel} />

            <div className="mb-6 grid gap-4 lg:grid-cols-3">
              <div className="h-full lg:col-span-2">
                <CollectionRateTrendChart trend={trend} />
              </div>
              <InvoiceStatusDonut
                buckets={statusBreakdown}
                currency={currency}
                rangeLabel={rangeLabel}
              />
            </div>

            <div className="mb-6">
              <InvoicedVsCollectedChart trend={trend} currency={currency} />
            </div>

            <div className="mb-6 grid gap-4 lg:grid-cols-2">
              <TopOverdueCustomers customers={topOverdueCustomers} currency={currency} />
              <div id="needs-attention">
                <NeedsAttention result={needsAttention} brandId={scopeBrandId} />
              </div>
            </div>

            <div className="mb-6">
              <RecentActivity items={recentActivity} />
            </div>

            {scopeBrandId === null && <ByBrandCards brands={byBrand} />}

            {scopeBrandId === null && (
              <CrossBrandCustomersTable result={crossBrandCustomers} brands={brands} />
            )}
          </>
        )}
      </PageContainer>
    </BrandTheme>
  );
}
