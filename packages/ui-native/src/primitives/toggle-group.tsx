/**
 * ToggleGroup — single-choice chips (used by the tag picker). Built on rn-primitives so selection
 * is exposed to assistive tech as `checked`/`selected` state.
 * @module primitives/toggle-group
 */
import * as ToggleGroupPrimitive from '@rn-primitives/toggle-group';
import * as React from 'react';
import { cn } from '../lib/cn';
import { TextClassContext } from './text';

/** Group container. Use `type="single"` for radio-like behaviour. */
export function ToggleGroup({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root className={cn('flex-row flex-wrap gap-2', className)} {...props} />
  );
}

/** One chip. */
export function ToggleGroupItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  const root = ToggleGroupPrimitive.useRootContext();
  const selected = ToggleGroupPrimitive.utils.getIsSelected(root.value, props.value);
  return (
    <TextClassContext.Provider
      value={cn('text-sm font-medium', selected ? 'text-primary-foreground' : 'text-foreground')}
    >
      <ToggleGroupPrimitive.Item
        className={cn(
          'h-11 flex-row items-center justify-center gap-2 rounded-full border px-4',
          selected ? 'border-primary bg-primary' : 'border-input bg-card active:bg-accent',
          props.disabled && 'opacity-50',
          className,
        )}
        // Single-select chips are a radio group: `role="button"` + `aria-checked` is invalid ARIA.
        {...(root.type === 'single' ? { role: 'radio' as const, 'aria-checked': selected } : null)}
        {...props}
      >
        {children}
      </ToggleGroupPrimitive.Item>
    </TextClassContext.Provider>
  );
}
