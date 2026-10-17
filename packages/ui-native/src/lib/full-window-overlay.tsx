/**
 * Default (Android / web / tests): no wrapper needed — portals already render above screens.
 * The iOS variant lives in `full-window-overlay.ios.tsx`.
 * @module lib/full-window-overlay
 */
import * as React from 'react';

/** Renders children as-is. */
export function FullWindowOverlay({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
