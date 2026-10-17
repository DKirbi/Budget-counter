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
  /** Present when the spend was created from a scanned bill (see `Receipt`). */
  receiptId?: string;
  /** ISO timestamp. */
  createdAt: string;
}

/** Colour scheme preference. */
export type ThemePreference = 'system' | 'light' | 'dark';

/** Which AI service reads bills the on-device OCR could not. `none` = stay fully offline. */
export type AiProviderId = 'none' | 'gemini' | 'openai';

/** Static description of an AI provider the user can choose. */
export interface AiProviderMeta {
  id: Exclude<AiProviderId, 'none'>;
  label: string;
  /** Model used until the user picks another. Models are retired often, so this is only a default. */
  defaultModel: string;
  /** API root, without a trailing slash. */
  baseUrl: string;
  /** One honest sentence about cost / privacy for the settings screen. */
  note: string;
}

/** Providers offered in settings. Both accept the user's own API key. */
export const AI_PROVIDERS: readonly AiProviderMeta[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    defaultModel: 'gemini-flash-latest',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    note: 'Has a free tier with daily limits. On the free tier Google may use what you send to improve its products.',
  },
  {
    id: 'openai',
    label: 'OpenAI-compatible',
    defaultModel: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    note: 'Pay-as-you-go on OpenAI; change the address to use any compatible service, including ones with a free tier.',
  },
];

/** AI fallback preferences. The API key is **not** here — it lives in the device's secure storage. */
export interface AiSettings {
  provider: AiProviderId;
  /** Model id; empty means the provider default. */
  model: string;
  /** API root; empty means the provider default. */
  baseUrl: string;
  /** Calls per day this app will make (a local guard, separate from the provider's own limits). */
  dailyLimit: number;
}

/** How many AI calls were made on which day (resets by itself when the day changes). */
export interface AiUsage {
  date: ISODate | null;
  count: number;
}

/** User settings that are not tied to a trip. */
export interface Settings {
  theme: ThemePreference;
  /** File clean bills straight away instead of asking for a tap (odd bills always ask). */
  autoConfirmReceipts: boolean;
  ai: AiSettings;
  aiUsage: AiUsage;
}

/** Settings of a fresh install. */
export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  autoConfirmReceipts: true,
  ai: { provider: 'none', model: '', baseUrl: '', dailyLimit: 20 },
  aiUsage: { date: null, count: 0 },
};

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
