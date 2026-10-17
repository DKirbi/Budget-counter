/**
 * Button — shadcn's Button for React Native.
 * Variants and sizes come from CVA; the label colour is pushed down through {@link TextClassContext}
 * so `<Button variant="destructive"><Text>Delete</Text></Button>` just works.
 * @module primitives/button
 */
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Platform, Pressable } from 'react-native';
import { cn } from '../lib/cn';
import { TextClassContext } from './text';

/** Visual variants. Every size keeps a >= 44px hit area except `sm`, which is for dense secondary actions. */
export const buttonVariants = cva(
  cn(
    'group flex-row items-center justify-center gap-2 rounded-lg',
    Platform.select({
      web: 'outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors',
    }),
  ),
  {
    variants: {
      variant: {
        default: 'bg-primary active:bg-primary/90',
        destructive: 'bg-destructive active:bg-destructive/90',
        outline: 'border border-input bg-card active:bg-accent',
        secondary: 'bg-secondary active:bg-secondary/80',
        ghost: 'active:bg-accent',
        link: '',
      },
      size: {
        default: 'h-11 px-4',
        sm: 'h-9 px-3',
        lg: 'h-13 px-6',
        icon: 'h-11 w-11',
      },
      disabled: { true: 'opacity-50' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

/** Label styles per variant (applied to child `<Text>` via context). */
export const buttonTextVariants = cva('text-base font-semibold', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      destructive: 'text-destructive-foreground',
      outline: 'text-foreground',
      secondary: 'text-secondary-foreground',
      ghost: 'text-foreground',
      link: 'text-primary underline',
    },
    size: { default: '', sm: 'text-sm', lg: 'text-lg', icon: '' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

/** Props for {@link Button}. */
export type ButtonProps = React.ComponentProps<typeof Pressable> &
  Omit<VariantProps<typeof buttonVariants>, 'disabled'>;

/**
 * Pressable button with variants.
 * @example
 * <Button onPress={save}><Text>Save spend</Text></Button>
 * <Button variant="outline" size="icon" accessibilityLabel="Add"><Icon as={Plus} /></Button>
 */
export const Button = React.forwardRef<React.ComponentRef<typeof Pressable>, ButtonProps>(
  function Button({ className, variant, size, disabled, ...props }, ref) {
    return (
      <TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
        <Pressable
          ref={ref}
          role="button"
          disabled={disabled}
          accessibilityState={{ disabled: !!disabled }}
          className={cn(buttonVariants({ variant, size, disabled: !!disabled }), className)}
          {...props}
        />
      </TextClassContext.Provider>
    );
  },
);
