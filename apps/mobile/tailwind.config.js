const path = require('node:path');

// Shared config (tokens preset + NativeWind preset + ui-native/screens content globs),
// plus this app's own files.
module.exports = require('@tbc/ui-native/tailwind')([
  path.join(__dirname, 'app/**/*.{ts,tsx}'),
  path.join(__dirname, 'src/**/*.{ts,tsx}'),
]);
