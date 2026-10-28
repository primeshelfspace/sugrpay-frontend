import type { Metadata } from 'next';
import { OnboardingHeader } from '@/components/onboarding-header';
import { requireOnboardingStep } from '@/accounts/lib/onboarding';
import { RegisterCompanyForm } from './register-company-form';

export const metadata: Metadata = { title: 'Register Your Company — Accounts' };
export const dynamic = 'force-dynamic';

/**
 * Register Your Company: right after Sign Up, or after signing in while the
 * company is not registered yet. Once per company; the guard sends anyone
 * whose company is past this step to the step it is on.
 */
export default async function RegisterCompanyPage() {
  const { onboarding } = await requireOnboardingStep('REGISTER_COMPANY');

  return (
    <>
      <OnboardingHeader current="Company" />
      <main className="min-h-screen bg-white px-6 py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[600px]">
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-4xl">
              Register Your Company
            </h1>
            <p className="mt-2 text-base text-[#64748B] sm:text-[17px]">
              Tell us about your company. You can do this once.
            </p>
          </div>
          <RegisterCompanyForm contactEmail={onboarding.company.contactEmail} />
        </div>
      </main>
    </>
  );
}
