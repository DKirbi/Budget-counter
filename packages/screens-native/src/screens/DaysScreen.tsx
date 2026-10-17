/**
 * DaysScreen — every day of the trip as a card, so you can see the whole plan and where debt or
 * savings are being carried.
 * @module screens/DaysScreen
 */
import { useActivePlan } from '@tbc/core/react';
import { Button, DayCard, EmptyState, Screen, ScreenHeader, Text } from '@tbc/ui-native';
import { CalendarDays } from 'lucide-react-native';
import * as React from 'react';

/** Props for {@link DaysScreen}. */
export interface DaysScreenProps {
  onOpenDay: (date: string) => void;
  onCreateTrip: () => void;
}

/**
 * Trip timeline.
 * @example
 * <DaysScreen onOpenDay={(d) => router.push(`/day/${d}`)} onCreateTrip={…} />
 */
export function DaysScreen({ onOpenDay, onCreateTrip }: DaysScreenProps) {
  const plan = useActivePlan();
  if (!plan) {
    return (
      <Screen testID="screen-days">
        <ScreenHeader title="Days" />
        <EmptyState
          icon={CalendarDays}
          title="No trip yet"
          description="Your daily plan appears here once you create a trip."
          action={
            <Button onPress={onCreateTrip}>
              <Text>Plan a trip</Text>
            </Button>
          }
        />
      </Screen>
    );
  }
  return (
    <Screen testID="screen-days">
      <ScreenHeader title="Days" subtitle={plan.trip.name} />
      {plan.days.map((d) => (
        <DayCard
          key={d.date}
          day={d}
          currency={plan.trip.currency}
          selected={d.phase === 'today'}
          onPress={onOpenDay}
        />
      ))}
    </Screen>
  );
}
