'use server';

import { redirect } from 'next/navigation';
import { enableProductsSchema, isProduct, type Product } from '@platform/platform-contracts';
import { ApiError, conflictCodeOf, continueIntoProduct, enableProducts } from '@/accounts/lib/api';
import { routeForStep } from '@/accounts/lib/onboarding';

export interface ProductsActionState {
  readonly error?: string;
  /** Where the browser goes next, by a full navigation (window.location),
   * so the token in the URL fragment survives: a redirect() to this app's own
   * address is followed by the client router, which drops the fragment. */
  readonly goTo?: string;
}

/**
 * Sends the user into a product: the API issues a JWT only for a product
 * enabled for the company, and the user goes to the product's address with
 * the token in the URL fragment, so it never reaches a server's logs.
 */
async function launch(product: Product): Promise<string> {
  const { url, token } = await continueIntoProduct(product);
  return `${url}#token=${encodeURIComponent(token)}`;
}

/** Enables the selected products. With exactly one enabled, the user goes
 * straight into it; with more, they choose with the Continue buttons. */
export async function enableProductsAction(
  _prevState: ProductsActionState,
  formData: FormData,
): Promise<ProductsActionState> {
  const parsed = enableProductsSchema.safeParse({
    products: formData.getAll('product').map(String),
  });
  if (!parsed.success) {
    return { error: 'Select at least one product to continue.' };
  }

  let target: string;
  try {
    const result = await enableProducts(parsed.data.products);
    if (!result.continueWith) {
      // More than one enabled: the user chooses with the Continue buttons.
      target = '/accounts';
    } else {
      return { goTo: await launch(result.continueWith) };
    }
  } catch (error) {
    const code = conflictCodeOf(error);
    if (code === 'COMPANY_NOT_REGISTERED') redirect(routeForStep('REGISTER_COMPANY'));
    if (code === 'ADD_BRAND_FIRST') redirect(routeForStep('ADD_BRAND'));
    if (code === 'PRODUCT_NOT_AVAILABLE') {
      // Enabled, but it has no web address yet: stay here, where it shows.
      redirect('/accounts');
    }
    if (error instanceof ApiError && error.status === 403) {
      return { error: 'Only the Company Admin can enable products.' };
    }
    return { error: 'The products could not be enabled. Please try again.' };
  }
  redirect(target);
}

/** Continue into one enabled product. */
export async function continueAction(
  _prevState: ProductsActionState,
  formData: FormData,
): Promise<ProductsActionState> {
  const product = String(formData.get('product') ?? '');
  if (!isProduct(product)) return { error: 'Choose a product to open.' };

  try {
    return { goTo: await launch(product) };
  } catch (error) {
    const code = conflictCodeOf(error);
    if (code === 'PRODUCT_NOT_ENABLED') return { error: 'This product is not enabled.' };
    if (code === 'PRODUCT_NOT_AVAILABLE') return { error: 'This product is not available yet.' };
    return { error: 'The product could not be opened. Please try again.' };
  }
}
