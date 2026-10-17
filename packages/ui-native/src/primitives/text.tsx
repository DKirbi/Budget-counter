/**
 * Text — the only way to render text. Wraps RN `Text` with the type scale from the tokens and a
 * context that lets parents (Button, Badge, ...) set a text style their children inherit.
 * @module primitives/text
 */
import * as Slot from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Text as RNText } from 'react-native';
import { cn } from '../lib/cn';

/** Lets a parent component push text classes (colour, size, weight) down to nested `<Text>`. */
export const TextClassContext = React.createContext<string | undefined>(undefined);

/** Typographic variants. `numeric` uses tabular figures so amounts don't jitter as digits change. */
export const textVariants = cva('text-base text-foreground', {
  variants: {
    variant: {
      default: '',
      h1: 'text-4xl font-bold tracking-tight',
      h2: 'text-2xl font-semibold tracking-tight',
      h3: 'text-xl font-semibold',
      lead: 'text-lg text-muted-foreground',
      body: 'text-base',
      small: 'text-sm font-medium leading-none',
      caption: 'text-xs text-muted-foreground',
      muted: 'text-sm text-muted-foreground',
      numeric: 'text-base font-semibold tabular-nums',
    },
  },
  defaultVariants: { variant: 'default' },
});

const HEADING_LEVEL = { h1: 1, h2: 2, h3: 3 } as const;

/** Props for {@link Text}. */
export type TextProps = React.ComponentProps<typeof RNText> &
  VariantProps<typeof textVariants> & {
    /** Render the child element instead of RN `Text` (Radix-style composition). */
    asChild?: boolean;
  };

/**
 * Themed text.
 * @example
 * <Text variant="h2">Today</Text>
 * <Text variant="numeric" className="text-primary">€42.00</Text>
 */
export function Text({ className, variant, asChild = false, role, ...props }: TextProps) {
  const inherited = React.useContext(TextClassContext);
  const Component = asChild ? Slot.Text : RNText;
  return (
    <Component
      className={cn(textVariants({ variant }), inherited, className)}
      {...(role === undefined && variant && variant in HEADING_LEVEL
        ? {
            role: 'heading' as const,
            'aria-level': HEADING_LEVEL[variant as keyof typeof HEADING_LEVEL],
          }
        : { role })}
      {...props}
    />
  );
}
