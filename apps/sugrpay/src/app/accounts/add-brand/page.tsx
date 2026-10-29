import type { Metadata } from 'next';
import { SUPPORTED_CURRENCIES, isValidTimezone } from '@platform/kernel';
import { OnboardingHeader } from '@/components/onboarding-header';
import { requireOnboardingStep } from '@/accounts/lib/onboarding';
import { AddBrandForm } from './add-brand-form';

export const metadata: Metadata = { title: 'Add Your Brand — Accounts' };
export const dynamic = 'force-dynamic';

const CURRENCY_NAMES: Record<string, string> = {
  USD: 'US Dollar',
  CAD: 'Canadian Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  PKR: 'Pakistani Rupee',
};

/** Every IANA zone the runtime knows (the API checks against the same). */
function timezones(): string[] {
  const zones = Intl.supportedValuesOf('timeZone').filter(isValidTimezone);
  return zones.includes('UTC') ? zones : ['UTC', ...zones];
}

/**
 * Add Your Brand: the company's first brand, after Register Your Company and
 * before Select Your Products. It cannot be skipped: the guard sends anyone
 * here until the company has a brand, and the API refuses products until then.
 */
export default async function AddBrandPage() {
  await requireOnboardingStep('ADD_BRAND');

  return (
    <>
      <OnboardingHeader current="Brand" />
      <main className="min-h-screen bg-white px-6 py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[600px]">
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-4xl">
              Add Your Brand
            </h1>
            <p className="mt-2 text-base text-[#64748B] sm:text-[17px]">
              Add your first brand. You can add more brands later.
            </p>
          </div>
          <AddBrandForm
            currencies={SUPPORTED_CURRENCIES.map((code) => ({
              value: code,
              label: `${code} — ${CURRENCY_NAMES[code] ?? code}`,
            }))}
            timezones={timezones()}
          />
        </div>
      </main>
    </>
  );
}
