'use client';

import { useActionState, useEffect, useState } from 'react';
import { ArrowUpRight, Check } from 'lucide-react';
import type { ProductCard } from '@/accounts/lib/api';
import { Badge, Card } from '@/accounts/components/page-header';
import { useFormStatusToast } from '@/accounts/hooks/use-form-status-toast';
import { continueAction, enableProductsAction, type ProductsActionState } from './product-actions';

const initialState: ProductsActionState = {};

/**
 * Select Your Products & Redirect. Enabled products show Continue. Products
 * not yet enabled can be selected and enabled by the Company Admin; everyone
 * else sees that they are not enabled. A company with nothing enabled must
 * select at least one to continue.
 */
export function ProductPicker({ products }: { products: readonly ProductCard[] }) {
  const [enableState, enableAction, enabling] = useActionState(enableProductsAction, initialState);
  const [continueState, continueFormAction, continuing] = useActionState(
    continueAction,
    initialState,
  );
  useFormStatusToast(continueState);
  // Into the product, by a full navigation that keeps the token fragment.
  const goTo = continueState.goTo ?? enableState.goTo;
  useEffect(() => {
    if (goTo) window.location.assign(goTo);
  }, [goTo]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [localError, setLocalError] = useState<string | null>(null);
  const selectable = products.filter((p) => p.canEnable);
  const error = localError ?? enableState.error ?? null;

  function toggle(product: string) {
    setLocalError(null);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(product)) next.delete(product);
      else next.add(product);
      return next;
    });
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        {products.map((card) => {
          const isSelected = selected.has(card.product);
          return (
            <Card
              key={card.product}
              className={`flex flex-col p-6 ${isSelected ? 'ring-2 ring-black' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-extrabold text-[#0F172A]">{card.name}</h2>
                {card.enabled ? <Badge tone="green">Enabled</Badge> : <Badge>Not enabled</Badge>}
              </div>
              <p className="mt-2 flex-1 text-sm text-slate-500">{card.description}</p>
              <div className="mt-6">
                {card.enabled ? (
                  <form action={continueFormAction}>
                    <input type="hidden" name="product" value={card.product} />
                    <button
                      type="submit"
                      disabled={continuing}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-black px-4 py-2 text-sm font-bold text-white hover:bg-neutral-800 disabled:opacity-60"
                    >
                      Continue
                      <ArrowUpRight className="h-4 w-4" aria-hidden />
                    </button>
                  </form>
                ) : card.canEnable ? (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    onClick={() => toggle(card.product)}
                    className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold
                                ${isSelected ? 'border-black bg-black text-white' : 'border-[#D1D5DB] text-[#0F172A] hover:border-slate-400'}`}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded border
                                  ${isSelected ? 'border-white' : 'border-slate-400'}`}
                    >
                      {isSelected ? <Check className="h-3 w-3" aria-hidden /> : null}
                    </span>
                    {isSelected ? 'Selected' : 'Select'}
                  </button>
                ) : (
                  <p className="text-sm text-slate-500">
                    Not enabled. Ask your Company Admin to enable it.
                  </p>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {selectable.length > 0 && (
        <form
          action={enableAction}
          onSubmit={(event) => {
            if (selected.size === 0) {
              event.preventDefault();
              setLocalError('Select at least one product to continue.');
            }
          }}
          className="mt-8"
        >
          {[...selected].map((product) => (
            <input key={product} type="hidden" name="product" value={product} />
          ))}
          {error && (
            <p role="alert" className="mb-3 text-sm text-red-600">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={enabling}
            className="w-full rounded-[10px] bg-black px-4 py-3.5 text-[17px] font-bold text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#94A3B8] sm:w-auto sm:px-8"
          >
            {enabling
              ? 'Enabling…'
              : selected.size > 1
                ? `Enable ${selected.size} products`
                : 'Enable and continue'}
          </button>
        </form>
      )}
    </div>
  );
}
