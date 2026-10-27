import { describe, expect, it } from 'vitest';
import { bankAccountCollected, outcomeOf } from './stripe-outcome';

describe('bankAccountCollected', () => {
  it('confirms once a bank account was chosen, and treats a closed window as cancelled', () => {
    expect(bankAccountCollected({ status: 'requires_confirmation' })).toBe('confirm');
    expect(bankAccountCollected({ status: 'requires_payment_method' })).toBe('cancelled');
    expect(bankAccountCollected({ status: 'processing' })).toBe('done');
  });
});

describe('outcomeOf', () => {
  it('shows success only when Stripe says succeeded', () => {
    expect(outcomeOf({ status: 'succeeded' })).toEqual({ kind: 'succeeded' });
  });

  it('shows "pending" while the money is on its way, never "failed"', () => {
    expect(outcomeOf({ status: 'processing' })).toEqual({ kind: 'pending' });
    expect(outcomeOf({ status: 'requires_capture' })).toEqual({ kind: 'pending' });
  });

  it('sends the customer to verify small deposits when instant verification was not possible', () => {
    expect(
      outcomeOf({
        status: 'requires_action',
        next_action: {
          type: 'verify_with_microdeposits',
          verify_with_microdeposits: { hosted_verification_url: 'https://payments.stripe.com/x' },
        },
      }),
    ).toEqual({ kind: 'verify', url: 'https://payments.stripe.com/x' });
  });

  it("explains a refusal with Stripe's own message when there is one", () => {
    expect(
      outcomeOf({
        status: 'requires_payment_method',
        last_payment_error: { message: 'Insufficient funds' },
      }),
    ).toEqual({ kind: 'failed', reason: 'Insufficient funds' });
    expect(outcomeOf({ status: 'requires_payment_method' }).kind).toBe('failed');
    expect(outcomeOf({ status: 'canceled' }).kind).toBe('failed');
  });
});
