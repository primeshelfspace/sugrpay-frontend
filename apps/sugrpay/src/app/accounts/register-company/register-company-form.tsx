'use client';

import { useActionState, useEffect, useState } from 'react';
import { Building2, Layers } from 'lucide-react';
import { registerCompanySchema } from '@platform/platform-contracts';
import { asSentence, SUBMIT_BUTTON_CLASS, TextField } from '@/accounts/components/onboarding-field';
import { useFormStatusToast } from '@/accounts/hooks/use-form-status-toast';
import { registerCompanyAction, type RegisterCompanyState } from './actions';

const initialState: RegisterCompanyState = {};

type Structure = 'SINGLE' | 'MULTI';

const STRUCTURES: ReadonlyArray<{
  value: Structure;
  title: string;
  description: string;
  icon: typeof Building2;
}> = [
  {
    value: 'SINGLE',
    title: 'Single brand',
    description: 'Your company trades under one brand.',
    icon: Building2,
  },
  {
    value: 'MULTI',
    title: 'Multiple brands',
    description: 'Your company runs several brands. You add the first one next, and more later.',
    icon: Layers,
  },
];

export function RegisterCompanyForm({ contactEmail }: { contactEmail: string }) {
  const [state, formAction, pending] = useActionState(registerCompanyAction, initialState);
  useFormStatusToast(state);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [structure, setStructure] = useState<Structure | null>(
    (state.values?.['brandStructure'] as Structure | undefined) ?? null,
  );

  useEffect(() => {
    if (state.fieldErrors) setErrors(state.fieldErrors);
  }, [state]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const parsed = registerCompanySchema.safeParse({
      companyName: String(form.get('companyName') ?? ''),
      legalName: String(form.get('legalName') ?? ''),
      taxId: String(form.get('taxId') ?? ''),
      brandStructure: String(form.get('brandStructure') ?? ''),
    });
    if (parsed.success) {
      setErrors({});
      return;
    }
    const next: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? '');
      if (field && !next[field]) next[field] = asSentence(issue.message);
    }
    setErrors(next);
    event.preventDefault();
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} noValidate className="space-y-6">
      <TextField
        label="Company Name"
        name="companyName"
        autoFocus
        maxLength={120}
        defaultValue={state.values?.['companyName']}
        placeholder="e.g. Acme Coffee"
        error={errors['companyName']}
        hint="Must be unique on the platform."
      />
      <TextField
        label="Legal Name"
        name="legalName"
        maxLength={200}
        defaultValue={state.values?.['legalName']}
        placeholder="e.g. Acme Coffee LLC"
        error={errors['legalName']}
      />
      <TextField
        label="Tax ID"
        name="taxId"
        maxLength={64}
        defaultValue={state.values?.['taxId']}
        placeholder="e.g. 12-3456789"
        error={errors['taxId']}
      />

      <fieldset>
        <legend className="mb-2.5 block text-base font-bold text-[#0F172A]">Brand Structure</legend>
        <input type="hidden" name="brandStructure" value={structure ?? ''} />
        <div
          role="radiogroup"
          aria-label="Brand structure"
          className="flex flex-col gap-4 sm:flex-row"
        >
          {STRUCTURES.map((option) => {
            const Icon = option.icon;
            const selected = structure === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setStructure(option.value)}
                className={`flex-1 rounded-[14px] border p-5 text-left transition-colors focus-visible:outline-none
                            focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2
                            ${selected ? 'border-2 border-black' : 'border-[#D1D5DB] hover:border-slate-400'}`}
              >
                <span
                  className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full
                              ${selected ? 'bg-black text-white' : 'bg-[#F1F5F9] text-[#475569]'}`}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="block text-base font-bold text-[#0F172A]">{option.title}</span>
                <span className="mt-1 block text-sm text-[#64748B]">{option.description}</span>
              </button>
            );
          })}
        </div>
        {errors['brandStructure'] && (
          <p role="alert" className="mt-1.5 text-sm text-red-600">
            {errors['brandStructure']}
          </p>
        )}
      </fieldset>

      <p className="text-sm text-slate-500">
        Contact email: <span className="font-medium text-[#0F172A]">{contactEmail}</span> (the email
        you signed up with).
      </p>

      <button type="submit" disabled={pending} className={SUBMIT_BUTTON_CLASS}>
        {pending ? 'Registering…' : 'Register Company'}
      </button>
    </form>
  );
}
