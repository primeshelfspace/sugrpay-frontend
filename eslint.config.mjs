// Lint import rules — dependency direction only (no style rules). They fail
// `pnpm lint` and show in the editor as soon as a wrong import is typed.
import nextPlugin from '@next/eslint-plugin-next';
import importPlugin from 'eslint-plugin-import';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const restrictedPackages = (paths) => [
  'error',
  { paths: paths.map(([name, message]) => ({ name, message })) },
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.next-*/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/*.d.ts',
    ],
  },
  {
    // Rules from these plugins are not switched on here; they are registered
    // so existing `eslint-disable` comments naming them stay valid.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: { parser: tseslint.parser },
    plugins: {
      import: importPlugin,
      '@typescript-eslint': tseslint.plugin,
      'react-hooks': reactHooksPlugin,
      '@next/next': nextPlugin,
    },
    settings: {
      'import/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx', '.mts', '.cts'] },
      'import/resolver': {
        typescript: { project: ['apps/*/tsconfig.json', 'packages/*/tsconfig.json'] },
      },
    },
  },
  // The public payment pages (/pay) are in PCI scope: they never pull in the
  // admin contracts (users, roles, brands management).
  {
    files: ['apps/sugrpay/src/app/pay/**/*.{ts,tsx}', 'apps/sugrpay/src/pay/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictedPackages([
        ['@platform/platform-contracts', 'The public payment pages do not use admin contracts.'],
      ]),
    },
  },
  // The kernel sits at the bottom: it imports no contracts and no UI.
  {
    files: ['packages/kernel/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictedPackages([
        ['@platform/platform-contracts', 'The kernel depends on nothing above it.'],
        ['@platform/invoicing-contracts', 'The kernel depends on nothing above it.'],
        ['@platform/ui', 'The kernel depends on nothing above it.'],
      ]),
    },
  },
);
