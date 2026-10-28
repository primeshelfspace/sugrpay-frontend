'use server';

import { redirect } from 'next/navigation';
import { registerCompanySchema } from '@platform/platform-contracts';
import { conflictCodeOf, fieldErrorsOf, registerCompany } from '@/accounts/lib/api';
import { routeForStep } from '@/accounts/lib/onboarding';

export interface RegisterCompanyState {
  readonly error?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly values?: Readonly<Record<string, string>>;
}

function sentence(message: string): string {
  const capital = message.trim().charAt(0).toUpperCase() + message.trim().slice(1);
  return /[.!?]$/.test(capital) ? capital : `${capital}.`;
}

/**
 * Register Your Company. Checked against the API's own schema first, then by
 * the API, which alone knows whether the Company Name is taken. On success
 * the Company Admin continues to Add Your Brand.
 */
export async function registerCompanyAction(
  _prevState: RegisterCompanyState,
  formData: FormData,
): Promise<RegisterCompanyState> {
  const values = {
    companyName: String(formData.get('companyName') ?? ''),
    legalName: String(formData.get('legalName') ?? ''),
    taxId: String(formData.get('taxId') ?? ''),
    brandStructure: String(formData.get('brandStructure') ?? ''),
  };
  const parsed = registerCompanySchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? '');
      if (field && !fieldErrors[field]) fieldErrors[field] = sentence(issue.message);
    }
    return { fieldErrors, values };
  }

  let nextStep;
  try {
    ({ nextStep } = await registerCompany(parsed.data));
  } catch (error) {
    const code = conflictCodeOf(error);
    if (code === 'COMPANY_NAME_TAKEN') {
      return {
        fieldErrors: { companyName: 'A company with this name is already registered.' },
        values,
      };
    }
    if (code === 'COMPANY_ALREADY_REGISTERED') {
      // Registered once already (another tab): carry on from where it stands.
      redirect(routeForStep('ADD_BRAND'));
    }
    const fieldErrors = fieldErrorsOf(error);
    if (Object.keys(fieldErrors).length > 0) {
      return {
        fieldErrors: Object.fromEntries(
          Object.entries(fieldErrors).map(([field, message]) => [field, sentence(message)]),
        ),
        values,
      };
    }
    return { error: 'Your company could not be registered. Please try again.', values };
  }
  redirect(routeForStep(nextStep));
}
