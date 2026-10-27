'use client';

import { useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, useStripe } from '@stripe/react-stripe-js';
import type { CreateIntentResult } from './stripe-card-form';
import { bankAccountCollected, outcomeOf } from './stripe-outcome';

const inputClass =
  'h-10 w-full rounded-lg border border-[#D4D4D4] bg-white px-3 text-sm text-ink-strong ' +
  'shadow-[0_1px_1px_rgba(0,0,0,0.05)] transition-colors placeholder:text-slate-400 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-strong focus-visible:ring-offset-1';

/** Stripe's required Nacha mandate language for ACH Direct Debit — see
 * "Collect mandate acknowledgement" at
 * https://docs.stripe.com/payments/ach-direct-debit/accept-a-payment. The
 * business name is substituted where Stripe's own template has it. */
function mandateText(businessName: string): string {
  return (
    `By checking this box, you authorize ${businessName} to debit the bank account you choose for ` +
    `any amount owed for charges arising from your use of ${businessName}'s services and/or purchase of ` +
    `products from ${businessName}, pursuant to ${businessName}'s website and terms, until this authorization ` +
    `is revoked. You may amend or cancel this authorization at any time by providing notice to ` +
    `${businessName} with 30 (thirty) days notice.`
  );
}

/**
 * The "ACH Bank Transfer" block of the payment page. The customer chooses
 * their bank in Stripe's own window (Financial Connections): most accounts are
 * verified instantly by signing in to the bank, and Stripe offers typing the
 * numbers with a small-deposit check as the fallback. Account and routing
 * numbers never pass through this page or this app's servers.
 *
 * Deferred like the card form: createIntent('ACH') runs only when the
 * customer presses Pay, not when the tile is selected.
 */
export function AchBankTransferForm({
  publishableKey,
  stripeAccount,
  accentColor,
  amountLabel,
  businessName,
  onCreateIntent,
  onSucceeded,
  onFailed,
  onPending,
  onVerificationNeeded,
  onError,
}: {
  publishableKey: string | null;
  stripeAccount: string | null;
  accentColor: string;
  amountLabel: string;
  businessName: string;
  onCreateIntent: () => Promise<CreateIntentResult>;
  onSucceeded: (clientSecret: string | null) => void;
  onFailed: (clientSecret: string | null, reason: string | null) => void;
  onPending: () => void;
  /** Instant verification was not possible: two small deposits arrive in 1–2
   * business days, and the customer finishes at this link. */
  onVerificationNeeded: (hostedVerificationUrl: string | null) => void;
  onError: (message: string) => void;
}) {
  // One Stripe.js load per key/account pair — loadStripe's promise must not
  // be recreated on every render.
  const stripePromise = useMemo(
    () => (publishableKey && stripeAccount ? loadStripe(publishableKey, { stripeAccount }) : null),
    [publishableKey, stripeAccount],
  );

  if (!stripePromise) {
    return (
      <p className="mt-5 rounded-lg bg-danger-surface px-4 py-6 text-center text-sm text-danger">
        This brand has not connected a Stripe account yet.
      </p>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <AchFormInner
        accentColor={accentColor}
        amountLabel={amountLabel}
        businessName={businessName}
        onCreateIntent={onCreateIntent}
        onSucceeded={onSucceeded}
        onFailed={onFailed}
        onPending={onPending}
        onVerificationNeeded={onVerificationNeeded}
        onError={onError}
      />
    </Elements>
  );
}

function AchFormInner({
  accentColor,
  amountLabel,
  businessName,
  onCreateIntent,
  onSucceeded,
  onFailed,
  onPending,
  onVerificationNeeded,
  onError,
}: {
  accentColor: string;
  amountLabel: string;
  businessName: string;
  onCreateIntent: () => Promise<CreateIntentResult>;
  onSucceeded: (clientSecret: string | null) => void;
  onFailed: (clientSecret: string | null, reason: string | null) => void;
  onPending: () => void;
  onVerificationNeeded: (hostedVerificationUrl: string | null) => void;
  onError: (message: string) => void;
}) {
  const stripe = useStripe();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Kept across attempts: if the customer closes the bank window, pressing
  // Pay again reuses the same payment rather than starting a second one.
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = name.trim().length > 0 && emailValid && agreed && !submitting;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !canSubmit) return;
    setSubmitting(true);
    setNotice(null);

    let secret = clientSecret;
    if (!secret) {
      let result: CreateIntentResult;
      try {
        result = await onCreateIntent();
      } catch (err) {
        setSubmitting(false);
        onError(err instanceof Error ? err.message : 'The network request failed.');
        return;
      }
      if (result.gatewayStatus === 'SUCCEEDED') return onSucceeded(null);
      if (result.gatewayStatus === 'FAILED') return onFailed(null, result.declineReason ?? null);
      if (result.gatewayStatus !== 'REQUIRES_ACTION' || !result.clientToken) return onPending();
      secret = result.clientToken;
      setClientSecret(secret);
    }

    // Stripe's window: sign in to the bank (instant), or type the numbers.
    const collected = await stripe.collectBankAccountForPayment({
      clientSecret: secret,
      params: {
        payment_method_type: 'us_bank_account',
        payment_method_data: { billing_details: { name: name.trim(), email: email.trim() } },
      },
      expand: ['payment_method'],
    });
    if (collected.error) {
      setSubmitting(false);
      setNotice(collected.error.message ?? 'Your bank could not be connected. Please try again.');
      return;
    }
    const next = bankAccountCollected(collected.paymentIntent);
    if (next === 'cancelled') {
      setSubmitting(false);
      setNotice('No bank account was chosen. Press Pay to try again.');
      return;
    }

    const confirmed =
      next === 'confirm'
        ? await stripe.confirmUsBankAccountPayment(secret)
        : { paymentIntent: collected.paymentIntent, error: undefined };
    if (confirmed.error || !confirmed.paymentIntent) {
      setSubmitting(false);
      return onFailed(secret, confirmed.error?.message ?? null);
    }

    const outcome = outcomeOf(confirmed.paymentIntent);
    switch (outcome.kind) {
      case 'succeeded':
        return onSucceeded(secret);
      case 'pending':
        return onPending();
      case 'verify':
        return onVerificationNeeded(outcome.url);
      case 'cancelled':
        setSubmitting(false);
        return;
      case 'failed':
        setSubmitting(false);
        return onFailed(secret, outcome.reason);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mt-5">
      <p className="text-sm font-bold text-ink-strong">Pay from your bank account</p>
      <p className="mt-1 text-xs text-ink-muted">
        You&rsquo;ll choose your bank in a secure Stripe window. Most banks connect instantly.
      </p>
      <div className="mt-3 space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">Account holder name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="John Smith"
            autoComplete="name"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">
            Email (for your receipt)
          </span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className={inputClass}
          />
        </label>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#D4D4D4]"
          />
          <span className="text-xs text-ink-muted">{mandateText(businessName)}</span>
        </label>
      </div>

      {notice && <p className="mt-3 text-xs text-danger">{notice}</p>}
      <button
        type="submit"
        disabled={!stripe || !canSubmit}
        style={{ backgroundColor: accentColor }}
        className="mt-5 w-full rounded-lg py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? 'Processing…' : `Pay ${amountLabel}`}
      </button>
    </form>
  );
}
