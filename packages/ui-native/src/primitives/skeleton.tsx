/**
 * Skeleton — pulsing placeholder shown while persisted data loads.
 * @module primitives/skeleton
 */
import * as React from 'react';
import { View } from 'react-native';
import { cn } from '../lib/cn';

/**
 * Grey block that pulses. Size it with `className` (`h-6 w-32`).
 *
 * Purely visual, so it is hidden from assistive tech. Mark the *container* being loaded with `aria-busy`
 * (and announce completion) — a "Loading" label on every block would be read out dozens of times.
 * @example
 * <View aria-busy><Skeleton className="h-4 w-2/3" /></View>
 */
export function Skeleton({ className, ...props }: React.ComponentProps<typeof View>) {
  return (
    <View
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}
