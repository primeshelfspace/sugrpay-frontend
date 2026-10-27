/**
 * What the customer is shown after Stripe answers a bank (ACH) or wallet
 * payment — one place, so the ACH form and the wallet form cannot disagree,
 * and so it can be tested without a browser.
 */
export type StripeOutcome =
  | { kind: 'succeeded' }
  /** Submitted; the money settles later (ACH takes a few business days). */
  | { kind: 'pending' }
  /** Stripe could not verify the bank account instantly and is sending two
   * small deposits; the customer finishes at this link once they arrive. */
  | { kind: 'verify'; url: string | null }
  /** The customer closed the bank sign-in without choosing an account. */
  | { kind: 'cancelled' }
  | { kind: 'failed'; reason: string | null };

interface IntentLike {
  readonly status: string;
  readonly next_action?: {
    readonly type?: string;
    readonly verify_with_microdeposits?: { readonly hosted_verification_url?: string | null };
  } | null;
  readonly last_payment_error?: { readonly message?: string | null } | null;
}

/** After the customer picked a bank account (collectBankAccountForPayment):
 * should the payment be confirmed, or did they back out? */
export function bankAccountCollected(intent: IntentLike): 'confirm' | 'cancelled' | 'done' {
  if (intent.status === 'requires_confirmation') return 'confirm';
  if (intent.status === 'requires_payment_method') return 'cancelled';
  // Already processing/succeeded (e.g. a page reload after confirming).
  return 'done';
}

/** After confirming (confirmUsBankAccountPayment / confirmPayment). */
export function outcomeOf(intent: IntentLike): StripeOutcome {
  switch (intent.status) {
    case 'succeeded':
      return { kind: 'succeeded' };
    case 'processing':
    case 'requires_capture':
      return { kind: 'pending' };
    case 'requires_action':
      if (intent.next_action?.type === 'verify_with_microdeposits') {
        return {
          kind: 'verify',
          url: intent.next_action.verify_with_microdeposits?.hosted_verification_url ?? null,
        };
      }
      return {
        kind: 'failed',
        reason: 'The payment needs another step that could not be completed here.',
      };
    case 'requires_payment_method':
      return {
        kind: 'failed',
        reason:
          intent.last_payment_error?.message ??
          'The payment method was not accepted. Please try another.',
      };
    case 'canceled':
      return { kind: 'failed', reason: 'The payment was cancelled.' };
    default:
      return { kind: 'pending' };
  }
}
