/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          jsx: 'react-jsx',
          isolatedModules: true,
          esModuleInterop: true,
          moduleResolution: 'node10',
          ignoreDeprecations: '6.0',
        },
        diagnostics: false,
      },
    ],
  },
  testMatch: ['<rootDir>/src/**/*.test.ts?(x)'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts', '!src/index.ts'],
  coverageThreshold: { global: { statements: 90, branches: 80, functions: 90, lines: 90 } },
};
