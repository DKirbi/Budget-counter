/**
 * Switch — on/off toggle built on rn-primitives (role `switch`, `checked` state).
 * @module primitives/switch
 */
import * as SwitchPrimitives from '@rn-primitives/switch';
import * as React from 'react';
import { cn } from '../lib/cn';

/** Props for {@link Switch}. */
export type SwitchProps = React.ComponentProps<typeof SwitchPrimitives.Root>;

/**
 * Toggle switch.
 * @example
 * <Switch checked={split} onCheckedChange={setSplit} accessibilityLabel="Split payment" />
 */
export function Switch({ className, checked, ...props }: SwitchProps) {
  return (
    <SwitchPrimitives.Root
      checked={checked}
      className={cn(
        'h-8 w-14 flex-row items-center rounded-full border-2 border-transparent',
        checked ? 'bg-primary' : 'bg-input',
        props.disabled && 'opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          'h-7 w-7 rounded-full bg-background shadow-md',
          checked ? 'translate-x-6' : 'translate-x-0',
        )}
      />
    </SwitchPrimitives.Root>
  );
}
