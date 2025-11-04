module.exports = {
  root: true,
  env: { 
    browser: true, 
    es2020: true,
    node: true 
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  ignorePatterns: ['dist', '.eslintrc.js', 'node_modules'],
  rules: {
    'no-unused-vars': 'warn',
    'no-console': 'warn',
  },
}