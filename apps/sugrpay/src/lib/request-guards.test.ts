/**
 * The checks that keep browser-supplied ids from steering the server's API
 * calls, cross-site POSTs out of the route handlers, and OAuth redirects on
 * the providers' own sites.
 */
import { describe, expect, it } from 'vitest';
import { assertSafeApiPath, isId, isProviderConsentUrl, isSameOrigin } from './request-guards';

const ID = '3f2b8c1e-9a4d-4e7b-8c2a-1b2c3d4e5f60';

describe('isId', () => {
  it('accepts a UUID and nothing else', () => {
    expect(isId(ID)).toBe(true);
    for (const value of [null, undefined, '', '../../users/me#', `${ID}/../x`, 'abc']) {
      expect(isId(value)).toBe(false);
    }
  });
});

describe('assertSafeApiPath', () => {
  it('lets ordinary paths and query strings through', () => {
    for (const path of [
      `/brands/${ID}/invoices`,
      `/brands/${ID}/invoices?status=PAID&search=a%20b`,
      '/auth/me',
    ]) {
      expect(() => assertSafeApiPath(path)).not.toThrow();
    }
  });

  it('refuses a path an id could have bent somewhere else', () => {
    for (const path of [
      '/brands/../../users/me',
      '/brands/../users/me#/integrations',
      '/brands/x#/settings',
      '/brands/%2e%2e/users',
      '/brands/a%2fb',
      '/brands/a\\b',
      '/brands/a\nb',
      'brands/no-leading-slash',
      '/brands/./x',
    ]) {
      expect(() => assertSafeApiPath(path)).toThrow();
    }
  });
});

describe('isSameOrigin', () => {
  const request = (headers: Record<string, string>) =>
    new Request('https://www.sugrpay.com/settings/zoho/pull', { method: 'POST', headers });

  it('trusts the browser’s Sec-Fetch-Site when it is sent', () => {
    expect(isSameOrigin(request({ 'sec-fetch-site': 'same-origin' }))).toBe(true);
    expect(isSameOrigin(request({ 'sec-fetch-site': 'same-site' }))).toBe(false);
    expect(isSameOrigin(request({ 'sec-fetch-site': 'cross-site' }))).toBe(false);
  });

  it('otherwise compares Origin with the host the request arrived at', () => {
    expect(
      isSameOrigin(request({ origin: 'https://www.sugrpay.com', host: 'www.sugrpay.com' })),
    ).toBe(true);
    expect(isSameOrigin(request({ origin: 'https://evil.example', host: 'www.sugrpay.com' }))).toBe(
      false,
    );
    expect(isSameOrigin(request({ host: 'www.sugrpay.com' }))).toBe(false);
  });
});

describe('isProviderConsentUrl', () => {
  it('allows the providers’ own https consent screens', () => {
    for (const url of [
      'https://accounts.zoho.com/oauth/v2/auth?x=1',
      'https://accounts.zoho.eu/oauth/v2/auth',
      'https://connect.stripe.com/oauth/authorize',
      'https://connect.squareup.com/oauth2/authorize',
      'https://connect.squareupsandbox.com/oauth2/authorize',
    ]) {
      expect(isProviderConsentUrl(url)).toBe(true);
    }
  });

  it('refuses anything else, including look-alikes and plain http', () => {
    for (const url of [
      'https://evil.example/oauth',
      'https://accounts.zoho.com.evil.example/',
      'http://connect.stripe.com/oauth/authorize',
      'javascript:alert(1)',
      '/relative',
    ]) {
      expect(isProviderConsentUrl(url)).toBe(false);
    }
  });
});
