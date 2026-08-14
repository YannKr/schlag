// https://docs.expo.dev/guides/using-eslint/
//
// The lint script passes --max-warnings 25, which is the count of
// pre-existing warnings on main at the time this config was added. New code
// must not add to it. The number goes down as those warnings are cleared; it
// should never go up.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'node_modules/*', 'playwright-report/*', 'test-results/*'],
  },
  {
    rules: {
      // The test suites call jest.mock() before importing the module under
      // test, which is the documented order and cannot be changed.
      'import/first': 'off',

      // Splitting `import type { X }` from `import { y }` of the same module
      // is the convention throughout this codebase.
      'import/no-duplicates': 'off',
    },
  },
  {
    // TypeScript-only rules — the @typescript-eslint plugin is registered by
    // eslint-config-expo for these file patterns alone.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Both Array<T> and T[] appear in the existing sources; neither form is
      // worth a repo-wide rewrite.
      '@typescript-eslint/array-type': 'off',

      // `catch (error)` with an unused binding is used deliberately in the
      // audio and storage layers, where the failure is swallowed on purpose.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
    },
  },
]);
