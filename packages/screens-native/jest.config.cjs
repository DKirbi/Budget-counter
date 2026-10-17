const preset = require('@tbc/ui-native/jest');

/** @type {import('jest').Config} */
module.exports = {
  ...preset,
  rootDir: __dirname,
  setupFilesAfterEnv: [...preset.setupFilesAfterEnv, '<rootDir>/jest.setup.js'],
  testMatch: ['<rootDir>/src/**/*.test.ts?(x)'],
};
