/**
 * ReceiptIssueCard — one thing that looks odd about a scanned bill, with the ways to settle it.
 *
 * Date problems offer the days to choose from; duplicates and shaky readings offer an
 * "it's fine" button; a bill from another trip offers that trip. Resolved issues collapse to a
 * single quiet line so the screen shows what was accepted without shouting.
 * @module domain/receipt-issue-card
 */
import type { IssueCode, ISODate, ReceiptIssue } from '@tbc/core';
import { CircleCheck, Info, TriangleAlert } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';
import { cn } from '../lib/cn';
import { Button } from '../primitives/button';
import { Icon } from '../primitives/icon';
import { Text } from '../primitives/text';

/** Props for {@link ReceiptIssueCard}. */
export interface ReceiptIssueCardProps {
  issue: ReceiptIssue;
  /** Day currently chosen, to mark the matching choice. */
  selectedDate?: ISODate | null;
  /** The user picked one of `issue.dateChoices`. */
  onChooseDate?: (date: ISODate) => void;
  /** The user picked one of `issue.tripChoices`. */
  onChooseTrip?: (tripId: string) => void;
  /** The user said "this is fine". */
  onAcknowledge?: (code: IssueCode) => void;
  /** Offer "keep this bill as a digital copy" (for issues that cannot be fixed by choosing). */
  onKeepAsCopy?: () => void;
  className?: string;
}

const ACK_LABEL: Partial<Record<IssueCode, string>> = {
  DUPLICATE: 'Count it anyway',
  LOW_CONFIDENCE: 'Looks right',
  ITEMS_MISMATCH: 'Fine as it is',
  DATE_AMBIGUOUS: 'Keep this date',
  DATE_NOT_TODAY: 'Keep the bill date',
};

/**
 * Card for a {@link ReceiptIssue}.
 * @example
 * <ReceiptIssueCard issue={issue} onChooseDate={(d) => setDecisions({ date: d })} />
 */
export function ReceiptIssueCard({
  issue,
  selectedDate,
  onChooseDate,
  onChooseTrip,
  onAcknowledge,
  onKeepAsCopy,
  className,
}: ReceiptIssueCardProps) {
  const id = `issue-${issue.code}`;

  if (issue.resolved || issue.severity === 'info') {
    return (
      <View
        testID={id}
        accessible
        accessibilityLabel={`${issue.title}. ${issue.detail}`}
        className={cn('flex-row items-start gap-2 px-1', className)}
      >
        <Icon
          as={issue.resolved ? CircleCheck : Info}
          size={16}
          className={cn('mt-0.5', issue.resolved ? 'text-success' : 'text-info')}
        />
        <Text variant="muted" className="flex-1">
          {issue.title}. {issue.detail}
        </Text>
      </View>
    );
  }

  const blocking = issue.severity === 'decision';
  const showAck = issue.acknowledgeable && !issue.dateChoices?.length && onAcknowledge;
  return (
    <View
      testID={id}
      role="alert"
      className={cn(
        'gap-3 rounded-xl border p-3',
        blocking ? 'border-warning/50 bg-warning/15' : 'border-border bg-card',
        className,
      )}
    >
      <View className="flex-row items-start gap-3">
        <Icon
          as={TriangleAlert}
          size={20}
          className={cn('mt-0.5', blocking ? 'text-warning' : 'text-muted-foreground')}
        />
        <View className="flex-1 gap-1">
          <Text variant="small" className="leading-5">
            {issue.title}
          </Text>
          <Text variant="muted">{issue.detail}</Text>
        </View>
      </View>

      {issue.dateChoices?.length && onChooseDate ? (
        <View className="flex-row flex-wrap gap-2" testID={`${id}-dates`}>
          {issue.dateChoices.map((c) => (
            <Button
              key={c.date}
              size="sm"
              variant={selectedDate === c.date ? 'default' : 'outline'}
              onPress={() => onChooseDate(c.date)}
              testID={`${id}-date-${c.date}`}
              accessibilityLabel={`File under ${c.label}`}
            >
              <Text>{c.label}</Text>
            </Button>
          ))}
        </View>
      ) : null}

      {issue.tripChoices?.length && onChooseTrip ? (
        <View className="gap-2">
          {issue.tripChoices.map((t) => (
            <Button
              key={t.tripId}
              size="sm"
              variant="outline"
              onPress={() => onChooseTrip(t.tripId)}
              testID={`${id}-trip-${t.tripId}`}
              accessibilityLabel={`Move to ${t.label}`}
            >
              <Text numberOfLines={2}>Move to {t.label}</Text>
            </Button>
          ))}
        </View>
      ) : null}

      {showAck ? (
        <Button
          size="sm"
          variant="outline"
          onPress={() => onAcknowledge(issue.code)}
          testID={`${id}-ack`}
        >
          <Text>{ACK_LABEL[issue.code] ?? 'This is fine'}</Text>
        </Button>
      ) : null}

      {onKeepAsCopy && issue.code === 'DATE_OUTSIDE_TRIP' ? (
        <Button size="sm" variant="ghost" onPress={onKeepAsCopy} testID={`${id}-keep`}>
          <Text>Keep as a copy, don't count</Text>
        </Button>
      ) : null}
    </View>
  );
}
