/**
 * BillsScreen — the evening ritual: scan the day's paper bills, see what still needs you, browse the timeline.
 *
 * Three lists, in the order the user needs them: bills waiting for a decision (the inbox), the timeline of
 * counted bills grouped by the date printed on them, and bills kept only as digital copies.
 * @module screens/BillsScreen
 */
import { formatMoney } from '@tbc/core';
import { useActiveTrip, useArchived, useInbox, useTimeline, useToday } from '@tbc/core/react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Icon,
  ReceiptRow,
  ReceiptTimeline,
  Screen,
  ScreenHeader,
  Separator,
  Text,
} from '@tbc/ui-native';
import { Luggage, ScanLine } from 'lucide-react-native';
import * as React from 'react';

/** Props for {@link BillsScreen}. */
export interface BillsScreenProps {
  /** Open the scan screen. */
  onScan: () => void;
  /** Open one bill for review / editing. */
  onOpenReceipt: (id: string) => void;
  onCreateTrip: () => void;
}

/**
 * Bills tab.
 * @example
 * <BillsScreen onScan={() => router.push('/scan')} onOpenReceipt={(id) => router.push(`/receipt/${id}`)} onCreateTrip={…} />
 */
export function BillsScreen({ onScan, onOpenReceipt, onCreateTrip }: BillsScreenProps) {
  const trip = useActiveTrip();
  const today = useToday();
  const inbox = useInbox();
  const archived = useArchived();
  const timeline = useTimeline(trip?.id ?? null);

  if (!trip) {
    return (
      <Screen testID="screen-bills">
        <ScreenHeader title="Bills" />
        <EmptyState
          icon={Luggage}
          title="Create a trip first"
          description="Bills are counted against a trip's budget, on the day printed on them."
          action={
            <Button onPress={onCreateTrip} testID="bills-create-trip">
              <Text>Create a trip</Text>
            </Button>
          }
          testID="bills-no-trip"
        />
      </Screen>
    );
  }

  const counted = timeline.reduce((n, d) => n + d.entries.length, 0);
  return (
    <Screen testID="screen-bills">
      <ScreenHeader
        title="Bills"
        subtitle={`${trip.name} · ${counted} counted${inbox.length > 0 ? ` · ${inbox.length} to check` : ''}`}
      />

      <Button onPress={onScan} testID="scan-bills">
        <Icon as={ScanLine} size={20} className="text-primary-foreground" />
        <Text>Scan bills</Text>
      </Button>

      {inbox.length > 0 ? (
        <Card testID="inbox">
          <CardHeader>
            <CardTitle>Needs you · {inbox.length}</CardTitle>
            <Text variant="muted">These are not counted until you decide.</Text>
          </CardHeader>
          <CardContent className="gap-1">
            {inbox.map((r, i) => (
              <React.Fragment key={r.id}>
                {i > 0 ? <Separator /> : null}
                <ReceiptRow
                  receipt={r}
                  amount={r.data.total ?? null}
                  currency={r.data.currency ?? trip.currency}
                  showDate
                  onPress={onOpenReceipt}
                />
              </React.Fragment>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {timeline.length > 0 ? (
        <ReceiptTimeline
          days={timeline}
          currency={trip.currency}
          today={today}
          onOpenReceipt={onOpenReceipt}
        />
      ) : (
        <EmptyState
          icon={ScanLine}
          title="No bills counted yet"
          description="Ask for the bill when you pay. In the evening, scan them all here — each one is filed under the day printed on it."
          testID="timeline-empty"
        />
      )}

      {archived.length > 0 ? (
        <Card testID="archive">
          <CardHeader>
            <CardTitle>Kept as copies · {archived.length}</CardTitle>
            <Text variant="muted">Saved on this device, not counted in any budget.</Text>
          </CardHeader>
          <CardContent className="gap-1">
            {archived.map((r, i) => (
              <React.Fragment key={r.id}>
                {i > 0 ? <Separator /> : null}
                <ReceiptRow
                  receipt={r}
                  amount={r.data.total ?? null}
                  currency={r.data.currency ?? trip.currency}
                  showDate
                  onPress={onOpenReceipt}
                />
              </React.Fragment>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {counted > 0 ? (
        <Text variant="caption" className="text-center">
          Counted so far:{' '}
          {formatMoney(
            timeline.reduce((n, d) => n + d.total, 0),
            trip.currency,
          )}
        </Text>
      ) : null}
    </Screen>
  );
}
