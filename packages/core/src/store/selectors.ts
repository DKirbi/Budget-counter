/**
 * Pure selectors over {@link BudgetData}. Kept free of React so they are trivially testable.
 * Note: selectors that build new arrays must not be passed straight to a zustand hook (v5 would
 * loop); the React hooks in `react.tsx` wrap them in `useMemo`.
 * @module store/selectors
 */
import type { ISODate } from '../dates';
import { computeTripPlan, type TripPlan } from '../allowance';
import type { Minor } from '../money';
import type { Receipt } from '../receipts/types';
import type { AiSettings, AiUsage, Spend, Trip } from '../types';
import type { BudgetData } from './budgetStore';

/**
 * The trip shown on Today/Summary.
 * @param s - Store data.
 */
export function selectActiveTrip(s: Pick<BudgetData, 'trips' | 'activeTripId'>): Trip | null {
  return s.trips.find((t) => t.id === s.activeTripId) ?? null;
}

/**
 * All spends of one trip, newest first.
 * @param spends - All spends.
 * @param tripId - Trip to filter by.
 */
export function selectTripSpends(spends: readonly Spend[], tripId: string): Spend[] {
  return spends
    .filter((sp) => sp.tripId === tripId)
    .sort((a, b) =>
      a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date),
    );
}

/**
 * Spends logged on a given day, newest first.
 * @param spends - Spends of a trip.
 * @param date - Day to filter by.
 */
export function selectSpendsOnDate(spends: readonly Spend[], date: ISODate): Spend[] {
  return spends
    .filter((sp) => sp.date === date)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Plan for the active trip, or `null` if there is none.
 * @param s - Store data.
 * @param today - Current day.
 */
export function selectActivePlan(s: BudgetData, today: ISODate): TripPlan | null {
  const trip = selectActiveTrip(s);
  return trip ? computeTripPlan(trip, s.spends, today) : null;
}

/** One bill on the timeline with what it counts for. */
export interface TimelineEntry {
  receipt: Receipt;
  /** The spends created from the bill (several when it was split). */
  spends: Spend[];
  /** What the bill adds to the budget, minor units. */
  amount: Minor;
}

/** One day of the timeline. */
export interface TimelineDay {
  date: ISODate;
  entries: TimelineEntry[];
  /** Sum of the day's bills, minor units. */
  total: Minor;
}

/**
 * Spends created from one bill.
 * @param spends - All spends.
 * @param receiptId - Bill id.
 */
export function selectReceiptSpends(spends: readonly Spend[], receiptId: string): Spend[] {
  return spends.filter((sp) => sp.receiptId === receiptId);
}

/**
 * The timeline of counted bills for one trip, newest day first. Within a day the later time on the
 * bill comes first; bills without a printed time fall back to the order they were scanned in.
 * @param data - Receipts and spends.
 * @param tripId - Trip to show.
 */
export function selectTimeline(
  data: Pick<BudgetData, 'receipts' | 'spends'>,
  tripId: string,
): TimelineDay[] {
  const byDay = new Map<ISODate, TimelineEntry[]>();
  for (const receipt of data.receipts) {
    if (receipt.tripId !== tripId || receipt.status !== 'budgeted' || !receipt.date) continue;
    const spends = selectReceiptSpends(data.spends, receipt.id);
    const entry: TimelineEntry = {
      receipt,
      spends,
      amount: spends.reduce((sum, sp) => sum + sp.amount, 0),
    };
    byDay.set(receipt.date, [...(byDay.get(receipt.date) ?? []), entry]);
  }
  const key = (e: TimelineEntry) => `${e.receipt.data.time ?? ''}|${e.receipt.scannedAt}`;
  return [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, entries]) => ({
      date,
      entries: entries.sort((a, b) => key(b).localeCompare(key(a))),
      total: entries.reduce((sum, e) => sum + e.amount, 0),
    }));
}

/**
 * Bills waiting for a decision, oldest scan first (so the batch is worked through in order).
 * @param receipts - All receipts.
 */
export function selectInbox(receipts: readonly Receipt[]): Receipt[] {
  return receipts
    .filter((r) => r.status === 'needs-attention')
    .sort((a, b) => a.scannedAt.localeCompare(b.scannedAt));
}

/**
 * Bills kept as digital copies only, newest first.
 * @param receipts - All receipts.
 */
export function selectArchived(receipts: readonly Receipt[]): Receipt[] {
  return receipts
    .filter((r) => r.status === 'archived')
    .sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));
}

/** Remaining AI calls today. */
export interface AiQuota {
  used: number;
  limit: number;
  remaining: number;
}

/**
 * How many AI calls are left today under the app's own daily cap.
 * @param ai - AI settings.
 * @param usage - Usage counter.
 * @param today - Current day.
 */
export function selectAiQuota(
  ai: Pick<AiSettings, 'dailyLimit'>,
  usage: AiUsage,
  today: ISODate,
): AiQuota {
  const used = usage.date === today ? usage.count : 0;
  return { used, limit: ai.dailyLimit, remaining: Math.max(0, ai.dailyLimit - used) };
}
