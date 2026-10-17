/**
 * Same Tailwind config the Expo app uses (`@tbc/ui-native/tailwind`): NativeWind preset + design tokens.
 * Storybook only adds its own content globs, so a class works identically on device and here.
 */
const path = require('node:path');

module.exports = require('@tbc/ui-native/tailwind')([
  path.join(__dirname, 'stories/**/*.{ts,tsx,mdx}'),
  path.join(__dirname, '.storybook/**/*.{ts,tsx}'),
]);
