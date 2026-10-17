/**
 * Theme access + the root provider.
 *
 * Styling flows through NativeWind classes wherever possible. The few places that cannot use a
 * className (SVG strokes, navigation chrome) read resolved colours from {@link useTheme}.
 * @module theme
 */
import { PortalHost } from '@rn-primitives/portal';
import { type ThemeName, themes } from '@tbc/tokens';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { View } from 'react-native';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';

/** Colour preference a user can pick. */
export type ThemePreference = 'system' | 'light' | 'dark';

/**
 * Resolved theme for the current colour scheme.
 * @returns `scheme` (`'light' | 'dark'`) and `colors`, the semantic palette as hex strings.
 * @example
 * const { colors } = useTheme();
 * <Circle stroke={colors.primary} />
 */
export function useTheme(): { scheme: ThemeName; colors: (typeof themes)[ThemeName] } {
  const { colorScheme } = useColorScheme();
  const scheme: ThemeName = colorScheme === 'dark' ? 'dark' : 'light';
  return { scheme, colors: themes[scheme] };
}

/** Props for {@link UIProvider}. */
export interface UIProviderProps {
  /** `'system'` follows the OS. */
  themePreference?: ThemePreference;
  /**
   * Skip the first-frame safe-area measurement. `react-native-safe-area-context` renders nothing until it has
   * measured the window on the web, which makes Storybook `play` functions race the first paint; pass fixed metrics there.
   */
  initialSafeAreaMetrics?: Metrics;
  children: React.ReactNode;
}

/**
 * Root provider: safe-area context, colour scheme, and the portal host that dialogs render into.
 * Mount once, as high as possible.
 * @example
 * <UIProvider themePreference={settings.theme}><Stack /></UIProvider>
 */
export function UIProvider({
  themePreference = 'system',
  initialSafeAreaMetrics,
  children,
}: UIProviderProps) {
  const { setColorScheme } = useColorScheme();
  React.useEffect(() => {
    setColorScheme(themePreference);
  }, [themePreference, setColorScheme]);
  return (
    <SafeAreaProvider initialMetrics={initialSafeAreaMetrics}>
      <View className="flex-1 bg-background">{children}</View>
      <PortalHost />
    </SafeAreaProvider>
  );
}
