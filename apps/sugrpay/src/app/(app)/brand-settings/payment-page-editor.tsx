'use client';

import { useActionState, useEffect, useId, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  CreditCard,
  FileCheck2,
  Landmark,
  Monitor,
  Smartphone,
  Upload,
  Wallet,
} from 'lucide-react';
import type { Brand, PaymentPageDisplaySettings, PaymentPageLayout } from '@/lib/api';
import { useFormStatusToast } from '@/hooks/use-form-status-toast';
import { savePaymentPageDisplayAction, type PaymentPageDisplayState } from './actions';
import { BrandingSubTabs, type BrandingSubTab } from './tabs';
import { SaveBar } from './save-bar';

const initialState: PaymentPageDisplayState = {};

/**
 * What the Email Receipt tab's preview shows — built server-side in page.tsx
 * from the brand's actual most recent invoice, never invented, so that
 * settings screen cannot show a number, customer or "paid" state that does
 * not exist. This Payment Page editor does NOT use this type at all: it is a
 * layout/design preview only, with no invoice summary of any kind — real,
 * sample, or otherwise. Real invoice, customer and transaction records live
 * in the Invoices section, never here.
 */
export interface PaymentPagePreviewInvoice {
  number: string;
  customerName: string;
  amountLabel: string;
  dueDateLabel: string;
  /** Terminal invoice states get the same no-payment-form treatment the real
   * hosted payment page gives them — see src/app/pay's own TERMINAL_STATUSES. */
  isSettled: boolean;
  settledLabel: string | null;
  /** The hosted payment page itself — what the emailed "View & Pay Invoice"
   * button opens. Null when the invoice is still a draft: there is no public
   * link yet. */
  viewUrl: string | null;
  /** The invoice document one level down, behind the payment page's own
   * "View Invoice" action. Null for a draft, for the same reason. */
  invoiceUrl: string | null;
}

const LAYOUTS: readonly { key: PaymentPageLayout; title: string; description: string }[] = [
  { key: 'BANNER', title: 'Banner', description: 'Full-width brand banner with logo and name' },
  { key: 'CENTERED', title: 'Centered', description: 'Centered avatar logo with brand name below' },
  { key: 'SPLIT', title: 'Split', description: 'Invoice summary left, payment form right' },
];

type MethodKey = 'card' | 'ach' | 'wallet' | 'check';

const METHODS: readonly { key: MethodKey; label: string; icon: typeof CreditCard }[] = [
  { key: 'card', label: 'Credit / Debit Card', icon: CreditCard },
  { key: 'ach', label: 'ACH Bank Transfer', icon: Landmark },
  { key: 'wallet', label: 'Digital Wallet', icon: Wallet },
  { key: 'check', label: 'Upload Check', icon: FileCheck2 },
];

const inputClass =
  'w-full h-10 rounded-lg border border-[#D4D4D4] bg-white px-3 text-sm text-slate-900 ' +
  'shadow-[0_1px_1px_rgba(0,0,0,0.05)] placeholder:text-slate-400 focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1 transition-colors';

function initialOf(value: string): string {
  return (value.trim().charAt(0) || '?').toUpperCase();
}

/** The circular chevron button that collapses/expands a section — Brand
 * Elements and Page layout each get one; collapsing only hides the fields,
 * it never resets or discards whatever was already chosen inside. */
function CollapseToggle({
  open,
  onToggle,
  label,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`}
      className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#E2E8F0]
                 text-ink-muted transition-colors hover:bg-[#E5E7EB] hover:text-ink-strong
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1"
    >
      {open ? (
        <ChevronUp className="h-3 w-3" aria-hidden />
      ) : (
        <ChevronDown className="h-3 w-3" aria-hidden />
      )}
    </button>
  );
}

/** A colour row: swatch + hex value, swatch opens a native colour picker. */
function ColourField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const colorInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm font-medium text-ink-strong">{label}</span>
      <button
        type="button"
        onClick={() => colorInputRef.current?.click()}
        className="flex items-center gap-2 rounded-lg border border-[#D1D5DB] bg-white px-2.5 py-1.5
                   transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2
                   focus-visible:ring-slate-900 focus-visible:ring-offset-1"
      >
        <span
          className="h-5 w-5 shrink-0 rounded-md border border-black/10"
          style={{ backgroundColor: value }}
          aria-hidden
        />
        <span className="font-mono text-sm text-ink-muted">{value}</span>
        <input
          ref={colorInputRef}
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="sr-only"
          aria-hidden
          tabIndex={-1}
        />
      </button>
    </div>
  );
}

/** Stands in for the invoice summary block in the preview — same position in
 * every layout, laid out differently per layout. Shows the same fields a real
 * invoice summary would (number, amount, due date), but every value is a
 * fixed zero/placeholder — never a real or sample-but-real-looking invoice,
 * and never any customer name at all (customer data has no place in a layout
 * preview). Real invoice, customer and transaction records live in the
 * Invoices section, never here. */
function InvoiceSummaryPlaceholder({
  centered,
  light,
}: {
  centered?: boolean;
  /** Renders white-on-colour instead of dark-on-white — for the Split
   * layout's full-bleed brand-colour panel, where the default dark/blue/orange
   * palette would be unreadable against a saturated background. */
  light?: boolean;
}) {
  return (
    <div className={centered ? 'text-center' : ''}>
      <p
        className={`text-sm ${light ? 'font-bold text-white' : 'text-ink-muted'} ${centered ? '' : ''}`}
      >
        Invoice #0
      </p>
      <p
        className={`${light ? 'mt-2' : 'mt-1'} text-3xl font-bold ${light ? 'text-white' : 'text-ink-strong'}`}
      >
        $0.00
      </p>
      <div
        className={`flex text-sm ${light ? 'mt-4' : 'mt-2'} ${light ? 'text-white font-bold' : 'text-ink-muted'} ${
          centered ? 'justify-center' : ''
        }`}
      >
        <span>
          <span className={light ? undefined : 'font-semibold text-ink-strong'}>Due Date:</span>{' '}
          <span className={light ? undefined : 'font-semibold text-orange-600'}>0</span>
        </span>
      </div>
    </div>
  );
}

function MethodGrid({
  selected,
  onSelect,
  accentColor,
}: {
  selected: MethodKey;
  onSelect: (key: MethodKey) => void;
  accentColor: string;
}) {
  return (
    <div>
      <p className="text-sm font-bold text-ink-strong">Choose how to pay</p>
      <div className="mt-3 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Payment method">
        {METHODS.map(({ key, label, icon: Icon }) => {
          const isSelected = key === selected;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(key)}
              style={isSelected ? { borderColor: accentColor } : undefined}
              className={`flex h-[42px] items-center gap-[10px] rounded-md border-2 px-4 py-3 text-left text-sm font-medium transition-colors ${
                isSelected
                  ? 'text-ink-strong'
                  : 'border-[#E5E7EB] text-ink-muted hover:border-[#D1D5DB]'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CardDetailsForm() {
  return (
    <div className="mt-5">
      <p className="text-sm font-bold text-ink-strong">Card details</p>
      <div className="mt-3 space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">Card number</span>
          <input inputMode="numeric" placeholder="1234 5678 9012 3456" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">Cardholder name</span>
          <input placeholder="John Smith" className={inputClass} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-muted">Expiry date</span>
            <input placeholder="MM / YY" className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-muted">CVV</span>
            <input placeholder="•••" inputMode="numeric" className={inputClass} />
          </label>
        </div>
      </div>
    </div>
  );
}

/** A dropzone tile for Front/Back of check — purely decorative here (no file
 * picker wired up, same as CardDetailsForm's plain inputs above): this is a
 * layout/design preview, not the real upload flow. */
function CheckImageDropzone({ label }: { label: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-muted">{label}</span>
      <div
        className="flex h-28 flex-col items-center justify-center gap-1 rounded-lg border
                   border-dashed border-[#D1D5DB] bg-surface-muted px-2 text-center"
      >
        <Upload className="h-4 w-4 text-ink-muted" aria-hidden />
        <span className="text-xs font-semibold text-ink-strong">Upload {label.toLowerCase()}</span>
        <span className="text-[11px] text-ink-subtle">PNG, JPG up to 10MB</span>
      </div>
    </label>
  );
}

/** The "Upload Check" method's own screen — mirrors the real hosted payment
 * page's check-upload flow structurally (front/back photos, an optional
 * note, its own submit action) so the layout preview shows what customers
 * who choose this method actually see. Every field here is static and
 * unpopulated — no real or sample check, invoice, or customer data, same
 * rule as the rest of this editor. */
function CheckUploadPreview({ accentColor }: { accentColor: string }) {
  return (
    <div className="mt-5">
      <p className="text-sm font-bold text-ink-strong">Upload Check</p>
      <p className="mt-1 text-xs text-ink-muted">
        Ensure the check is flat, well-lit, and all four corners are visible.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <CheckImageDropzone label="Front of check" />
        <CheckImageDropzone label="Back of check" />
      </div>
      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium text-ink-muted">Notes (Optional)</span>
        <input placeholder="e.g. Reference note for this check" className={inputClass} />
      </label>
      <button
        type="button"
        style={{ backgroundColor: accentColor }}
        className="mt-5 w-full rounded-lg py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
      >
        Submit Check for Review
      </button>
    </div>
  );
}

/** Always "Pay $0.00" — matches InvoiceSummaryPlaceholder's fixed zero
 * amount, never a real or sample-but-real-looking invoice total. */
function PayButton({ accentColor }: { accentColor: string }) {
  return (
    <button
      type="button"
      style={{ backgroundColor: accentColor }}
      className="mt-5 w-full rounded-lg py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
    >
      Pay $0.00
    </button>
  );
}

/**
 * The "Banner" layout's header: logo and name side by side in a full-width
 * colour strip. Distinct from CenteredHeader below (logo above name, both
 * centered) — before this, the two rendered near-identically because this
 * used the same stacked/centered markup Centered does, which is what made
 * "Banner" look like it had no layout of its own.
 */
function BrandBanner({
  brand,
  themeColor,
  logoSrc,
}: {
  brand: Brand;
  themeColor: string;
  logoSrc: string | null;
}) {
  return (
    <div
      style={{ backgroundColor: themeColor }}
      className="flex items-center gap-4 rounded-t-2xl px-6 py-8"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 text-lg font-bold text-white">
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          initialOf(brand.displayName)
        )}
      </span>
      <span className="text-2xl font-bold text-white">{brand.displayName}</span>
    </div>
  );
}

/** The "Centered" layout's header: a short colour bar behind the logo, the
 * logo overlapping its bottom edge, name below on the plain surface — a
 * cover-photo/profile-picture arrangement, distinct from Banner's full-height
 * row and from a flat white header. */
function CenteredHeader({
  brand,
  themeColor,
  logoSrc,
}: {
  brand: Brand;
  themeColor: string;
  logoSrc: string | null;
}) {
  return (
    <div className="flex flex-col items-center">
      <div style={{ backgroundColor: themeColor }} className="h-16 w-full rounded-t-2xl" />
      <span
        style={{ backgroundColor: logoSrc ? undefined : themeColor }}
        className="-mt-10 flex h-[80px] w-[80px] items-center justify-center overflow-hidden rounded-full
                   border-[3px] border-white text-lg font-bold text-white shadow-sm"
      >
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          initialOf(brand.displayName)
        )}
      </span>
      <span className="mt-2 px-6 text-lg font-bold text-ink-strong">{brand.displayName}</span>
    </div>
  );
}

/** The live preview: switches structure by layout, and by device narrows to
 * a single column — the split layout has nowhere to put a second column on
 * a phone screen, so it stacks instead. */
function PreviewBody({
  brand,
  themeColor,
  accentColor,
  layout,
  device,
  logoSrc,
  method,
  onMethodChange,
}: {
  brand: Brand;
  themeColor: string;
  accentColor: string;
  layout: PaymentPageLayout;
  device: 'web' | 'mobile';
  logoSrc: string | null;
  method: MethodKey;
  onMethodChange: (key: MethodKey) => void;
}) {
  const paymentForm = (
    <>
      <MethodGrid selected={method} onSelect={onMethodChange} accentColor={accentColor} />
      {method === 'card' ? (
        <>
          <CardDetailsForm />
          <PayButton accentColor={accentColor} />
        </>
      ) : method === 'check' ? (
        // The check method submits itself ("Submit Check for Review") rather
        // than the generic PayButton below — same split the real hosted
        // payment page's own CheckUploadForm makes.
        <CheckUploadPreview accentColor={accentColor} />
      ) : (
        <>
          <p className="mt-5 rounded-lg border border-dashed border-[#E5E7EB] bg-surface-muted px-4 py-6 text-center text-sm text-ink-muted">
            You will be redirected to complete payment via{' '}
            {METHODS.find((m) => m.key === method)?.label}.
          </p>
          <PayButton accentColor={accentColor} />
        </>
      )}
    </>
  );

  if (layout === 'SPLIT') {
    return (
      <div className={`grid ${device === 'web' ? 'sm:grid-cols-2' : ''}`}>
        <div style={{ backgroundColor: themeColor }} className="flex flex-col gap-6 p-6">
          <div className="flex items-center gap-3 border-b border-white/20 pb-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 text-sm font-bold text-white">
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                initialOf(brand.displayName)
              )}
            </span>
            <span className="text-lg font-bold text-white">{brand.displayName}</span>
          </div>
          <InvoiceSummaryPlaceholder light />
        </div>
        <div className="p-6">{paymentForm}</div>
      </div>
    );
  }

  return (
    <>
      {layout === 'BANNER' ? (
        <BrandBanner brand={brand} themeColor={themeColor} logoSrc={logoSrc} />
      ) : (
        <CenteredHeader brand={brand} themeColor={themeColor} logoSrc={logoSrc} />
      )}
      <div className="p-6">
        <InvoiceSummaryPlaceholder centered={layout === 'CENTERED'} />
        <div className="my-6 border-t border-[#E5E7EB]" />
        {paymentForm}
      </div>
    </>
  );
}

export function PaymentPageEditor({
  brand,
  activeSub,
  display,
}: {
  brand: Brand;
  activeSub: BrandingSubTab;
  display: PaymentPageDisplaySettings;
}) {
  const action = savePaymentPageDisplayAction.bind(null, brand);
  const [state, formAction, pending] = useActionState(action, initialState);
  useFormStatusToast(state);

  const [themeColor, setThemeColor] = useState(brand.themeColor);
  const [accentColor, setAccentColor] = useState(display.accentColor);
  const [layout, setLayout] = useState<PaymentPageLayout>(display.paymentPageLayout);
  const [device, setDevice] = useState<'web' | 'mobile'>('web');
  const [method, setMethod] = useState<MethodKey>('card');

  // Last-known-persisted snapshot, re-seeded from whatever was just
  // submitted the moment a save succeeds (see the effect below) — comparing
  // the live state above against this is what drives the Discard/Save
  // changes bar's visibility. `device`/`method` are pure preview toggles
  // (never submitted), so they're deliberately excluded.
  const [savedValues, setSavedValues] = useState({
    themeColor: brand.themeColor,
    accentColor: display.accentColor,
    layout: display.paymentPageLayout,
  });
  const [logoDirty, setLogoDirty] = useState(false);
  const isDirty =
    logoDirty ||
    themeColor !== savedValues.themeColor ||
    accentColor !== savedValues.accentColor ||
    layout !== savedValues.layout;

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoSrc = logoPreview ?? brand.logoUrl;

  // Collapsible sections default open — collapsing just hides the fields,
  // it never discards a change already made while open.
  const [brandElementsOpen, setBrandElementsOpen] = useState(true);
  const [pageLayoutOpen, setPageLayoutOpen] = useState(true);

  const layoutGroupId = useId();

  function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    setLogoPreview(URL.createObjectURL(file));
    setLogoDirty(true);
  }

  function handleDiscard() {
    setThemeColor(savedValues.themeColor);
    setAccentColor(savedValues.accentColor);
    setLayout(savedValues.layout);
    setLogoPreview(null);
    setLogoDirty(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // On a successful save, whatever was just submitted becomes the new
  // baseline, which is what makes the bar disappear again.
  useEffect(() => {
    if (!state.success) return;
    setSavedValues({ themeColor, accentColor, layout });
    setLogoDirty(false);
    // Intentionally keyed on `state` alone: this should fire once per
    // successful dispatch, using whichever values were current at that
    // point, not re-fire on every subsequent keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    // The <form> wraps the bar as well as the fields, so Save is a plain
    // descendant submit rather than a button associated across the DOM by a
    // `form="id"` attribute. See save-bar.tsx for why that distinction is
    // worth the extra wrapper here.
    <form action={formAction}>
      <div
        className="mt-4 flex w-full flex-col divide-y divide-[#E5E7EB] overflow-hidden rounded-2xl
                 border border-[#E5E7EB] bg-[#F9FAFB99] shadow-sm lg:flex-row lg:divide-x lg:divide-y-0"
      >
        <input type="hidden" name="themeColor" value={themeColor} />
        <input type="hidden" name="accentColor" value={accentColor} />
        <input type="hidden" name="paymentPageLayout" value={layout} />

        <section className="w-[350px] shrink-0 p-6">
          {/* Brand Elements / Page layout used to just be mt-6-spaced with no
            line between them — this divide-y draws the same border-to-border
            line under each here, matching EmailReceiptEditor/InvoicePdfEditor's
            own identical treatment of their sections. */}
          <div className="-mx-6 divide-y-2 divide-[#E5E7EB]">
            <div className="px-6 pb-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-ink-strong">Brand Elements</h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    Set default elements that appear across all customer communications.
                  </p>
                </div>
                <CollapseToggle
                  open={brandElementsOpen}
                  onToggle={() => setBrandElementsOpen((open) => !open)}
                  label="Brand Elements"
                />
              </div>

              {brandElementsOpen && (
                <div className="mt-4 divide-y divide-[#E5E7EB] border-y border-[#E5E7EB]">
                  <div className="flex items-center justify-between py-3">
                    <span className="text-sm font-medium text-ink-strong">Logo</span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Upload brand logo"
                      className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full
                           border border-[#E2E8F0] text-sm font-bold text-white
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1"
                      style={{ backgroundColor: logoSrc ? undefined : themeColor }}
                    >
                      {logoSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoSrc} alt="" className="h-full w-full object-cover" />
                      ) : (
                        initialOf(brand.displayName)
                      )}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      name="logo"
                      accept="image/jpeg,image/png,image/svg+xml"
                      onChange={handleLogoChange}
                      className="hidden"
                    />
                  </div>

                  <ColourField label="Brand colour" value={themeColor} onChange={setThemeColor} />
                  <ColourField
                    label="Accent colour"
                    value={accentColor}
                    onChange={setAccentColor}
                  />
                </div>
              )}
            </div>

            <div className="pt-6">
              <div className="border-b-2 border-[#E5E7EB] px-6 pb-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-ink-strong">Page layout</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      Choose how your payment page is presented to customers.
                    </p>
                  </div>
                  <CollapseToggle
                    open={pageLayoutOpen}
                    onToggle={() => setPageLayoutOpen((open) => !open)}
                    label="Page layout"
                  />
                </div>

                {pageLayoutOpen && (
                  <div className="mt-3 space-y-2" role="radiogroup" aria-labelledby={layoutGroupId}>
                    {LAYOUTS.map(({ key, title, description }) => {
                      const selected = key === layout;
                      return (
                        <button
                          key={key}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setLayout(key)}
                          className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                            selected
                              ? 'border-ink-strong bg-surface-muted'
                              : 'border-[#E5E7EB] hover:border-[#D1D5DB]'
                          }`}
                        >
                          <span>
                            <span className="block text-sm font-semibold text-ink-strong">
                              {title}
                            </span>
                            <span className="block text-xs text-ink-muted">{description}</span>
                          </span>
                          {selected && (
                            <Check className="h-4 w-4 shrink-0 text-ink-strong" aria-hidden />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Save/Discard live in the sticky bar below, outside this card —
            see EmailReceiptEditor's identical bar for the full rationale. */}
        </section>

        <section className="min-w-0 flex-1 p-6">
          <BrandingSubTabs
            active={activeSub}
            brandId={brand.id}
            className="mx-auto max-w-[640px]"
          />
          <div className="mx-auto mt-4 flex max-w-[640px] items-center justify-between">
            <h3 className="text-base font-bold text-ink-strong">Preview</h3>
            <div
              role="radiogroup"
              aria-label="Preview device"
              className="inline-flex rounded-lg border border-[#E5E7EB] bg-white p-1"
            >
              {(
                [
                  { key: 'web' as const, label: 'Web', icon: Monitor },
                  { key: 'mobile' as const, label: 'Mobile', icon: Smartphone },
                ] satisfies { key: 'web' | 'mobile'; label: string; icon: typeof Monitor }[]
              ).map(({ key, label, icon: Icon }) => {
                const selected = key === device;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setDevice(key)}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      selected ? 'bg-[#404040] text-white' : 'text-ink-muted hover:text-ink-strong'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className={`mt-3 overflow-hidden border border-[#E5E7EB] bg-white shadow-lg transition-[max-width] ${
              layout === 'SPLIT' && device === 'web' ? 'rounded-l-2xl' : 'rounded-2xl'
            } ${device === 'mobile' ? 'mx-auto w-full max-w-[340px]' : 'mx-auto max-w-[640px]'}`}
          >
            <PreviewBody
              brand={brand}
              themeColor={themeColor}
              accentColor={accentColor}
              layout={layout}
              device={device}
              logoSrc={logoSrc}
              method={method}
              onMethodChange={setMethod}
            />
          </div>
        </section>
      </div>
      <SaveBar dirty={isDirty} pending={pending} onDiscard={handleDiscard} />
    </form>
  );
}
