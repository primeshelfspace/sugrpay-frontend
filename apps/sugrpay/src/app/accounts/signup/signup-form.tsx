'use client';

import { useActionState, useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { registerSchema } from '@platform/platform-contracts';
import {
  FIELD_INVALID_BORDER as invalidBorder,
  FIELD_VALID_BORDER_SECONDARY as validBorder,
} from '@/accounts/components/ui/form-styles';
import { useFormStatusToast } from '@/accounts/hooks/use-form-status-toast';
import { signupAction, type SignupState } from './actions';

const initialState: SignupState = {};

const inputClass =
  'w-full rounded-[10px] border bg-white px-4 py-3.5 text-base text-slate-900 ' +
  'placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-offset-1 transition-colors';
const labelClass = 'mb-2.5 block text-base font-bold text-[#0F172A]';

type FieldErrors = Partial<Record<'email' | 'password', string>>;

/** The same rules the API applies, checked as the person submits. */
function validate(formData: FormData): FieldErrors {
  const parsed = registerSchema.safeParse({
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
  });
  if (parsed.success) return {};
  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as keyof FieldErrors;
    if (field && !errors[field]) {
      errors[field] = issue.message.charAt(0).toUpperCase() + issue.message.slice(1) + '.';
    }
  }
  return errors;
}

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, initialState);
  useFormStatusToast(state);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const emailId = useId();
  const passwordId = useId();
  const emailErrorId = useId();
  const passwordErrorId = useId();
  const passwordHintId = useId();

  // The server's answer (e.g. the email is taken) replaces the local one.
  useEffect(() => {
    if (state.fieldErrors) setFieldErrors(state.fieldErrors);
  }, [state]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const errors = validate(new FormData(event.currentTarget));
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) event.preventDefault();
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} noValidate>
      <div className="space-y-6">
        <label className="block" htmlFor={emailId}>
          <span className={labelClass}>Company Email</span>
          <input
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            defaultValue={state.email ?? ''}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? emailErrorId : undefined}
            className={`${inputClass} ${fieldErrors.email ? invalidBorder : validBorder}`}
            placeholder="you@yourcompany.com"
          />
          {fieldErrors.email && (
            <p id={emailErrorId} role="alert" className="mt-1.5 text-sm text-red-600">
              {fieldErrors.email}
            </p>
          )}
        </label>

        <label className="block" htmlFor={passwordId}>
          <span className={labelClass}>Password</span>
          <div className="relative">
            <input
              id={passwordId}
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? passwordErrorId : passwordHintId}
              className={`${inputClass} pr-12 ${fieldErrors.password ? invalidBorder : validBorder}`}
              placeholder="At least 12 characters"
            />
            <button
              type="button"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-500 hover:text-slate-800"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {fieldErrors.password ? (
            <p id={passwordErrorId} role="alert" className="mt-1.5 text-sm text-red-600">
              {fieldErrors.password}
            </p>
          ) : (
            <p id={passwordHintId} className="mt-1.5 text-sm text-slate-500">
              Use at least 12 characters.
            </p>
          )}
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-9 w-full rounded-[10px] bg-black px-4 py-3.5 text-[17px] font-bold text-white
                   transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-[#E5E7EB]
                   disabled:text-[#94A3B8] focus-visible:outline-none focus-visible:ring-2
                   focus-visible:ring-black focus-visible:ring-offset-2"
      >
        {pending ? 'Creating your account…' : 'Create Account'}
      </button>

      <p className="mt-5 text-center text-[15px] text-[#64748B]">
        By creating an account, you agree to our{' '}
        <Link href="/accounts/terms" className="font-medium text-[#0F172A] underline">
          terms
        </Link>{' '}
        and{' '}
        <Link href="/accounts/privacy" className="font-medium text-[#0F172A] underline">
          conditions
        </Link>
        .
      </p>
    </form>
  );
}
