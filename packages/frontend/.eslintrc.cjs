module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules', '**/*.ts', '**/*.tsx'],
  rules: {
    'no-unused-vars': 'warn',
    'no-console': 'warn',
  },
}