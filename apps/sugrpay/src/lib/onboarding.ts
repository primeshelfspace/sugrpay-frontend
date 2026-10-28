import { redirect } from 'next/navigation';
import {
  getCurrentUser,
  getMerchantOnboarding,
  type CurrentUser,
  type MerchantOnboardingState,
} from './api';
import { LOGIN_PATH, readSessionToken } from './session';

/**
 * What stands between a signed-in user and the Sugrpay app. Company
 * onboarding itself (Register Your Company, Add Your Brand, Select Your
 * Products) lives in Accounts; this only sends people there until it is done.
 * The step is never kept here: the API works it out from the company's data
 * (GET /merchant/onboarding). `null` means onboarding is complete.
 *
 * `awaiting-setup` is not a step anyone performs: it is where a user lands
 * while the company still owes onboarding and they are not the Company Admin,
 * the only one who can complete it.
 */
export type OnboardingStep =
  'set-password' | 'REGISTER_COMPANY' | 'ADD_BRAND' | 'SELECT_PRODUCTS' | 'awaiting-setup' | null;

/**
 * `prefetchedMerchant` lets a caller that already has the onboarding record
 * (the authenticated layout) pass it in instead of this fetching it again.
 */
export async function resolveOnboardingStep(
  user: CurrentUser,
  prefetchedMerchant?: MerchantOnboardingState,
): Promise<OnboardingStep> {
  // Applies to every role: a user on a temporary password sets their own
  // before anything else, and is always permitted to.
  if (user.mustResetPassword) return 'set-password';

  const merchant = prefetchedMerchant ?? (await getMerchantOnboarding());
  if (merchant.onboardingComplete) return null;
  // Only the Company Admin (the person who signed up) completes onboarding.
  if (user.role !== 'MERCHANT_OWNER') return 'awaiting-setup';
  return merchant.nextStep;
}

export function routeForStep(step: OnboardingStep): string {
  switch (step) {
    case 'set-password':
      return '/set-password';
    case 'REGISTER_COMPANY':
      return '/accounts/register-company';
    case 'ADD_BRAND':
      return '/accounts/add-brand';
    case 'SELECT_PRODUCTS':
      return '/accounts';
    case 'awaiting-setup':
      return '/awaiting-setup';
    case null:
      return '/';
  }
}

/**
 * The guard of the one onboarding page left in this app, awaiting-setup.
 * Signed out: to sign in. Anyone whose step is not this one: to their step.
 * Never returns for a mismatch — `redirect` throws.
 */
export async function requireOnboardingStep(
  step: Exclude<OnboardingStep, null>,
): Promise<CurrentUser> {
  if (!(await readSessionToken())) {
    redirect(`${LOGIN_PATH}?next=${encodeURIComponent(routeForStep(step))}`);
  }
  let user: CurrentUser;
  let actual: OnboardingStep;
  try {
    user = await getCurrentUser();
    actual = await resolveOnboardingStep(user);
  } catch {
    redirect(`${LOGIN_PATH}?expired=1`);
  }
  if (actual !== step) redirect(routeForStep(actual));
  return user;
}
