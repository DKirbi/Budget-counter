/**
 * ReceiptTimeline — scanned bills grouped by the day printed on them, newest day first.
 * @module domain/receipt-timeline
 */
import { formatDayLabel, formatMoney, type ISODate, type TimelineDay } from '@tbc/core';
import * as React from 'react';
import { View } from 'react-native';
import { cn } from '../lib/cn';
import { Text } from '../primitives/text';
import { ReceiptRow } from './receipt-row';

/** Props for {@link ReceiptTimeline}. */
export interface ReceiptTimelineProps {
  days: readonly TimelineDay[];
  currency: string;
  /** Marks the matching day header with "today". */
  today?: ISODate;
  onOpenReceipt?: (id: string) => void;
  className?: string;
}

/**
 * Day-by-day list of counted bills.
 * @example
 * <ReceiptTimeline days={useTimeline(trip.id)} currency="EUR" today={today} onOpenReceipt={open} />
 */
export function ReceiptTimeline({
  days,
  currency,
  today,
  onOpenReceipt,
  className,
}: ReceiptTimelineProps) {
  return (
    <View className={cn('gap-5', className)} testID="timeline">
      {days.map((day) => (
        <View key={day.date} className="gap-1" testID={`timeline-day-${day.date}`}>
          <View
            className="flex-row items-baseline justify-between"
            accessible
            accessibilityLabel={`${formatDayLabel(day.date)}${day.date === today ? ', today' : ''}, ${formatMoney(day.total, currency)} in ${day.entries.length} ${day.entries.length === 1 ? 'bill' : 'bills'}`}
          >
            <Text variant="small" className="leading-5">
              {formatDayLabel(day.date)}
              {day.date === today ? ' · today' : ''}
            </Text>
            <Text variant="caption">{formatMoney(day.total, currency)}</Text>
          </View>
          <View className="rounded-xl border border-border bg-card px-3">
            {day.entries.map((e, i) => (
              <ReceiptRow
                key={e.receipt.id}
                receipt={e.receipt}
                amount={e.amount}
                currency={currency}
                split={e.spends.length > 1}
                onPress={onOpenReceipt}
                className={i > 0 ? 'border-t border-border' : undefined}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
