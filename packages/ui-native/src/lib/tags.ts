/**
 * Visual mapping for spend tags. Class names are written out in full (never built with template
 * strings) so Tailwind can see them when scanning source files.
 * @module lib/tags
 */
import type { SpendTag } from '@tbc/core';
import {
  BedDouble,
  Bus,
  CircleEllipsis,
  ShoppingBag,
  ShoppingBasket,
  Ticket,
  Utensils,
  type LucideIcon,
} from 'lucide-react-native';

/** Icon per tag. */
export const TAG_ICONS: Record<SpendTag, LucideIcon> = {
  food: Utensils,
  groceries: ShoppingBasket,
  transport: Bus,
  stay: BedDouble,
  activities: Ticket,
  shopping: ShoppingBag,
  other: CircleEllipsis,
};

/** Tailwind classes per tag: tinted background, icon colour and bar fill. */
export const TAG_CLASSES: Record<SpendTag, { bg: string; text: string; bar: string }> = {
  food: { bg: 'bg-tag-food/15', text: 'text-tag-food', bar: 'bg-tag-food' },
  groceries: { bg: 'bg-tag-groceries/15', text: 'text-tag-groceries', bar: 'bg-tag-groceries' },
  transport: { bg: 'bg-tag-transport/15', text: 'text-tag-transport', bar: 'bg-tag-transport' },
  stay: { bg: 'bg-tag-stay/15', text: 'text-tag-stay', bar: 'bg-tag-stay' },
  activities: { bg: 'bg-tag-activities/15', text: 'text-tag-activities', bar: 'bg-tag-activities' },
  shopping: { bg: 'bg-tag-shopping/15', text: 'text-tag-shopping', bar: 'bg-tag-shopping' },
  other: { bg: 'bg-tag-other/15', text: 'text-tag-other', bar: 'bg-tag-other' },
};
