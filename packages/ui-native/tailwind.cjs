/**
 * Tailwind config factory shared by every NativeWind consumer (Expo app, Storybook, Jest).
 * Keeps `content` globs in one place so a class used in ui-native is never purged in the app.
 *
 * @param {string[]} content - Extra content globs (absolute paths) for the calling app.
 * @returns {import('tailwindcss').Config}
 */
module.exports = function createTailwindConfig(content = []) {
  const path = require('node:path');
  const workspace = path.resolve(__dirname, '..');
  return {
    content: [
      path.join(workspace, 'ui-native/src/**/*.{ts,tsx}'),
      path.join(workspace, 'screens-native/src/**/*.{ts,tsx}'),
      ...content,
    ],
    // Order matters: NativeWind's preset first, then our tokens (which override colours/spacing/radius).
    presets: [require('nativewind/preset'), require('@tbc/tokens/tailwind-preset')],
    plugins: [],
  };
};
