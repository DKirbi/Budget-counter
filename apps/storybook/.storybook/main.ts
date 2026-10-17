/**
 * Storybook 10 + react-native-web + Vite.
 *
 * The very same React Native components the phone runs are rendered here on the web:
 *  - `react-native` is aliased to `react-native-web` by the framework,
 *  - `className` is styled by real Tailwind CSS (NativeWind's web path), fed by the SAME token preset,
 *  - `@rn-primitives/*` render Radix UI on the web.
 * @see ../../docs/DESIGN_SYSTEM.md
 */
import type { StorybookConfig } from '@storybook/react-native-web-vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const packages = path.resolve(here, '../../../packages');

/**
 * `react-native-css-interop/dist/doctor.js` is a *CommonJS file that contains JSX* (a self-test that checks the
 * JSX pragma is wired). vite-plugin-rnw compiles every `.js` file as JSX, which injects an `import` into that
 * CJS file and produces the runtime error "exports is not defined" in production builds.
 * The self-test is meaningless on web (Vite is our JSX pipeline), so replace the module with an always-true stub.
 */
const cssInteropDoctorStub = (): Plugin => {
  const VIRTUAL = '\0tbc-css-interop-doctor';
  return {
    name: 'tbc:css-interop-doctor-stub',
    enforce: 'pre',
    resolveId(source, importer) {
      if (importer?.includes('react-native-css-interop') && /(^|\/)doctor(\.js)?$/.test(source))
        return VIRTUAL;
      return null;
    },
    load(id) {
      return id === VIRTUAL
        ? 'export const verifyJSX = () => true;\nexport const verifyFlag = () => true;\nexport const verifyData = () => true;\n'
        : null;
    },
  };
};

const config: StorybookConfig = {
  framework: {
    name: '@storybook/react-native-web-vite',
    options: {
      // `jsxImportSource: 'nativewind'` makes `<View className>` work (same as the Expo Babel preset). Only these
      // node_modules packages need that pass (they render RN views from our className props). Everything else
      // — react-native-web, nativewind, react-native-css-interop (CJS!) — must stay untouched.
      // The framework's default `exclude` matches by prefix ("react-native" also swallows react-native-css-interop),
      // so we spell the allow-list out with directory boundaries.
      pluginReactOptions: {
        jsxImportSource: 'nativewind',
        exclude:
          /node_modules\/(?!(?:@rn-primitives|lucide-react-native|react-native-svg|react-native-safe-area-context)\/)/,
      },
    },
  },
  stories: [
    '../stories/**/*.mdx',
    '../stories/**/*.stories.@(ts|tsx)',
    `${packages}/ui-native/src/**/*.mdx`,
    `${packages}/ui-native/src/**/*.stories.@(ts|tsx)`,
    `${packages}/screens-native/src/**/*.stories.@(ts|tsx)`,
  ],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  typescript: {
    reactDocgen: 'react-docgen-typescript',
  },
  core: { disableTelemetry: true },
  async viteFinal(viteConfig) {
    const { mergeConfig } = await import('vite');
    // Must run before vite-plugin-rnw's transforms, so put it first.
    viteConfig.plugins = [cssInteropDoctorStub(), ...(viteConfig.plugins ?? [])];
    return mergeConfig(viteConfig, {
      define: {
        __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
        'process.env.EXPO_OS': JSON.stringify('web'),
      },
      resolve: {
        // One copy of each, however many workspace packages depend on them.
        dedupe: [
          'react',
          'react-dom',
          'react-native-web',
          'nativewind',
          'react-native-css-interop',
        ],
      },
      css: { postcss: path.resolve(here, '..') },
      server: { fs: { allow: [path.resolve(here, '../../..')] } },
    });
  },
};

export default config;
