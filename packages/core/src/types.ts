/**
 * Domain types. Plain serialisable data only — no classes — so they persist cleanly and
 * travel unchanged between React Native, web and (later) a sync backend.
 * @module types
 */
import type { ISODate } from './dates';
import type { CurrencyCode, Minor } from './money';

/** What happens to money you overspend today. */
export type OverspendPolicy = 'cascade' | 'redistribute';

/** Every policy, in display order. */
export const OVERSPEND_POLICIES: readonly OverspendPolicy[] = ['cascade', 'redistribute'];

/** Category a spend belongs to. */
export type SpendTag =
  'food' | 'groceries' | 'transport' | 'stay' | 'activities' | 'shopping' | 'other';

/** Metadata for a {@link SpendTag}: label and the lucide icon name used to draw it. */
export interface TagMeta {
  id: SpendTag;
  label: string;
  /** lucide icon export name, e.g. `Utensils`. */
  icon: string;
}

/** All tags in display order. */
export const SPEND_TAGS: readonly TagMeta[] = [
  { id: 'food', label: 'Food & drink', icon: 'Utensils' },
  { id: 'groceries', label: 'Groceries', icon: 'ShoppingBasket' },
  { id: 'transport', label: 'Transport', icon: 'Bus' },
  { id: 'stay', label: 'Stay', icon: 'BedDouble' },
  { id: 'activities', label: 'Activities', icon: 'Ticket' },
  { id: 'shopping', label: 'Shopping', icon: 'ShoppingBag' },
  { id: 'other', label: 'Other', icon: 'CircleEllipsis' },
];

/**
 * Look up tag metadata.
 * @param tag - Tag id.
 */
export function getTagMeta(tag: SpendTag): TagMeta {
  return SPEND_TAGS.find((t) => t.id === tag) ?? (SPEND_TAGS[SPEND_TAGS.length - 1] as TagMeta);
}

/** A trip with a fixed budget spread across its days. */
export interface Trip {
  id: string;
  name: string;
  currency: CurrencyCode;
  /** Total budget in minor units. */
  totalBudget: Minor;
  /** First day (inclusive). */
  startDate: ISODate;
  /** Last day (inclusive). */
  endDate: ISODate;
  overspendPolicy: OverspendPolicy;
  /** ISO timestamp. */
  createdAt: string;
}

/** A single logged expense. Split card payments become several spends sharing a `splitGroupId`. */
export interface Spend {
  id: string;
  tripId: string;
  date: ISODate;
  /** Positive amount in minor units. */
  amount: Minor;
  tag: SpendTag;
  note?: string;
  /** Present when this spend is one part of a split payment. */
  splitGroupId?: string;
  /** ISO timestamp. */
  createdAt: string;
}

/** Colour scheme preference. */
export type ThemePreference = 'system' | 'light' | 'dark';

/** User settings that are not tied to a trip. */
export interface Settings {
  theme: ThemePreference;
}

/** Input for creating a trip. */
export type TripInput = Omit<Trip, 'id' | 'createdAt'>;

/** Input for logging one spend. */
export type SpendInput = Omit<Spend, 'id' | 'createdAt' | 'splitGroupId'>;

/** One part of a split payment. */
export interface SplitPart {
  amount: Minor;
  tag: SpendTag;
}

/** Input for logging a split payment. */
export interface SplitSpendInput {
  tripId: string;
  date: ISODate;
  note?: string;
  parts: SplitPart[];
}
