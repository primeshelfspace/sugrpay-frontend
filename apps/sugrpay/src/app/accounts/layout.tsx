import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Accounts — Sugrpay',
  description: 'Sign in, team, brands, locations and billing.',
};

/**
 * The /accounts section. The page shell (fonts, toasts) is the app's root
 * layout; the signed-in chrome is (app)/layout.tsx, so the sign-in pages
 * render without it.
 */
export default function AccountsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
