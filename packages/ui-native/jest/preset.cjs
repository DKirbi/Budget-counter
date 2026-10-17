/**
 * Shared Jest preset for React Native packages: jest-expo + NativeWind + our workspace packages.
 * Usage in a package's jest.config.cjs: `module.exports = { preset: '@tbc/ui-native/jest', ... }`
 */
const expoPreset = require('jest-expo/jest-preset');

module.exports = {
  ...expoPreset,
  setupFilesAfterEnv: [...(expoPreset.setupFilesAfterEnv ?? []), require.resolve('./setup.js')],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|expo-.*|react-navigation|@react-navigation/.*|react-native-svg|react-native-css-interop|nativewind|@rn-primitives/.*|lucide-react-native|zustand|standard-navigation))',
  ],
  // Some deps (lucide-react-native) ship ESM as .mjs, which jest-expo's default transform skips.
  transform: {
    ...(expoPreset.transform ?? {}),
    '\\.mjs$': ['babel-jest', { caller: { name: 'metro', bundler: 'metro', platform: 'ios' } }],
  },
  moduleNameMapper: {
    ...(expoPreset.moduleNameMapper ?? {}),
    '\\.css$': require.resolve('./style-mock.js'),
  },
};
