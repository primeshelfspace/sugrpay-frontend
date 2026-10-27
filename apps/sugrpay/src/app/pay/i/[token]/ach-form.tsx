'use client';

import { useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import type { PaymentIntent } from '@stripe/stripe-js';
import { Elements, useStripe } from '@stripe/react-stripe-js';
import type { CreateIntentResult } from './stripe-card-form';

const inputClass =
  'h-10 w-full rounded-lg border border-[#D4D4D4] bg-white px-3 text-sm text-ink-strong ' +
  'shadow-[0_1px_1px_rgba(0,0,0,0.05)] transition-colors placeholder:text-slate-400 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-strong focus-visible:ring-offset-1';

/**
 * Stripe's `next_action.verify_with_microdeposits` is present at runtime on an
 * ACH confirmation (TDD-001 §10.2's direct-API flow with manually-entered
 * bank details) but isn't modelled on this SDK version's `PaymentIntent` type
 * — redirect_to_url and wechat_pay_display_qr_code are the only next_action
 * shapes it declares. The field is read defensively rather than widening the
 * imported type.
 */
interface VerifyWithMicrodeposits {
  hosted_verification_url?: string | null;
}

/** Stripe's required Nacha mandate language for a custom (non-Payment-Element)
 * ACH Direct Debit form — see "Collect mandates" at
 * https://stripe.com/docs/payments/ach-direct-debit#mandates. The business
 * name is substituted in three times, exactly where Stripe's own template
 * repeats it. */
function mandateText(businessName: string): string {
  return (
    `By checking this box, you authorize ${businessName} to debit the bank account specified above for ` +
    `any amount owed for charges arising from your use of ${businessName}'s services and/or purchase of ` +
    `products from ${businessName}, pursuant to ${businessName}'s website and terms, until this authorization ` +
    `is revoked. You may amend or cancel this authorization at any time by providing notice to ` +
    `${businessName} with 30 (thirty) days notice.`
  );
}

/**
 * The "ACH Bank Transfer" block of the payment page, mounted the moment that
 * tile is selected — shaped like StripeCardForm (deferred intent: createIntent
 * only runs on submit, not on mount) but collects the bank account directly
 * (routing/account number) rather than through a Stripe Element, since Stripe
 * has no hosted-iframe field for these the way it does for card number/CVC.
 * The account and routing numbers still never reach this app's own server —
 * confirmUsBankAccountPayment sends them straight to Stripe from the browser,
 * the same boundary StripeCardForm keeps for card data.
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
  /** Stripe couldn't instantly verify this account and fell back to
   * microdeposits (1-2 business days) — hostedVerificationUrl is where the
   * customer finishes that later, once the deposits land. */
  onVerificationNeeded: (hostedVerificationUrl: string | null) => void;
  onError: (message: string) => void;
}) {
  // One Stripe.js load per distinct key/account pair, same rationale as
  // StripeCardForm's identical memo — loadStripe's promise must not be
  // recreated on every render.
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
  const [accountHolderName, setAccountHolderName] = useState('');
  const [email, setEmail] = useState('');
  const [accountHolderType, setAccountHolderType] = useState<'individual' | 'company'>('individual');
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [agreedToMandate, setAgreedToMandate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // US routing numbers are always 9 digits; account numbers vary by bank
  // (4-17 digits covers every US institution Stripe itself accepts).
  const routingValid = /^\d{9}$/.test(routingNumber);
  const accountValid = /^\d{4,17}$/.test(accountNumber);
  const accountsMatch = accountNumber.length > 0 && accountNumber === confirmAccountNumber;
  const canSubmit =
    accountHolderName.trim().length > 0 &&
    routingValid &&
    accountValid &&
    accountsMatch &&
    agreedToMandate &&
    !submitting;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !canSubmit) return;

    setSubmitting(true);
    setError(null);

    let result: CreateIntentResult;
    try {
      result = await onCreateIntent();
    } catch (err) {
      setSubmitting(false);
      onError(err instanceof Error ? err.message : 'The network request failed.');
      return;
    }

    if (result.gatewayStatus === 'SUCCEEDED') {
      onSucceeded(null);
      return;
    }
    if (result.gatewayStatus === 'FAILED') {
      onFailed(null, result.declineReason ?? null);
      return;
    }
    if (result.gatewayStatus !== 'REQUIRES_ACTION' || !result.clientToken) {
      onPending();
      return;
    }
    const clientSecret = result.clientToken;

    const confirmResult = await stripe.confirmUsBankAccountPayment(clientSecret, {
      payment_method: {
        billing_details: {
          name: accountHolderName.trim(),
          email: email.trim() || undefined,
        },
        us_bank_account: {
          account_number: accountNumber,
          routing_number: routingNumber,
          account_holder_type: accountHolderType,
        },
      },
    });

    if (confirmResult.error) {
      setSubmitting(false);
      // validation_error means Stripe rejected the details before ever
      // attempting the debit (e.g. a routing number that fails the checksum)
      // — the customer can fix the form and retry, so this stays inline
      // rather than replacing the whole form the way a declined attempt does.
      if (confirmResult.error.type === 'validation_error') {
        setError(confirmResult.error.message ?? 'Please check your bank account details.');
      } else {
        onFailed(clientSecret, confirmResult.error.message ?? null);
      }
      return;
    }

    const intent = confirmResult.paymentIntent;
    const nextAction = intent.next_action as
      | (NonNullable<PaymentIntent['next_action']> & { verify_with_microdeposits?: VerifyWithMicrodeposits })
      | null;

    if (nextAction?.type === 'verify_with_microdeposits') {
      onVerificationNeeded(nextAction.verify_with_microdeposits?.hosted_verification_url ?? null);
      return;
    }
    if (intent.status === 'requires_payment_method') {
      setSubmitting(false);
      onFailed(clientSecret, 'We couldn’t verify that bank account. Please check the details and try again.');
      return;
    }
    // 'processing': instantly verified (or no verification needed) and the
    // debit has been submitted — settlement itself takes up to 4 business
    // days and arrives later via webhook, same as every other ACH outcome.
    onPending();
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mt-5">
      <p className="text-sm font-bold text-ink-strong">Bank account details</p>
      <div className="mt-3 space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">Account holder name</span>
          <input
            value={accountHolderName}
            onChange={(event) => setAccountHolderName(event.target.value)}
            placeholder="John Smith"
            autoComplete="name"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">Email (for your receipt)</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">Account type</span>
          <select
            value={accountHolderType}
            onChange={(event) => setAccountHolderType(event.target.value as 'individual' | 'company')}
            className={inputClass}
          >
            <option value="individual">Individual</option>
            <option value="company">Company</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">Routing number</span>
          <input
            inputMode="numeric"
            value={routingNumber}
            onChange={(event) => setRoutingNumber(event.target.value.replace(/\D/g, '').slice(0, 9))}
            placeholder="110000000"
            className={inputClass}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-muted">Account number</span>
            <input
              inputMode="numeric"
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, '').slice(0, 17))}
              placeholder="000123456789"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-muted">Confirm account number</span>
            <input
              inputMode="numeric"
              value={confirmAccountNumber}
              onChange={(event) => setConfirmAccountNumber(event.target.value.replace(/\D/g, '').slice(0, 17))}
              placeholder="000123456789"
              className={inputClass}
            />
            {accountNumber.length > 0 && confirmAccountNumber.length > 0 && !accountsMatch && (
              <p className="mt-1 text-xs text-danger">Account numbers don&rsquo;t match.</p>
            )}
          </label>
        </div>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={agreedToMandate}
            onChange={(event) => setAgreedToMandate(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#D4D4D4]"
          />
          <span className="text-xs text-ink-muted">{mandateText(businessName)}</span>
        </label>
      </div>

      {error && <p className="mt-3 text-xs text-danger">{error}</p>}
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
