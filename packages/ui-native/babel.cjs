/**
 * Shared Babel config for NativeWind v4 + Expo. Each app/package re-exports it:
 *   module.exports = require('@tbc/ui-native/babel');
 */
module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
  };
};
