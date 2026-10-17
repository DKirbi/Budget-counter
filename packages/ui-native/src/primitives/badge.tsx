/**
 * Badge — compact status pill. The `success` / `warning` / `info` variants are domain additions to
 * shadcn's set; they map 1:1 to the day statuses from the allowance engine.
 * @module primitives/badge
 */
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { View } from 'react-native';
import { cn } from '../lib/cn';
import { TextClassContext } from './text';

const badgeVariants = cva(
  'flex-row items-center gap-1 self-start rounded-full border px-2.5 py-0.5',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary',
        secondary: 'border-transparent bg-secondary',
        destructive: 'border-transparent bg-destructive',
        outline: 'border-border bg-transparent',
        success: 'border-transparent bg-success',
        warning: 'border-transparent bg-warning',
        info: 'border-transparent bg-info',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

const badgeTextVariants = cva('text-xs font-semibold', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      secondary: 'text-secondary-foreground',
      destructive: 'text-destructive-foreground',
      outline: 'text-foreground',
      success: 'text-success-foreground',
      warning: 'text-warning-foreground',
      info: 'text-info-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
});

/** Props for {@link Badge}. */
export type BadgeProps = React.ComponentProps<typeof View> & VariantProps<typeof badgeVariants>;

/**
 * Status pill.
 * @example
 * <Badge variant="warning"><Text>Near limit</Text></Badge>
 */
export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <TextClassContext.Provider value={badgeTextVariants({ variant })}>
      <View className={cn(badgeVariants({ variant }), className)} {...props} />
    </TextClassContext.Provider>
  );
}
