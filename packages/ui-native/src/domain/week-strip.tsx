/**
 * WeekStrip — horizontal row of day pills with a status dot. Tap to jump to a day.
 * @module domain/week-strip
 */
import { dayOfMonth, formatDayLabel, formatWeekday, type DayPlan } from '@tbc/core';
import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { cn } from '../lib/cn';
import { STATUS_STYLES } from '../lib/status';
import { Text } from '../primitives/text';

/** Props for {@link WeekStrip}. */
export interface WeekStripProps {
  days: readonly DayPlan[];
  selectedDate: string;
  onSelect: (date: string) => void;
  className?: string;
}

/**
 * Scrollable day selector.
 * @example
 * <WeekStrip days={plan.days} selectedDate={date} onSelect={setDate} />
 */
export function WeekStrip({ days, selectedDate, onSelect, className }: WeekStripProps) {
  return (
    <ScrollView
      horizontal
      role="radiogroup"
      accessibilityLabel="Day"
      // Keyboard users must be able to reach a scrollable strip (WCAG 2.1.1); the chips inside are focusable too.
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-4"
      className={className}
    >
      {days.map((d) => {
        const selected = d.date === selectedDate;
        return (
          <Pressable
            key={d.date}
            // One day is selected at a time: a radio group. (`aria-selected` is only valid on tabs/options.)
            role="radio"
            onPress={() => onSelect(d.date)}
            aria-checked={selected}
            accessibilityLabel={`${formatDayLabel(d.date)}, ${STATUS_STYLES[d.status].label}`}
            testID={`week-day-${d.date}`}
            className={cn(
              'min-h-touch w-14 items-center gap-1 rounded-xl border py-2',
              selected ? 'border-primary bg-primary' : 'border-border bg-card',
            )}
          >
            <Text variant="caption" className={selected ? 'text-primary-foreground' : undefined}>
              {formatWeekday(d.date)}
            </Text>
            <Text variant="numeric" className={selected ? 'text-primary-foreground' : undefined}>
              {dayOfMonth(d.date)}
            </Text>
            <View
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                selected ? 'bg-primary-foreground' : STATUS_STYLES[d.status].bar,
              )}
            />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
