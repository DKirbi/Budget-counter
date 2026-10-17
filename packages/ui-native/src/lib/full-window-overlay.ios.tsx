/**
 * iOS: native modals (Expo Router `presentation: 'modal'`) sit above the root view, so a dialog
 * portalled to the root would render *behind* them. `FullWindowOverlay` lifts the dialog into its
 * own window above everything.
 * @module lib/full-window-overlay.ios
 */
import * as React from 'react';
import { FullWindowOverlay as NativeOverlay } from 'react-native-screens';

/** Wraps children in a native full-window overlay. */
export function FullWindowOverlay({ children }: { children: React.ReactNode }) {
  return <NativeOverlay>{children}</NativeOverlay>;
}
