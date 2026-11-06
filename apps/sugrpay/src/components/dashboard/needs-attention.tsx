'use client';

import Link from 'next/link';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { NeedsAttentionItem, NeedsAttentionResult } from '@/lib/api';

const DETAIL_TONE: Record<NeedsAttentionItem['kind'], string> = {
  STALE_DRAFT: 'text-ink-subtle',
  DUE_SOON: 'text-warning',
};

const ICON_BADGE_TONE: Record<NeedsAttentionItem['kind'], string> = {
  STALE_DRAFT: 'bg-surface-muted text-ink-muted',
  DUE_SOON: 'bg-warning-surface text-warning',
};

export function NeedsAttention({
  result,
  brandId,
}: {
  result: NeedsAttentionResult;
  /** Concrete brand for the "View" link's query string — falls back to the
   * item's own brand in All Brands mode, where there is no single active one. */
  brandId: string | null;
}) {
  return (
    <div className="rounded-[14px] border border-[#E5E5E5] bg-white p-8 shadow-[0px_1px_3px_0px_#0000000A]">
      <div className="mb-5">
        <div className="flex items-center justify-between pb-5">
          <div>
            <h2 className="text-lg font-semibold leading-none text-ink-strong">Needs Attention</h2>
            <p
              className="mt-1 text-[12px] font-medium leading-none tracking-normal text-ink-subtle"
              style={{ fontFamily: 'var(--font-jakarta)' }}
            >
              Unsent drafts and payments due soon
            </p>
          </div>
          {result.totalCount > 0 && (
            <span className="rounded-full bg-danger-surface px-3 py-1 text-sm font-semibold text-danger">
              {result.totalCount} item{result.totalCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {/* Full-bleed to the card's own edge — cancels the card's p-8 so the
            line reaches both sides, rather than stopping at the padding. */}
        <div className="-mx-8 border-b border-[#E5E5E5]" />
      </div>

      {result.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <CheckCircle2 className="h-8 w-8 text-ink-subtle" aria-hidden />
          <p className="text-sm text-ink-subtle">Nothing needs attention right now.</p>
        </div>
      ) : (
        <ul className="-mx-8 divide-y divide-[#E5E5E5]">
          {result.items.map((item, index) => {
            const targetBrandId = brandId ?? item.brandId;
            return (
              <li
                key={`${item.kind}-${item.invoiceId ?? index}`}
                className="flex items-center gap-3 px-8 py-5 first:pt-0 last:pb-0"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${ICON_BADGE_TONE[item.kind]}`}
                  aria-hidden
                >
                  <AlertCircle className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base">
                    <span className="text-ink-subtle">{item.invoiceNumber}</span>
                    <span className="ml-2 font-semibold text-ink-strong">{item.subject}</span>
                    {item.brandName && (
                      <span className="ml-2 text-xs font-normal text-ink-subtle">
                        {item.brandName}
                      </span>
                    )}
                  </p>
                  <p className={`text-sm ${DETAIL_TONE[item.kind]}`}>{item.detail}</p>
                </div>

                {item.invoiceNumber ? (
                  <Link
                    href={`/invoices?brandId=${targetBrandId}&search=${encodeURIComponent(item.invoiceNumber)}`}
                    className="shrink-0 rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-ink-strong hover:bg-surface-muted"
                  >
                    View
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
