/**
 * SpendRow — one logged expense: category icon, title, category label and amount.
 * @module domain/spend-row
 */
import { formatMoney, getTagMeta, type Spend } from '@tbc/core';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { cn } from '../lib/cn';
import { Badge } from '../primitives/badge';
import { Text } from '../primitives/text';
import { TagIcon } from './tag-icon';

/** Props for {@link SpendRow}. */
export interface SpendRowProps {
  spend: Pick<Spend, 'id' | 'amount' | 'tag' | 'note' | 'splitGroupId'>;
  currency: string;
  /** Makes the row tappable (opens the editor). */
  onPress?: (id: string) => void;
  className?: string;
}

/**
 * List row for a spend.
 * @example
 * <SpendRow spend={spend} currency="EUR" onPress={(id) => router.push(`/spend/${id}`)} />
 */
export function SpendRow({ spend, currency, onPress, className }: SpendRowProps) {
  const meta = getTagMeta(spend.tag);
  const title = spend.note?.trim() || meta.label;
  const amount = formatMoney(spend.amount, currency);
  return (
    <Pressable
      role={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={() => onPress?.(spend.id)}
      accessibilityLabel={`${title}, ${meta.label}, ${amount}${spend.splitGroupId ? ', part of a split payment' : ''}`}
      testID={`spend-row-${spend.id}`}
      className={cn('min-h-touch flex-row items-center gap-3 py-2 active:opacity-70', className)}
    >
      <TagIcon tag={spend.tag} />
      <View className="flex-1 gap-0.5">
        <Text variant="body" className="font-medium" numberOfLines={1}>
          {title}
        </Text>
        <View className="flex-row items-center gap-2">
          <Text variant="caption">{meta.label}</Text>
          {spend.splitGroupId ? (
            <Badge variant="outline" className="px-1.5 py-0">
              <Text>Split</Text>
            </Badge>
          ) : null}
        </View>
      </View>
      <Text variant="numeric">{amount}</Text>
    </Pressable>
  );
}
