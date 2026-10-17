/**
 * TagPicker — choose a spend category from chips. Exactly one tag is always selected.
 * @module domain/tag-picker
 */
import { SPEND_TAGS, type SpendTag } from '@tbc/core';
import * as React from 'react';
import { cn } from '../lib/cn';
import { TAG_ICONS } from '../lib/tags';
import { Icon } from '../primitives/icon';
import { Text } from '../primitives/text';
import { ToggleGroup, ToggleGroupItem } from '../primitives/toggle-group';

/** Props for {@link TagPicker}. */
export interface TagPickerProps {
  value: SpendTag;
  onValueChange: (tag: SpendTag) => void;
  /** Icon-only chips (44px circles) for dense layouts like split rows. Labels stay available to screen readers. */
  compact?: boolean;
  /** Prefix for chip testIDs (`tag-food` by default) — lets several pickers coexist on one screen. */
  testIDPrefix?: string;
  className?: string;
  testID?: string;
}

/**
 * Category chips.
 * @example
 * <TagPicker value={tag} onValueChange={setTag} />
 */
export function TagPicker({
  value,
  onValueChange,
  compact,
  testIDPrefix = 'tag',
  className,
  testID,
}: TagPickerProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      // Ignore "deselect": a spend always has a category.
      onValueChange={(v) => v && onValueChange(v as SpendTag)}
      accessibilityLabel="Category"
      className={cn(className)}
      testID={testID}
    >
      {SPEND_TAGS.map((t) => (
        <ToggleGroupItem
          key={t.id}
          value={t.id}
          accessibilityLabel={t.label}
          testID={`${testIDPrefix}-${t.id}`}
          className={compact ? 'w-11 px-0' : undefined}
        >
          <Icon as={TAG_ICONS[t.id]} size={compact ? 20 : 16} />
          {compact ? null : <Text>{t.label}</Text>}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
