/**
 * SummaryScreen — how the trip is going: totals, pace, projection, streak and a category breakdown.
 * @module screens/SummaryScreen
 */
import { formatDayLabel, formatMoney } from '@tbc/core';
import { useActiveSummary, useActiveTrip } from '@tbc/core/react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CategoryBar,
  EmptyState,
  Screen,
  ScreenHeader,
  StatTile,
  Text,
} from '@tbc/ui-native';
import { ChartNoAxesColumn, Flame, TrendingDown, TrendingUp } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

/** Props for {@link SummaryScreen}. */
export interface SummaryScreenProps {
  onCreateTrip: () => void;
}

/**
 * Trip summary.
 * @example
 * <SummaryScreen onCreateTrip={() => router.push('/trip/new')} />
 */
export function SummaryScreen({ onCreateTrip }: SummaryScreenProps) {
  const trip = useActiveTrip();
  const s = useActiveSummary();
  if (!trip || !s) {
    return (
      <Screen testID="screen-summary">
        <ScreenHeader title="Summary" />
        <EmptyState
          icon={ChartNoAxesColumn}
          title="Nothing to summarise"
          description="Create a trip and log a few spends to see your pace."
          action={
            <Button onPress={onCreateTrip}>
              <Text>Plan a trip</Text>
            </Button>
          }
        />
      </Screen>
    );
  }
  const money = (n: number, signed = false) => formatMoney(n, trip.currency, { signed });
  const ahead = s.aheadOfPlan >= 0;
  return (
    <Screen testID="screen-summary">
      <ScreenHeader title="Summary" subtitle={trip.name} />

      <View className="flex-row gap-3">
        <StatTile
          testID="stat-spent"
          label="Spent"
          value={money(s.totalSpent)}
          hint={`of ${money(s.totalBudget)}`}
        />
        <StatTile
          testID="stat-remaining"
          label="Remaining"
          value={money(s.remaining)}
          tone={s.remaining < 0 ? 'negative' : 'default'}
          hint={`${s.daysLeft} ${s.daysLeft === 1 ? 'day' : 'days'} left`}
        />
      </View>
      <View className="flex-row gap-3">
        <StatTile
          testID="stat-average"
          label="Average per day"
          value={money(s.avgPerDay)}
          hint={`over ${s.daysElapsed} ${s.daysElapsed === 1 ? 'day' : 'days'}`}
        />
        <StatTile
          testID="stat-projected"
          label="At this pace"
          value={s.projectedTotal === null ? '—' : money(s.projectedTotal)}
          tone={
            s.projectedTotal !== null && s.projectedTotal > s.totalBudget ? 'negative' : 'default'
          }
          hint={s.projectedTotal === null ? 'Starts with day 1' : `budget ${money(s.totalBudget)}`}
        />
      </View>

      {s.daysElapsed > 0 ? (
        <Alert
          testID="pace-alert"
          variant={ahead ? 'success' : 'warning'}
          icon={ahead ? TrendingDown : TrendingUp}
          title={
            ahead ? `${money(s.aheadOfPlan)} ahead of plan` : `${money(-s.aheadOfPlan)} behind plan`
          }
          description={
            ahead
              ? 'You are spending less than the daily allowances added up so far.'
              : 'You have spent more than the daily allowances added up so far.'
          }
        />
      ) : null}

      {s.streak > 0 ? (
        <Alert
          testID="streak"
          variant="info"
          icon={Flame}
          title={`${s.streak}-day streak`}
          description="Consecutive days within the base allowance."
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Where it went</CardTitle>
        </CardHeader>
        <CardContent className="gap-4">
          {s.byTag.length === 0 ? (
            <Text variant="muted" testID="no-breakdown">
              No spending yet.
            </Text>
          ) : (
            s.byTag.map((t) => <CategoryBar key={t.tag} total={t} currency={trip.currency} />)
          )}
        </CardContent>
      </Card>

      {s.bestDay || s.worstDay ? (
        <Card>
          <CardHeader>
            <CardTitle>Highlights</CardTitle>
          </CardHeader>
          <CardContent className="gap-2">
            {s.bestDay ? (
              <Text testID="best-day">
                Best day: <Text className="font-semibold">{formatDayLabel(s.bestDay.date)}</Text> (
                {money(s.bestDay.base - s.bestDay.spent)} under)
              </Text>
            ) : null}
            {s.worstDay ? (
              <Text testID="worst-day">
                Priciest day:{' '}
                <Text className="font-semibold">{formatDayLabel(s.worstDay.date)}</Text> (
                {money(s.worstDay.spent - s.worstDay.base)} over)
              </Text>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </Screen>
  );
}
