module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist/**', 'android/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', '*.tsbuildinfo'],
  overrides: [
    {
      files: ['*.config.*', '.eslintrc.cjs', 'e2e/**/*.ts'],
      env: { node: true },
    },
  ],
}
