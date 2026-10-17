/**
 * Metro config: Expo defaults (which already understand pnpm/npm workspaces) + NativeWind.
 * `inlineRem: 16` makes `1rem = 16dp` like the web, so a class means the same size on every platform.
 */
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });
