'use client';

import { useId } from 'react';
import {
  FIELD_INVALID_BORDER as invalidBorder,
  FIELD_VALID_BORDER_SECONDARY as validBorder,
} from '@/accounts/components/ui/form-styles';

const inputClass =
  'w-full rounded-[10px] border bg-white px-4 py-3.5 text-base text-slate-900 ' +
  'placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-offset-1 transition-colors';
const labelClass = 'mb-2.5 block text-base font-bold text-[#0F172A]';

interface FieldProps {
  readonly label: string;
  readonly name: string;
  readonly error?: string;
  readonly hint?: string;
  readonly optional?: boolean;
}

function Label({ label, optional }: { label: string; optional?: boolean }) {
  return (
    <span className={labelClass}>
      {label}
      {optional ? <span className="ml-1.5 font-normal text-slate-500">(optional)</span> : null}
    </span>
  );
}

function Message({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (error) {
    return (
      <p id={id} role="alert" className="mt-1.5 text-sm text-red-600">
        {error}
      </p>
    );
  }
  return hint ? (
    <p id={id} className="mt-1.5 text-sm text-slate-500">
      {hint}
    </p>
  ) : null;
}

/** A text field of the onboarding forms, with its error under it. */
export function TextField({
  label,
  name,
  error,
  hint,
  optional,
  defaultValue,
  placeholder,
  autoFocus,
  maxLength,
}: FieldProps & {
  readonly defaultValue?: string;
  readonly placeholder?: string;
  readonly autoFocus?: boolean;
  readonly maxLength?: number;
}) {
  const id = useId();
  const messageId = useId();
  return (
    <label className="block" htmlFor={id}>
      <Label label={label} optional={optional} />
      <input
        id={id}
        name={name}
        type="text"
        required={!optional}
        autoFocus={autoFocus}
        maxLength={maxLength}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? messageId : undefined}
        className={`${inputClass} ${error ? invalidBorder : validBorder}`}
      />
      <Message id={messageId} error={error} hint={hint} />
    </label>
  );
}

/** A select of the onboarding forms, with its error under it. */
export function SelectField({
  label,
  name,
  error,
  hint,
  options,
  defaultValue,
  placeholder,
}: FieldProps & {
  readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>;
  readonly defaultValue?: string;
  readonly placeholder: string;
}) {
  const id = useId();
  const messageId = useId();
  return (
    <label className="block" htmlFor={id}>
      <Label label={label} />
      <select
        id={id}
        name={name}
        required
        defaultValue={defaultValue ?? ''}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? messageId : undefined}
        className={`${inputClass} ${error ? invalidBorder : validBorder}`}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Message id={messageId} error={error} hint={hint} />
    </label>
  );
}

/** Turns a schema or API message into a sentence for the screen. */
export function asSentence(message: string): string {
  const trimmed = message.trim();
  const capital = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capital) ? capital : `${capital}.`;
}

export const SUBMIT_BUTTON_CLASS =
  'w-full rounded-[10px] bg-black px-4 py-3.5 text-[17px] font-bold text-white transition-colors ' +
  'hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#94A3B8] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2';
