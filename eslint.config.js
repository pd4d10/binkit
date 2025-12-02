export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.config.ts'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: await import('@typescript-eslint/parser').then(m => m.default),
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
]
