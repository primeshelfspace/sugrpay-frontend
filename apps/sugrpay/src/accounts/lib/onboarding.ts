import { redirect } from 'next/navigation';
import {
  getCurrentUser,
  getOnboarding,
  type CurrentUser,
  type OnboardingState,
  type OnboardingStep,
} from './api';
import { LOGIN_PATH } from './session';

/**
 * Company onboarding on the web: each step the API's `nextStep` names opens
 * its own screen. The step is never kept here; it is asked from the API
 * (GET /merchant/onboarding), which works it out from the company's data.
 */
export function routeForStep(step: OnboardingStep): string {
  switch (step) {
    case 'REGISTER_COMPANY':
      return '/accounts/register-company';
    case 'ADD_BRAND':
      return '/accounts/add-brand';
    case 'SELECT_PRODUCTS':
      return '/accounts';
  }
}

/** Where someone waits while the Company Admin finishes onboarding. */
export const AWAITING_SETUP_PATH = '/awaiting-setup';

/**
 * Every onboarding page calls this with its own step. Signed out: to sign
 * in. On the wrong page (a skipped step, an old bookmark): to the step the
 * company is actually on. Only the Company Admin completes onboarding; anyone
 * else waits on the awaiting-setup page. Never returns for a mismatch —
 * redirect() throws.
 */
export async function requireOnboardingStep(
  step: OnboardingStep,
): Promise<{ user: CurrentUser; onboarding: OnboardingState }> {
  let user: CurrentUser;
  let onboarding: OnboardingState;
  try {
    [user, onboarding] = await Promise.all([getCurrentUser(), getOnboarding()]);
  } catch {
    redirect(`${LOGIN_PATH}?next=${encodeURIComponent(routeForStep(step))}`);
  }
  if (user.mustResetPassword) redirect('/accounts/set-password');
  if (onboarding.nextStep !== step) redirect(routeForStep(onboarding.nextStep));
  if (step !== 'SELECT_PRODUCTS' && !isCompanyAdmin(user)) redirect(AWAITING_SETUP_PATH);
  return { user, onboarding };
}

/** The Company Admin: the person who signed up (account role MERCHANT_OWNER). */
export function isCompanyAdmin(user: Pick<CurrentUser, 'role'>): boolean {
  return user.role === 'MERCHANT_OWNER';
}
