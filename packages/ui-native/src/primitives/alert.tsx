/**
 * Alert — inline message with icon, title and optional description.
 * `role="alert"` so screen readers announce it when it appears (e.g. "You're over today's limit").
 * @module primitives/alert
 */
import { cva, type VariantProps } from 'class-variance-authority';
import type { LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';
import { cn } from '../lib/cn';
import { Icon } from './icon';
import { Text } from './text';

const alertVariants = cva('flex-row items-start gap-3 rounded-xl border p-3', {
  variants: {
    variant: {
      default: 'border-border bg-card',
      destructive: 'border-destructive/40 bg-destructive/10',
      success: 'border-success/40 bg-success/10',
      warning: 'border-warning/50 bg-warning/15',
      info: 'border-info/40 bg-info/10',
    },
  },
  defaultVariants: { variant: 'default' },
});

const iconTone: Record<NonNullable<VariantProps<typeof alertVariants>['variant']>, string> = {
  default: 'text-foreground',
  destructive: 'text-destructive',
  success: 'text-success',
  warning: 'text-warning',
  info: 'text-info',
};

/** Props for {@link Alert}. */
export interface AlertProps extends VariantProps<typeof alertVariants> {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  testID?: string;
}

/**
 * Inline alert.
 * @example
 * <Alert variant="warning" icon={TriangleAlert} title="Close to today's limit" description="€3.20 left." />
 */
export function Alert({
  variant = 'default',
  icon,
  title,
  description,
  className,
  testID,
}: AlertProps) {
  return (
    <View
      accessible
      role="alert"
      testID={testID}
      className={cn(alertVariants({ variant }), className)}
    >
      {icon ? (
        <Icon as={icon} size={20} className={cn('mt-0.5', iconTone[variant ?? 'default'])} />
      ) : null}
      <View className="flex-1 gap-0.5">
        <Text variant="small" className="leading-5">
          {title}
        </Text>
        {description ? <Text variant="muted">{description}</Text> : null}
      </View>
    </View>
  );
}
