/**
 * DayCard — a day in the trip list: date, status, and how much of the available money is used.
 * @module domain/day-card
 */
import { formatDayLabel, formatMoney, type DayPlan } from '@tbc/core';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { cn } from '../lib/cn';
import { STATUS_STYLES } from '../lib/status';
import { Badge } from '../primitives/badge';
import { Progress } from '../primitives/progress';
import { Text } from '../primitives/text';

/** Props for {@link DayCard}. */
export interface DayCardProps {
  day: DayPlan;
  currency: string;
  selected?: boolean;
  onPress?: (date: string) => void;
  className?: string;
}

/**
 * Trip day summary card.
 * @example
 * <DayCard day={plan.days[2]} currency="EUR" onPress={openDay} />
 */
export function DayCard({ day, currency, selected, onPress, className }: DayCardProps) {
  const style = STATUS_STYLES[day.status];
  const pct = day.available > 0 ? (day.spent / day.available) * 100 : day.spent > 0 ? 100 : 0;
  const label = formatDayLabel(day.date);
  const isFuture = day.phase === 'future';
  return (
    <Pressable
      role="button"
      disabled={!onPress}
      onPress={() => onPress?.(day.date)}
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={`${label}${day.phase === 'today' ? ', today' : ''}, ${style.label}, ${formatMoney(day.spent, currency)} spent of ${formatMoney(day.available, currency)}`}
      testID={`day-card-${day.date}`}
      className={cn(
        'gap-3 rounded-xl border bg-card p-4 active:opacity-80',
        selected ? 'border-primary' : 'border-border',
        className,
      )}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Text variant="body" className="font-semibold">
            {label}
          </Text>
          {day.phase === 'today' ? (
            <Badge variant="default">
              <Text>Today</Text>
            </Badge>
          ) : null}
        </View>
        <Badge variant={style.badge}>
          <Text>{style.label}</Text>
        </Badge>
      </View>
      <Progress decorative value={pct} indicatorClassName={style.bar} />
      <View className="flex-row items-end justify-between">
        <View>
          <Text variant="caption">{isFuture ? 'Planned' : 'Spent'}</Text>
          <Text variant="numeric">
            {formatMoney(isFuture ? day.available : day.spent, currency)}
          </Text>
        </View>
        {day.carryIn !== 0 ? (
          <View className="items-center">
            <Text variant="caption">{day.carryIn > 0 ? 'Carried in' : 'Debt carried in'}</Text>
            <Text variant="small" className={day.carryIn > 0 ? 'text-success' : 'text-destructive'}>
              {formatMoney(day.carryIn, currency, { signed: true })}
            </Text>
          </View>
        ) : null}
        {!isFuture ? (
          <View className="items-end">
            <Text variant="caption">{day.remaining < 0 ? 'Over by' : 'Left'}</Text>
            <Text variant="numeric" className={day.remaining < 0 ? 'text-destructive' : undefined}>
              {formatMoney(Math.abs(day.remaining), currency)}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
