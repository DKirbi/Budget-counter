/**
 * TodayScreen — the app's home: how much you can still spend today.
 *
 * Shows the allowance ring, an explanation when something needs attention (near limit, overspent,
 * carried-over savings), the week strip and today's spends. With no trip it invites you to plan one.
 * @module screens/TodayScreen
 */
import { type DayPlan, formatDayLabel } from '@tbc/core';
import { useActivePlan, useActiveTrip, useDaySpends } from '@tbc/core/react';
import {
  Alert,
  AllowanceRing,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Icon,
  Screen,
  ScreenHeader,
  SpendRow,
  Text,
  WeekStrip,
  Separator,
} from '@tbc/ui-native';
import { Plane, Plus } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';
import { describeDay, tripSubtitle } from '../lib/messages';

/** Props for {@link TodayScreen}. Navigation is injected so the screen is router-agnostic. */
export interface TodayScreenProps {
  /** Open the "log spend" flow for a date. */
  onAddSpend: (date: string) => void;
  /** Open an existing spend for editing. */
  onOpenSpend: (id: string) => void;
  /** Open a day's detail. */
  onOpenDay: (date: string) => void;
  /** Start the "new trip" flow. */
  onCreateTrip: () => void;
}

/**
 * Today dashboard.
 * @example
 * <TodayScreen onAddSpend={(d) => router.push({ pathname: '/spend/new', params: { date: d } })} … />
 */
export function TodayScreen({
  onAddSpend,
  onOpenSpend,
  onOpenDay,
  onCreateTrip,
}: TodayScreenProps) {
  const trip = useActiveTrip();
  const plan = useActivePlan();
  const day: DayPlan | null = plan
    ? (plan.today ?? (plan.phase === 'upcoming' ? plan.days[0]! : plan.days[plan.days.length - 1]!))
    : null;
  const spends = useDaySpends(trip?.id ?? null, day?.date ?? '');

  if (!trip || !plan || !day) {
    return (
      <Screen testID="screen-today">
        <ScreenHeader title="Today" />
        <EmptyState
          testID="empty-no-trip"
          icon={Plane}
          title="Plan your first trip"
          description="Set a budget and dates. We'll split it into a daily allowance and carry what you don't spend."
          action={
            <Button onPress={onCreateTrip} testID="create-trip-cta">
              <Text>Plan a trip</Text>
            </Button>
          }
        />
      </Screen>
    );
  }

  const message = describeDay(plan, day);
  const isToday = plan.phase === 'active';
  return (
    <Screen testID="screen-today">
      <ScreenHeader title={trip.name} subtitle={tripSubtitle(plan)} />

      {plan.phase !== 'active' ? (
        <Alert
          variant="info"
          title={
            plan.phase === 'upcoming'
              ? `Your trip starts ${formatDayLabel(trip.startDate)}`
              : 'This trip has finished'
          }
          description={
            plan.phase === 'upcoming'
              ? 'Here is what day 1 looks like.'
              : 'Open Summary to see how it went.'
          }
        />
      ) : null}

      <View className="items-center">
        <AllowanceRing
          testID="allowance-ring"
          remaining={day.remaining}
          available={day.available}
          spent={day.spent}
          currency={trip.currency}
          status={day.status}
        />
      </View>

      {message ? (
        <Alert
          testID="day-message"
          variant={message.variant}
          title={message.title}
          description={message.description}
        />
      ) : null}

      <Button
        onPress={() => onAddSpend(day.date)}
        testID="add-spend"
        accessibilityLabel="Add spend"
      >
        <Icon as={Plus} size={20} />
        <Text>Add spend</Text>
      </Button>

      <WeekStrip days={plan.days} selectedDate={day.date} onSelect={onOpenDay} className="-mx-4" />

      <Card>
        <CardHeader>
          <CardTitle>{isToday ? 'Today' : formatDayLabel(day.date)}</CardTitle>
        </CardHeader>
        <CardContent className="gap-1">
          {spends.length === 0 ? (
            <Text variant="muted" testID="no-spends">
              Nothing logged yet.
            </Text>
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
