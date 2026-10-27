'use client';

import { useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import type { StripeExpressCheckoutElementConfirmEvent } from '@stripe/stripe-js';
import { Elements, ExpressCheckoutElement, useElements, useStripe } from '@stripe/react-stripe-js';
import type { CreateIntentResult } from './stripe-card-form';
import { outcomeOf } from './stripe-outcome';

/**
 * The "Digital Wallet" block of the payment page — Apple Pay and Google Pay
 * are two brand toggles (FR-PAY-005) but one PaymentMethod ('WALLET') at the
 * API layer, and on Stripe's side both ride the card network, so one
 * ExpressCheckoutElement covers both: it shows whichever of the two (or
 * neither) the customer's browser/device actually supports, rather than this
 * app trying to detect that itself.
 *
 * Same deferred-intent shape as StripeCardForm: createIntent('WALLET') only
 * runs once the customer actually authorizes payment in the native sheet
 * (onConfirm), never just because this tile was selected. Express Checkout
 * also needs its own `elements` instance configured with mode/amount/currency
 * (there is no clientSecret yet when it mounts) — a separate one from
 * StripeCardForm's, since only one of these tiles is ever mounted at a time.
 */
export function WalletPayForm({
  publishableKey,
  stripeAccount,
  currency,
  amountMinor,
  returnUrl,
  onCreateIntent,
  onSucceeded,
  onFailed,
  onPending,
  onError,
}: {
  publishableKey: string | null;
  stripeAccount: string | null;
  /** ISO currency code — Elements wants it lowercase ('usd'), the rest of
   * this app's own CurrencyCode type is uppercase. */
  currency: string;
  amountMinor: number;
  returnUrl: string;
  onCreateIntent: () => Promise<CreateIntentResult>;
  onSucceeded: (clientSecret: string | null) => void;
  onFailed: (clientSecret: string | null, reason: string | null) => void;
  onPending: () => void;
  onError: (message: string) => void;
}) {
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
    <Elements
      stripe={stripePromise}
      options={{
        mode: 'payment',
        amount: amountMinor,
        currency: currency.toLowerCase(),
        // Wallets only — without this a connected account with Link or other
        // methods enabled would show them here too.
        paymentMethodTypes: ['card'],
      }}
    >
      <WalletInner
        returnUrl={returnUrl}
        onCreateIntent={onCreateIntent}
        onSucceeded={onSucceeded}
        onFailed={onFailed}
        onPending={onPending}
        onError={onError}
      />
    </Elements>
  );
}

function WalletInner({
  returnUrl,
  onCreateIntent,
  onSucceeded,
  onFailed,
  onPending,
  onError,
}: {
  returnUrl: string;
  onCreateIntent: () => Promise<CreateIntentResult>;
  onSucceeded: (clientSecret: string | null) => void;
  onFailed: (clientSecret: string | null, reason: string | null) => void;
  onPending: () => void;
  onError: (message: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  // null = Stripe hasn't reported back yet; false = reported, nothing to show.
  const [available, setAvailable] = useState<boolean | null>(null);

  async function handleConfirm(event: StripeExpressCheckoutElementConfirmEvent) {
    if (!stripe || !elements) return;

    const { error: submitError } = await elements.submit();
    if (submitError) {
      event.paymentFailed({ reason: 'fail' });
      onError(submitError.message ?? 'Something went wrong.');
      return;
    }

    let result: CreateIntentResult;
    try {
      result = await onCreateIntent();
    } catch (err) {
      event.paymentFailed({ reason: 'fail' });
      onError(err instanceof Error ? err.message : 'The network request failed.');
      return;
    }

    if (result.gatewayStatus === 'SUCCEEDED') {
      onSucceeded(null);
      return;
    }
    if (result.gatewayStatus === 'FAILED') {
      event.paymentFailed({ reason: 'fail' });
      onFailed(null, result.declineReason ?? null);
      return;
    }
    if (result.gatewayStatus !== 'REQUIRES_ACTION' || !result.clientToken) {
      onPending();
      return;
    }
    const clientSecret = result.clientToken;

    // redirect: 'if_required' keeps the customer on this page for the common
    // (non-3DS-redirect) case, matching StripeCardForm's confirmCardPayment.
    const confirmResult = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: { return_url: returnUrl },
      redirect: 'if_required',
    });

    if (confirmResult.error) {
      event.paymentFailed({ reason: 'fail' });
      if (
        confirmResult.error.type === 'card_error' ||
        confirmResult.error.type === 'validation_error'
      ) {
        onFailed(clientSecret, confirmResult.error.message ?? null);
      } else {
        onError(confirmResult.error.message ?? 'Something went wrong.');
      }
      return;
    }

    if (!confirmResult.paymentIntent) return onPending();
    const outcome = outcomeOf(confirmResult.paymentIntent);
    if (outcome.kind === 'succeeded') onSucceeded(clientSecret);
    else if (outcome.kind === 'failed') onFailed(clientSecret, outcome.reason);
    else onPending();
  }

  return (
    <div className="mt-5">
      <ExpressCheckoutElement
        onConfirm={(event) => void handleConfirm(event)}
        onReady={(event) => setAvailable(Boolean(event.availablePaymentMethods))}
      />
      {available === false && (
        <p className="mt-3 rounded-lg border border-dashed border-[#E5E7EB] bg-surface-muted px-4 py-6 text-center text-sm text-ink-muted">
          Apple Pay and Google Pay aren&rsquo;t available in this browser or on this device. Please
          choose another payment method.
        </p>
      )}
    </div>
  );
}
