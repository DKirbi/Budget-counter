/**
 * Global Jest setup for RN packages.
 * - Silences the act() environment warning noise from third-party libs.
 */
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * In the app, the NativeWind Metro plugin compiles `global.css` and injects the Tailwind `darkMode: 'class'`
 * flag at runtime. Jest doesn't run that pipeline, so without the flag `useColorScheme().setColorScheme()`
 * throws ("Unable to manually set color scheme without using darkMode: class"). Mirror the flag here.
 */
try {
  require('react-native-css-interop/dist/runtime/native/globals').flags.set('darkMode', 'class');
} catch {
  // css-interop internals moved — screens that call setColorScheme will fail loudly, which is fine.
}
