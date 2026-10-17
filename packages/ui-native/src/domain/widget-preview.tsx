/**
 * WidgetPreview — how the Android home-screen widgets will look (2×2 and 4×2).
 *
 * This is a **design preview** rendered with the same tokens as the app; the real widget is a native
 * roadmap item. Keeping it in the design system means designers and engineers agree on the layout
 * before any native code exists.
 * @module domain/widget-preview
 */
import { formatMoney, formatWeekday, type DayPlan } from '@tbc/core';
import { Plus } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';
import { cn } from '../lib/cn';
import { STATUS_STYLES } from '../lib/status';
import { Icon } from '../primitives/icon';
import { Progress } from '../primitives/progress';
import { Text } from '../primitives/text';

/** Props for {@link WidgetPreview}. */
export interface WidgetPreviewProps {
  size: '2x2' | '4x2';
  today: DayPlan;
  /** Next days, used by the 4×2 layout. */
  upcoming?: readonly DayPlan[];
  currency: string;
  tripName: string;
  className?: string;
  testID?: string;
}

/**
 * Widget mock.
 * @example
 * <WidgetPreview size="4x2" today={plan.today} upcoming={plan.days.slice(3, 6)} currency="EUR" tripName="Lisbon" />
 */
export function WidgetPreview({
  size,
  today,
  upcoming = [],
  currency,
  tripName,
  className,
  testID,
}: WidgetPreviewProps) {
  const style = STATUS_STYLES[today.status];
  const pct = today.available > 0 ? (today.spent / today.available) * 100 : 100;
  return (
    <View
      accessible
      accessibilityLabel={`${tripName} widget, ${formatMoney(today.remaining, currency)} left today`}
      testID={testID}
      className={cn(
        'h-40 flex-row gap-4 rounded-3xl border border-border bg-card p-4 shadow-md',
        size === '2x2' ? 'w-40' : 'w-full max-w-xl',
        className,
      )}
    >
      <View className={cn('justify-between', size === '2x2' ? 'flex-1' : 'w-32')}>
        <View>
          <Text variant="caption" numberOfLines={1}>
            {tripName}
          </Text>
          <Text variant="small">Left today</Text>
        </View>
        <Text
          className={cn(
            'text-2xl font-bold tabular-nums',
            today.remaining < 0 ? 'text-destructive' : 'text-foreground',
          )}
        >
          {formatMoney(today.remaining, currency, { compact: true })}
        </Text>
        <Progress decorative value={pct} indicatorClassName={style.bar} />
      </View>
      {size === '4x2' ? (
        <View className="flex-1 justify-between">
          <View className="flex-row gap-2">
            {upcoming.slice(0, 3).map((d) => (
              <View key={d.date} className="flex-1 items-center gap-1 rounded-xl bg-muted py-2">
                <Text variant="caption">{formatWeekday(d.date)}</Text>
                <Text variant="small">{formatMoney(d.available, currency, { compact: true })}</Text>
              </View>
            ))}
          </View>
          <View className="h-11 flex-row items-center justify-center gap-2 rounded-full bg-primary">
            <Icon as={Plus} size={16} className="text-primary-foreground" />
            <Text className="text-sm font-semibold text-primary-foreground">Add spend</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
