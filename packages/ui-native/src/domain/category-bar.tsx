/**
 * CategoryBar — one row of the per-tag breakdown: icon, label, amount and proportional bar.
 * @module domain/category-bar
 */
import { formatMoney, getTagMeta, type TagTotal } from '@tbc/core';
import * as React from 'react';
import { View } from 'react-native';
import { TAG_CLASSES } from '../lib/tags';
import { Progress } from '../primitives/progress';
import { Text } from '../primitives/text';
import { TagIcon } from './tag-icon';

/** Props for {@link CategoryBar}. */
export interface CategoryBarProps {
  total: TagTotal;
  currency: string;
}

/**
 * Category breakdown row.
 * @example
 * {summary.byTag.map((t) => <CategoryBar key={t.tag} total={t} currency="EUR" />)}
 */
export function CategoryBar({ total, currency }: CategoryBarProps) {
  const meta = getTagMeta(total.tag);
  const pct = Math.round(total.share * 100);
  return (
    <View
      accessible
      accessibilityLabel={`${meta.label}: ${formatMoney(total.amount, currency)}, ${pct}% of spending, ${total.count} ${total.count === 1 ? 'spend' : 'spends'}`}
      testID={`category-${total.tag}`}
      className="gap-2"
    >
      <View className="flex-row items-center gap-3">
        <TagIcon tag={total.tag} size="sm" />
        <Text variant="body" className="flex-1 font-medium">
          {meta.label}
        </Text>
        <Text variant="muted">{pct}%</Text>
        <Text variant="numeric">{formatMoney(total.amount, currency)}</Text>
      </View>
      <Progress
        decorative
        value={pct}
        indicatorClassName={TAG_CLASSES[total.tag].bar}
        className="h-1.5"
      />
    </View>
  );
}
