/**
 * TagIcon — round tinted icon identifying a spend category.
 * @module domain/tag-icon
 */
import type { SpendTag } from '@tbc/core';
import * as React from 'react';
import { View } from 'react-native';
import { cn } from '../lib/cn';
import { TAG_CLASSES, TAG_ICONS } from '../lib/tags';
import { Icon } from '../primitives/icon';

/** Props for {@link TagIcon}. */
export interface TagIconProps {
  tag: SpendTag;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Category glyph.
 * @example
 * <TagIcon tag="transport" />
 */
export function TagIcon({ tag, size = 'md', className }: TagIconProps) {
  const c = TAG_CLASSES[tag];
  return (
    <View
      className={cn(
        'items-center justify-center rounded-full',
        size === 'md' ? 'h-10 w-10' : 'h-8 w-8',
        c.bg,
        className,
      )}
    >
      <Icon as={TAG_ICONS[tag]} size={size === 'md' ? 20 : 16} className={c.text} />
    </View>
  );
}
