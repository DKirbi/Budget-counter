/**
 * ScanResultRow — one photo in a scanning batch: reading… → filed / needs you / could not read.
 * @module domain/scan-result-row
 */
import { formatMoney, type Minor } from '@tbc/core';
import { CircleAlert, CircleCheck, LoaderCircle, TriangleAlert } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { cn } from '../lib/cn';
import { Icon } from '../primitives/icon';
import { Text } from '../primitives/text';

/** What happened to one photo. */
export type ScanResultState = 'reading' | 'filed' | 'attention' | 'failed';

/** Props for {@link ScanResultRow}. */
export interface ScanResultRowProps {
  state: ScanResultState;
  /** Shop name, or "Bill 3" while unknown. */
  title: string;
  /** One line of explanation, e.g. the first open issue. */
  detail?: string;
  /** Amount, when known. */
  amount?: Minor | null;
  currency?: string;
  /** Opens the bill (filed and attention rows). */
  onPress?: () => void;
  testID?: string;
  className?: string;
}

const STATE: Record<ScanResultState, { label: string; icon: typeof CircleCheck; tone: string }> = {
  reading: { label: 'Reading…', icon: LoaderCircle, tone: 'text-muted-foreground' },
  filed: { label: 'Filed', icon: CircleCheck, tone: 'text-success' },
  attention: { label: 'Needs you', icon: TriangleAlert, tone: 'text-warning' },
  failed: { label: 'Could not read', icon: CircleAlert, tone: 'text-destructive' },
};

/**
 * Row in the scan batch list.
 * @example
 * <ScanResultRow state="attention" title="Taxi Ljubljana" detail="From 4 days ago" amount={3000} currency="EUR" />
 */
export function ScanResultRow({
  state,
  title,
  detail,
  amount,
  currency = 'EUR',
  onPress,
  testID,
  className,
}: ScanResultRowProps) {
  const s = STATE[state];
  return (
    <Pressable
      role={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      testID={testID}
      accessibilityLabel={[
        title,
        s.label,
        detail,
        amount != null ? formatMoney(amount, currency) : null,
      ]
        .filter(Boolean)
        .join(', ')}
      className={cn('min-h-touch flex-row items-center gap-3 py-2 active:opacity-70', className)}
    >
      <Icon as={s.icon} size={22} className={s.tone} />
      <View className="flex-1 gap-0.5">
        <Text variant="body" className="font-medium" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" numberOfLines={2}>
          {detail ? `${s.label} · ${detail}` : s.label}
        </Text>
      </View>
      {amount != null ? <Text variant="numeric">{formatMoney(amount, currency)}</Text> : null}
    </Pressable>
  );
}
