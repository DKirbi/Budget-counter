/**
 * AppProviders — everything the screens need, in the right order:
 * store → hydration gate (keeps the splash screen up until saved data is read) → theme/safe-area/portal.
 * @module providers
 */
import type { BudgetStore } from '@tbc/core';
import { BudgetProvider, useBudget, useHydrated } from '@tbc/core/react';
import { UIProvider } from '@tbc/ui-native';
import * as SplashScreen from 'expo-splash-screen';
import * as React from 'react';
import { appStore } from './store';

// Keep the native splash up until persisted data is loaded. Errors mean it was already hidden
// (fast refresh) or we are in a test — safe to ignore.
void Promise.resolve(SplashScreen.preventAutoHideAsync()).catch(() => undefined);

function Shell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const theme = useBudget((s) => s.settings.theme);
  React.useEffect(() => {
    if (hydrated) void Promise.resolve(SplashScreen.hideAsync()).catch(() => undefined);
  }, [hydrated]);
  if (!hydrated) return null;
  return <UIProvider themePreference={theme}>{children}</UIProvider>;
}

/** Props for {@link AppProviders}. */
export interface AppProvidersProps {
  children: React.ReactNode;
  /** Override the store (tests). */
  store?: BudgetStore;
  /** Freeze "today" (tests). */
  today?: string;
}

/**
 * Wrap the router in the app's providers.
 * @example
 * <AppProviders><Stack /></AppProviders>
 */
export function AppProviders({ children, store = appStore, today }: AppProvidersProps) {
  return (
    <BudgetProvider store={store} today={today}>
      <Shell>{children}</Shell>
    </BudgetProvider>
  );
}
