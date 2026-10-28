'use server';

import { redirect } from 'next/navigation';
import { registerSchema } from '@platform/platform-contracts';
import { ApiError, conflictCodeOf, fieldErrorsOf, register } from '@/accounts/lib/api';
import { routeForStep } from '@/accounts/lib/onboarding';
import { writeSessionToken } from '@/accounts/lib/session';

export interface SignupState {
  readonly error?: string;
  /** A message per field: email, password. */
  readonly fieldErrors?: Readonly<Record<string, string>>;
  /** Kept so the email is not cleared under the user when the attempt fails. */
  readonly email?: string;
}

/**
 * Sign Up: a company email and a password. The person becomes the Company
 * Admin and is signed in, then goes on to Register Your Company.
 *
 * Validated here with the API's own schema before the call (a request can
 * arrive without the form's JavaScript having run), and again by the API,
 * whose answer wins: it alone knows whether the email is taken.
 */
export async function signupAction(
  _prevState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  const parsed = registerSchema.safeParse({ email, password });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? '');
      if (field && !fieldErrors[field]) fieldErrors[field] = sentence(issue.message);
    }
    return { fieldErrors, email };
  }

  let result;
  try {
    result = await register(parsed.data.email, parsed.data.password);
  } catch (error) {
    if (conflictCodeOf(error) === 'EMAIL_TAKEN') {
      return {
        fieldErrors: { email: 'An account with this email already exists. Sign in instead.' },
        email,
      };
    }
    const fieldErrors = fieldErrorsOf(error);
    if (Object.keys(fieldErrors).length > 0) {
      return { fieldErrors: mapValues(fieldErrors, sentence), email };
    }
    if (error instanceof ApiError && error.status === 429) {
      return { error: 'Too many sign-up attempts. Wait a few minutes, then try again.', email };
    }
    return { error: 'Sign-up is not working right now. Please try again in a minute.', email };
  }

  await writeSessionToken(result.token, new Date(result.expiresAt));
  // Outside the try/catch on purpose: redirect() signals by throwing.
  redirect(routeForStep(result.nextStep));
}

function sentence(message: string): string {
  const trimmed = message.trim();
  const capital = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capital) ? capital : `${capital}.`;
}

function mapValues(
  record: Record<string, string>,
  fn: (value: string) => string,
): Record<string, string> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, fn(value)]));
}
