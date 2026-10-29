import { redirect } from 'next/navigation';
import {
  getCurrentUser,
  getOnboarding,
  type CurrentUser,
  type OnboardingState,
} from '@/accounts/lib/api';
import { AWAITING_SETUP_PATH, isCompanyAdmin, routeForStep } from '@/accounts/lib/onboarding';
import { LOGIN_PATH } from '@/accounts/lib/session';
import { AccountsShell } from '@/accounts/components/accounts-shell';

/**
 * Every signed-in page. The cookie the middleware saw is not proof of a
 * session, so this asks the API on each render; any failure means sign in
 * again. A user still on a temporary password sets a real one first.
 */
export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  let user: CurrentUser;
  try {
    user = await getCurrentUser();
  } catch {
    redirect(`${LOGIN_PATH}?expired=1`);
  }
  if (user.mustResetPassword) redirect('/accounts/set-password');

  // Every page here needs a registered company with a brand: until then,
  // the Company Admin goes to the step onboarding is on, anyone else waits.
  let onboarding: OnboardingState;
  try {
    onboarding = await getOnboarding();
  } catch {
    redirect(`${LOGIN_PATH}?expired=1`);
  }
  if (onboarding.nextStep !== 'SELECT_PRODUCTS') {
    redirect(isCompanyAdmin(user) ? routeForStep(onboarding.nextStep) : AWAITING_SETUP_PATH);
  }

  return <AccountsShell user={user}>{children}</AccountsShell>;
}
