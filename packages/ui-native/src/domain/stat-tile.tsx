/**
 * StatTile — a label + big value + hint, for the trip summary grid.
 * @module domain/stat-tile
 */
import * as React from 'react';
import { View } from 'react-native';
import { cn } from '../lib/cn';
import { Text } from '../primitives/text';

/** Props for {@link StatTile}. */
export interface StatTileProps {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'positive' | 'negative';
  className?: string;
  testID?: string;
}

const TONE = {
  default: 'text-foreground',
  positive: 'text-success',
  negative: 'text-destructive',
} as const;

/**
 * Metric tile.
 * @example
 * <StatTile label="Avg per day" value="€38.20" hint="over 3 days" />
 */
export function StatTile({
  label,
  value,
  hint,
  tone = 'default',
  className,
  testID,
}: StatTileProps) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}${hint ? `, ${hint}` : ''}`}
      testID={testID}
      className={cn('flex-1 gap-1 rounded-xl border border-border bg-card p-3', className)}
    >
      <Text variant="caption">{label}</Text>
      <Text className={cn('text-xl font-bold tabular-nums', TONE[tone])}>{value}</Text>
      {hint ? <Text variant="caption">{hint}</Text> : null}
    </View>
  );
}
