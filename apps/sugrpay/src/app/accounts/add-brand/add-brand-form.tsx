'use client';

import { useActionState, useEffect, useId, useState } from 'react';
import { firstBrandSchema } from '@platform/platform-contracts';
import {
  asSentence,
  SelectField,
  SUBMIT_BUTTON_CLASS,
  TextField,
} from '@/accounts/components/onboarding-field';
import { useFormStatusToast } from '@/accounts/hooks/use-form-status-toast';
import { addBrandAction, type AddBrandState } from './actions';

const initialState: AddBrandState = {};

/** The colour a brand gets when none is chosen (the API's default). */
const DEFAULT_COLOUR = '#2D6A6A';

export function AddBrandForm({
  currencies,
  timezones,
}: {
  currencies: ReadonlyArray<{ value: string; label: string }>;
  timezones: readonly string[];
}) {
  const [state, formAction, pending] = useActionState(addBrandAction, initialState);
  useFormStatusToast(state);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [colour, setColour] = useState(state.values?.['themeColor'] ?? '');
  const colourId = useId();
  const colourMessageId = useId();

  useEffect(() => {
    if (state.fieldErrors) setErrors(state.fieldErrors);
  }, [state]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const parsed = firstBrandSchema.safeParse({
      legalName: String(form.get('legalName') ?? ''),
      displayName: String(form.get('displayName') ?? ''),
      currency: String(form.get('currency') ?? ''),
      timezone: String(form.get('timezone') ?? ''),
      themeColor: String(form.get('themeColor') ?? '').trim() || null,
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
        label="Legal Name"
        name="legalName"
        autoFocus
        maxLength={200}
        defaultValue={state.values?.['legalName']}
        placeholder="e.g. Acme Coffee LLC"
        error={errors['legalName']}
      />
      <TextField
        label="Display Name"
        name="displayName"
        maxLength={120}
        defaultValue={state.values?.['displayName']}
        placeholder="e.g. Acme Coffee"
        error={errors['displayName']}
        hint="The name customers see."
      />
      <SelectField
        label="Currency"
        name="currency"
        options={currencies}
        defaultValue={state.values?.['currency']}
        placeholder="Select a currency"
        error={errors['currency']}
      />
      <SelectField
        label="Timezone"
        name="timezone"
        options={timezones.map((zone) => ({ value: zone, label: zone.replace(/_/g, ' ') }))}
        defaultValue={state.values?.['timezone']}
        placeholder="Select a timezone"
        error={errors['timezone']}
      />

      <div>
        <label htmlFor={colourId} className="mb-2.5 block text-base font-bold text-[#0F172A]">
          Theme Color<span className="ml-1.5 font-normal text-slate-500">(optional)</span>
        </label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            aria-label="Pick a theme color"
            value={/^#[0-9a-fA-F]{6}$/.test(colour) ? colour : DEFAULT_COLOUR}
            onChange={(event) => setColour(event.target.value.toUpperCase())}
            className="h-12 w-14 cursor-pointer rounded-[10px] border border-[#D1D5DB] bg-white p-1"
          />
          <input
            id={colourId}
            name="themeColor"
            type="text"
            value={colour}
            onChange={(event) => setColour(event.target.value)}
            placeholder={`${DEFAULT_COLOUR} (default)`}
            maxLength={7}
            aria-invalid={Boolean(errors['themeColor'])}
            aria-describedby={colourMessageId}
            className={`flex-1 rounded-[10px] border bg-white px-4 py-3.5 text-base text-slate-900
                        placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2
                        ${errors['themeColor'] ? 'border-red-500' : 'border-[#D1D5DB]'}`}
          />
          {colour && (
            <button
              type="button"
              onClick={() => setColour('')}
              className="text-sm font-semibold text-slate-600 underline"
            >
              Clear
            </button>
          )}
        </div>
        <p
          id={colourMessageId}
          role={errors['themeColor'] ? 'alert' : undefined}
          className={`mt-1.5 text-sm ${errors['themeColor'] ? 'text-red-600' : 'text-slate-500'}`}
        >
          {errors['themeColor'] ?? 'Leave empty to use the default color.'}
        </p>
      </div>

      <button type="submit" disabled={pending} className={SUBMIT_BUTTON_CLASS}>
        {pending ? 'Adding your brand…' : 'Add Brand'}
      </button>
    </form>
  );
}
