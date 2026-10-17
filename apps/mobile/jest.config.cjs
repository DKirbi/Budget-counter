const preset = require('@tbc/ui-native/jest');

/** @type {import('jest').Config} */
module.exports = {
  ...preset,
  rootDir: __dirname,
  // The first test compiles the whole route tree through Babel; with a cold cache (CI) that takes ~70 s.
  testTimeout: 120_000,
  testMatch: ['<rootDir>/__tests__/**/*.test.tsx'],
  // Keep the preset's setup files (they define __DEV__ etc.) and add ours.
  setupFiles: [...(preset.setupFiles ?? []), '<rootDir>/jest.setup.js'],
};
