/**
 * Input — single-line text field with the design system's border, radius and focus ring.
 * @module primitives/input
 */
import * as React from 'react';
import { Platform, TextInput } from 'react-native';
import { cn } from '../lib/cn';

/** Props for {@link Input}. `invalid` switches the border to the destructive colour. */
export type InputProps = React.ComponentProps<typeof TextInput> & { invalid?: boolean };

/**
 * Text input.
 * @example
 * <Input value={name} onChangeText={setName} placeholder="Lisbon long weekend" accessibilityLabel="Trip name" />
 */
export const Input = React.forwardRef<React.ComponentRef<typeof TextInput>, InputProps>(
  function Input({ className, placeholderClassName, invalid, editable = true, ...props }, ref) {
    return (
      <TextInput
        ref={ref}
        editable={editable}
        aria-invalid={invalid || undefined}
        className={cn(
          'h-11 rounded-lg border bg-card px-3 text-base text-foreground',
          invalid ? 'border-destructive' : 'border-input',
          !editable && 'opacity-50',
          Platform.select({
            web: 'outline-none focus-visible:ring-2 focus-visible:ring-ring',
            native: 'focus:border-ring',
          }),
          className,
        )}
        placeholderClassName={cn('text-muted-foreground', placeholderClassName)}
        {...props}
      />
    );
  },
);
