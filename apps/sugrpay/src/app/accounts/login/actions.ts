'use server';

import { redirect } from 'next/navigation';
import { emailSchema } from '@platform/kernel';
import { ApiError, getOnboarding, login } from '@/accounts/lib/api';
import { AWAITING_SETUP_PATH, isCompanyAdmin, routeForStep } from '@/accounts/lib/onboarding';
import { safeReturnPath, writeSessionToken } from '@/accounts/lib/session';

export interface LoginState {
  readonly error?: string;
  /** 'credentials' shows the reset-password link beside the error. */
  readonly kind?: 'credentials' | 'other';
  /** Kept so the field is not cleared under the user when the attempt fails. */
  readonly email?: string;
}

/**
 * FR-AUTH-003: the API answers every failure identically, and so does this. The
 * only messages that differ are the ones that are not about credentials at all —
 * an empty field, or the API being unreachable.
 */
const GENERIC_FAILURE =
  'Incorrect email or password. Check both and try again — or reset your password if you have forgotten it.';

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const returnTo = safeReturnPath(String(formData.get('next') ?? ''));

  if (!email || !password) {
    return { error: 'Enter your email address and password.', email };
  }
  // The form validates this too, but a request can always arrive without
  // having run that JS — the server is the check that actually holds.
  if (!emailSchema.safeParse(email).success) {
    return { error: 'Enter a valid email address.', email };
  }

  let result;
  try {
    result = await login(email, password);
  } catch (error) {
    if (error instanceof ApiError) {
      // 401 is a rejected credential; 400 is a malformed address, which is still
      // not worth distinguishing to whoever is typing. Anything else is ours.
      if (error.status === 401 || error.status === 400) {
        return { error: GENERIC_FAILURE, kind: 'credentials', email };
      }
      if (error.status === 429) {
        return {
          error: 'Too many sign-in attempts. Wait a few minutes, then try again.',
          kind: 'credentials',
          email,
        };
      }
      return {
        error: 'Sign-in is not working right now. Please try again in a minute.',
        kind: 'other',
        email,
      };
    }
    return {
      error: 'Sign-in is not working right now. Please try again in a minute.',
      kind: 'other',
      email,
    };
  }

  await writeSessionToken(result.token, new Date(result.expiresAt));

  // Outside the try/catch on purpose: redirect() signals by throwing, and
  // catching it here would turn a successful sign-in into an error message.
  // A user still on a temporary password sets a real one first; everyone
  // else goes back where they came from — a page here or a product app.
  if (result.user.mustResetPassword) {
    redirect(`/accounts/set-password?next=${encodeURIComponent(returnTo)}`);
  }
  redirect(await destinationAfterSignIn(result.token, result.user, returnTo));
}

/**
 * Sign In continues from where the company's onboarding stands: the first
 * step not yet done (Register Your Company, Add Your Brand, Select Your
 * Products). Once onboarding is complete, Select Your Products is where
 * signing in lands, unless the user was sent here from a page they were
 * trying to open (a ?next= link), which they go back to.
 */
async function destinationAfterSignIn(
  token: string,
  user: { role: Parameters<typeof isCompanyAdmin>[0]['role'] },
  returnTo: string,
): Promise<string> {
  let onboarding;
  try {
    onboarding = await getOnboarding(token);
  } catch {
    // Not knowing the step must not lose the sign-in: the pages' own guards
    // send the user to the right step.
    return returnTo;
  }
  if (!onboarding.onboardingComplete) {
    return isCompanyAdmin(user) ? routeForStep(onboarding.nextStep) : AWAITING_SETUP_PATH;
  }
  return returnTo === '/' ? routeForStep('SELECT_PRODUCTS') : returnTo;
}
