/**
 * Separator — 1px divider, horizontal by default.
 * @module primitives/separator
 */
import * as React from 'react';
import { View } from 'react-native';
import { cn } from '../lib/cn';

/** Props for {@link Separator}. */
export type SeparatorProps = React.ComponentProps<typeof View> & {
  orientation?: 'horizontal' | 'vertical';
};

/** Thin rule. Decorative, so hidden from assistive tech. */
export function Separator({ className, orientation = 'horizontal', ...props }: SeparatorProps) {
  return (
    <View
      role="presentation"
      aria-hidden
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  );
}
