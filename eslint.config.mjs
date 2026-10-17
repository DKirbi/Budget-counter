/**
 * One ESLint flat config for the whole monorepo.
 *
 * Highlights
 *  - TypeScript + React Hooks rules everywhere (`react-hooks` catches stale closures and conditional hooks).
 *  - **Documentation is enforced**: every exported function, component, hook, constant and public type in library
 *    source needs a JSDoc block (`jsdoc/require-jsdoc`), and `@param`/`@returns` tags, when present, must be well-formed.
 *    Tests, stories and generated files are exempt.
 */
import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/generated/**',
      '**/storybook-static/**',
      '**/.expo/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/android/**',
      '**/ios/**',
      '**/*.d.ts',
      '**/babel.config.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser, __DEV__: 'readonly' } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports', prefer: 'type-imports' },
      ],
      '@typescript-eslint/no-require-imports': 'off', // CommonJS config files + Jest `require` in tests
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // We do not use the React Compiler; react-hook-form's `watch()` is fine without it.
      'react-hooks/incompatible-library': 'off',
    },
  },
  { files: ['packages/tokens/scripts/**', 'scripts/**'], rules: { 'no-console': 'off' } },
  {
    // Library source: documentation is part of the contract.
    files: ['packages/*/src/**/*.{ts,tsx}', 'apps/mobile/src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', '**/*.stories.{ts,tsx}', '**/testing*.{ts,tsx}'],
    plugins: { jsdoc },
    rules: {
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
          contexts: [
            'ExportNamedDeclaration > VariableDeclaration',
            'TSInterfaceDeclaration',
            'TSTypeAliasDeclaration',
          ],
          checkConstructors: false,
        },
      ],
      'jsdoc/check-param-names': ['error', { checkDestructured: false }],
      'jsdoc/require-param-description': 'off',
      'jsdoc/check-tag-names': ['error', { definedTags: ['packageDocumentation', 'module'] }],
      'jsdoc/no-types': 'error', // TypeScript already has the types
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', '**/jest*.{js,cjs}', '**/jest/**'],
    languageOptions: { globals: { ...globals.jest } },
  },
  {
    // Storybook: `play` functions are async/await heavy and the hooks rule misreads `render` functions.
    files: ['**/*.stories.{ts,tsx}', 'apps/storybook/.storybook/**'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },
);
