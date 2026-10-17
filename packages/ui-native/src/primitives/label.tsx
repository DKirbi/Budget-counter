/**
 * Label — accessible form label. Tapping it forwards the press to the associated control on native
 * (via rn-primitives) and to `htmlFor` on web.
 * @module primitives/label
 */
import * as LabelPrimitive from '@rn-primitives/label';
import * as React from 'react';
import { cn } from '../lib/cn';

/** Props for {@link Label}. */
export type LabelProps = React.ComponentProps<typeof LabelPrimitive.Text> &
  Pick<
    React.ComponentProps<typeof LabelPrimitive.Root>,
    'onPress' | 'onLongPress' | 'onPressIn' | 'onPressOut' | 'disabled'
  >;

/**
 * Form label.
 * @example
 * <Label nativeID="amount">Amount</Label>
 */
export function Label({
  className,
  onPress,
  onLongPress,
  onPressIn,
  onPressOut,
  disabled,
  ...props
}: LabelProps) {
  return (
    <LabelPrimitive.Root
      className={cn('flex select-none flex-row items-center gap-2', disabled && 'opacity-50')}
      {...{ onPress, onLongPress, onPressIn, onPressOut, disabled }}
    >
      <LabelPrimitive.Text
        className={cn('text-sm font-medium leading-none text-foreground', className)}
        {...props}
      />
    </LabelPrimitive.Root>
  );
}
