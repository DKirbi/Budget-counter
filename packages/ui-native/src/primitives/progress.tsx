/**
 * Progress — horizontal bar with an accessible value. Used for day cards and category shares.
 * @module primitives/progress
 */
import * as ProgressPrimitive from '@rn-primitives/progress';
import * as React from 'react';
import { cn } from '../lib/cn';

/** Props for {@link Progress}. */
export type ProgressProps = React.ComponentProps<typeof ProgressPrimitive.Root> & {
  /** Classes for the filled part, e.g. `bg-warning`. */
  indicatorClassName?: string;
  /**
   * The bar only repeats what a parent already announces (day card, category row), so hide it from screen readers.
   * Without this, give the bar its own `aria-label` — an unnamed progressbar is an accessibility violation.
   */
  decorative?: boolean;
};

/**
 * Progress bar.
 * @param value - 0..100 (clamped).
 * @example
 * <Progress value={62} aria-label="Budget used" indicatorClassName="bg-warning" />
 * <Progress value={62} decorative /> // when a parent already says "62% used"
 */
export function Progress({
  className,
  indicatorClassName,
  value = 0,
  decorative,
  ...props
}: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value ?? 0));
  const hidden = decorative
    ? ({
        'aria-hidden': true,
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
      } as const)
    : undefined;
  return (
    <ProgressPrimitive.Root
      {...hidden}
      value={clamped}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-secondary', className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn('h-full rounded-full bg-primary', indicatorClassName)}
        style={{ width: `${clamped}%` }}
      />
    </ProgressPrimitive.Root>
  );
}
