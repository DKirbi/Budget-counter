/**
 * Test helpers for anything rendered with the design system.
 * Import from `@tbc/ui-native/testing` in Jest tests (not in production code).
 * @module testing
 */
import { PortalHost } from '@rn-primitives/portal';
import { render } from '@testing-library/react-native';
import * as React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Provides safe-area metrics and a portal host (needed by dialogs) without any native modules. */
export function TestProviders({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      {children}
      <PortalHost />
    </SafeAreaProvider>
  );
}

/**
 * `render` with {@link TestProviders}.
 * @param ui - Element under test.
 * @returns RNTL's render result (synchronous in RNTL 13).
 */
export function renderUI(ui: React.ReactElement) {
  return render(ui, { wrapper: TestProviders });
}
