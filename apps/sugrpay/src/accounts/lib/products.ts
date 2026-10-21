import { PRODUCT_NAMES, type Product } from '@platform/platform-contracts';

/**
 * This web app is Sugrpay. Other products (HQ) have their own repositories and
 * web apps, so only Sugrpay is listed, opened or billed from here.
 *
 * NEXT_PUBLIC_ values are inlined at build time, so each must be read by its
 * literal name.
 */
export const ACCOUNTS_URL =
  process.env['NEXT_PUBLIC_ACCOUNTS_URL'] ?? 'http://localhost:3000/accounts';

const SUGRPAY_URL = process.env['NEXT_PUBLIC_INVOICING_URL'] ?? 'http://localhost:3000';

/** The products this app shows. */
export const APP_PRODUCTS = ['INVOICING'] as const satisfies readonly Product[];

export function isAppProduct(product: Product): product is (typeof APP_PRODUCTS)[number] {
  return (APP_PRODUCTS as readonly Product[]).includes(product);
}

export interface ProductInfo {
  readonly product: Product;
  readonly name: string;
  readonly description: string;
  readonly url: string;
}

export function productInfo(product: (typeof APP_PRODUCTS)[number]): ProductInfo {
  return {
    product,
    name: PRODUCT_NAMES[product],
    description: 'Send invoices and get paid.',
    url: SUGRPAY_URL,
  };
}

/** Origins a sign-in may send the user back to. */
export const APP_ORIGINS: readonly string[] = [ACCOUNTS_URL, SUGRPAY_URL].filter(Boolean);
