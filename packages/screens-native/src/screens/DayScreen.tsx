/**
 * DayScreen — one day in detail: its balance and every spend, with a shortcut to add one.
 * @module screens/DayScreen
 */
import { formatDayLabel } from '@tbc/core';
import { useActivePlan, useActiveTrip, useDaySpends } from '@tbc/core/react';
import {
  Button,
  Card,
  CardContent,
  DayCard,
  EmptyState,
  Icon,
  Screen,
  ScreenHeader,
  Separator,
  SpendRow,
  Text,
} from '@tbc/ui-native';
import { CalendarX, Plus } from 'lucide-react-native';
import * as React from 'react';
import { describeDay } from '../lib/messages';
import { Alert } from '@tbc/ui-native';

/** Props for {@link DayScreen}. */
export interface DayScreenProps {
  /** `YYYY-MM-DD` of the day to show. */
  date: string;
  onAddSpend: (date: string) => void;
  onOpenSpend: (id: string) => void;
}

/**
 * Day detail.
 * @example
 * <DayScreen date="2026-05-03" onAddSpend={…} onOpenSpend={…} />
 */
export function DayScreen({ date, onAddSpend, onOpenSpend }: DayScreenProps) {
  const trip = useActiveTrip();
  const plan = useActivePlan();
  const spends = useDaySpends(trip?.id ?? null, date);
  const day = plan?.days.find((d) => d.date === date);

  if (!trip || !plan || !day) {
    return (
      <Screen testID="screen-day">
        <EmptyState
          icon={CalendarX}
          title="Day not found"
          description="That day is outside the current trip."
        />
      </Screen>
    );
  }
  const message = describeDay(plan, day);
  return (
    <Screen testID="screen-day" edges={[]}>
      <ScreenHeader title={formatDayLabel(date)} subtitle={trip.name} />
      <DayCard day={day} currency={trip.currency} />
      {message ? (
        <Alert variant={message.variant} title={message.title} description={message.description} />
      ) : null}
      <Button onPress={() => onAddSpend(date)} testID="add-spend-day">
        <Icon as={Plus} size={20} />
        <Text>Add spend on this day</Text>
      </Button>
      <Card>
        <CardContent className="gap-1">
          {spends.length === 0 ? (
            <Text variant="muted">Nothing logged for this day.</Text>
          ) : (
            spends.map((s, i) => (
              <React.Fragment key={s.id}>
                {i > 0 ? <Separator /> : null}
                <SpendRow spend={s} currency={trip.currency} onPress={onOpenSpend} />
              </React.Fragment>
            ))
          )}
        </CardContent>
      </Card>
    </Screen>
  );
}
