/**
 * ReceiptRow — one scanned bill: category icon, shop, time, status and amount.
 * @module domain/receipt-row
 */
import { formatMoney, getTagMeta } from '@tbc/core';
import type { ISODate, Minor, ReceiptData, ReceiptStatus, SpendTag } from '@tbc/core';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { cn } from '../lib/cn';
import { Badge } from '../primitives/badge';
import { Text } from '../primitives/text';
import { TagIcon } from './tag-icon';

/** The slice of a receipt the row needs. */
export interface ReceiptRowReceipt {
  id: string;
  status: ReceiptStatus;
  tag: SpendTag;
  date: ISODate | null;
  data: Pick<ReceiptData, 'merchant' | 'time' | 'source'>;
}

/** Props for {@link ReceiptRow}. */
export interface ReceiptRowProps {
  receipt: ReceiptRowReceipt;
  /** What the bill counts for (or, in the inbox, the total read from it). `null` = unknown. */
  amount: Minor | null;
  currency: string;
  /** The bill was split across categories. */
  split?: boolean;
  /** Show the day next to the time (inbox and archive rows have no day header above them). */
  showDate?: boolean;
  /** Makes the row tappable (opens the review screen). */
  onPress?: (id: string) => void;
  className?: string;
}

const STATUS_BADGE: Record<
  ReceiptStatus,
  { label: string; variant: 'warning' | 'outline' } | null
> = {
  'needs-attention': { label: 'Needs you', variant: 'warning' },
  archived: { label: 'Not counted', variant: 'outline' },
  budgeted: null,
};

/**
 * List row for a scanned bill.
 * @example
 * <ReceiptRow receipt={receipt} amount={1250} currency="EUR" onPress={(id) => router.push(`/receipt/${id}`)} />
 */
export function ReceiptRow({
  receipt,
  amount,
  currency,
  split,
  showDate,
  onPress,
  className,
}: ReceiptRowProps) {
  const meta = getTagMeta(receipt.tag);
  const title = receipt.data.merchant?.trim() || 'Unknown shop';
  const money = amount === null ? 'amount unknown' : formatMoney(amount, currency);
  const badge = STATUS_BADGE[receipt.status];
  const when = [showDate && receipt.date ? receipt.date : null, receipt.data.time]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      role={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={() => onPress?.(receipt.id)}
      accessibilityLabel={[
        title,
        meta.label,
        money,
        badge?.label,
        split ? 'split' : null,
        receipt.data.source === 'ai' ? 'read by AI' : null,
      ]
        .filter(Boolean)
        .join(', ')}
      testID={`receipt-row-${receipt.id}`}
      className={cn('min-h-touch flex-row items-center gap-3 py-2 active:opacity-70', className)}
    >
      <TagIcon tag={receipt.tag} />
      <View className="flex-1 gap-1">
        <Text variant="body" className="font-medium" numberOfLines={1}>
          {title}
        </Text>
        <View className="flex-row flex-wrap items-center gap-2">
          <Text variant="caption">{when ? `${when} · ${meta.label}` : meta.label}</Text>
          {badge ? (
            <Badge variant={badge.variant} className="px-1.5 py-0">
              <Text>{badge.label}</Text>
            </Badge>
          ) : null}
          {split ? (
            <Badge variant="outline" className="px-1.5 py-0">
              <Text>Split</Text>
            </Badge>
          ) : null}
          {receipt.data.source === 'ai' ? (
            <Badge variant="outline" className="px-1.5 py-0">
              <Text>AI</Text>
            </Badge>
          ) : null}
        </View>
      </View>
      <Text variant="numeric">{amount === null ? '—' : formatMoney(amount, currency)}</Text>
    </Pressable>
  );
}
