/** @type {import('jest').Config} */
module.exports = {
  ...require('./jest/preset.cjs'),
  rootDir: __dirname,
  testMatch: ['<rootDir>/src/**/*.test.ts?(x)'],
};
