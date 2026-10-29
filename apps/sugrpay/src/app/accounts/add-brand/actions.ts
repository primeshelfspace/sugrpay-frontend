'use server';

import { redirect } from 'next/navigation';
import { firstBrandSchema } from '@platform/platform-contracts';
import { addFirstBrand, conflictCodeOf, fieldErrorsOf } from '@/accounts/lib/api';
import { routeForStep } from '@/accounts/lib/onboarding';

export interface AddBrandState {
  readonly error?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly values?: Readonly<Record<string, string>>;
}

function sentence(message: string): string {
  const capital = message.trim().charAt(0).toUpperCase() + message.trim().slice(1);
  return /[.!?]$/.test(capital) ? capital : `${capital}.`;
}

/**
 * Add Your Brand: the company's first brand. Theme Color is optional (left
 * empty, the brand gets the default colour). On success the Company Admin
 * continues to Select Your Products & Redirect.
 */
export async function addBrandAction(
  _prevState: AddBrandState,
  formData: FormData,
): Promise<AddBrandState> {
  const values = {
    legalName: String(formData.get('legalName') ?? ''),
    displayName: String(formData.get('displayName') ?? ''),
    currency: String(formData.get('currency') ?? ''),
    timezone: String(formData.get('timezone') ?? ''),
    themeColor: String(formData.get('themeColor') ?? '').trim(),
  };
  const parsed = firstBrandSchema.safeParse({
    ...values,
    themeColor: values.themeColor || null,
  });
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
    ({ nextStep } = await addFirstBrand({
      ...parsed.data,
      themeColor: parsed.data.themeColor ?? null,
    }));
  } catch (error) {
    const code = conflictCodeOf(error);
    // Another tab got there first, or the company is not registered yet:
    // either way, carry on from where onboarding actually stands.
    if (code === 'BRAND_ALREADY_ADDED') redirect(routeForStep('SELECT_PRODUCTS'));
    if (code === 'COMPANY_NOT_REGISTERED') redirect(routeForStep('REGISTER_COMPANY'));
    const fieldErrors = fieldErrorsOf(error);
    if (Object.keys(fieldErrors).length > 0) {
      return {
        fieldErrors: Object.fromEntries(
          Object.entries(fieldErrors).map(([field, message]) => [field, sentence(message)]),
        ),
        values,
      };
    }
    return { error: 'Your brand could not be added. Please try again.', values };
  }
  redirect(routeForStep(nextStep));
}
