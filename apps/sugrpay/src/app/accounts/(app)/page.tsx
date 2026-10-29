import { listProducts } from '@/accounts/lib/api';
import { requireOnboardingStep } from '@/accounts/lib/onboarding';
import { PageHeader } from '@/accounts/components/page-header';
import { ProductPicker } from './product-picker';

export const dynamic = 'force-dynamic';

/**
 * Select Your Products & Redirect: the last onboarding step, and the screen
 * every user sees after signing in. Reached only once the company is
 * registered and has a brand (the guard sends anyone else to their step).
 */
export default async function SelectProductsPage() {
  const { user } = await requireOnboardingStep('SELECT_PRODUCTS');
  const { products, onboardingComplete } = await listProducts();

  return (
    <>
      <PageHeader
        title={onboardingComplete ? `Welcome, ${firstName(user.name)}` : 'Select Your Products'}
        description={
          onboardingComplete
            ? 'Continue into a product, or enable another one.'
            : 'Choose the products your company will use. You can enable more later.'
        }
      />
      <ProductPicker products={products} />
    </>
  );
}

function firstName(name: string): string {
  return name.split(' ')[0] || name;
}
