/**
 * EmptyState — icon, headline, explanation and a call to action for screens with no data yet.
 * @module domain/empty-state
 */
import type { LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';
import { cn } from '../lib/cn';
import { Icon } from '../primitives/icon';
import { Text } from '../primitives/text';

/** Props for {@link EmptyState}. */
export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Usually a `<Button>`. */
  action?: React.ReactNode;
  className?: string;
  testID?: string;
}

/**
 * Empty placeholder.
 * @example
 * <EmptyState icon={Plane} title="No trips yet" description="Plan one to get a daily allowance." action={<Button>…</Button>} />
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  testID,
}: EmptyStateProps) {
  return (
    <View testID={testID} className={cn('items-center gap-3 px-6 py-10', className)}>
      <View className="h-16 w-16 items-center justify-center rounded-full bg-accent">
        <Icon as={icon} size={32} className="text-accent-foreground" />
      </View>
      <Text variant="h3" aria-level={2} className="text-center">
        {title}
      </Text>
      {description ? (
        <Text variant="muted" className="text-center">
          {description}
        </Text>
      ) : null}
      {action ? <View className="mt-2 w-full">{action}</View> : null}
    </View>
  );
}
