module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
    // sanitize-html's parser (htmlparser2 and its dom* / entities packages)
    // ships only as ES modules. Node 24 in production loads them with
    // require(); Jest doesn't, so convert just those packages.
    '^.+\\.js$': ['ts-jest', { tsconfig: { allowJs: true }, isolatedModules: true }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(htmlparser2|domhandler|domutils|domelementtype|dom-serializer|entities)/)',
  ],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/index.ts', '!src/config/**'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  // `moduleNameMapper`, not `moduleNameMapping`. Jest ignores unknown keys, so
  // the typo silently disabled the @/ alias and every suite importing a source
  // file failed to resolve its imports.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  testTimeout: 30000,
  maxWorkers: 1,
  forceExit: true,
  detectOpenHandles: true,
};
