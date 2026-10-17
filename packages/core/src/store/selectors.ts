/**
 * Pure selectors over {@link BudgetData}. Kept free of React so they are trivially testable.
 * Note: selectors that build new arrays must not be passed straight to a zustand hook (v5 would
 * loop); the React hooks in `react.tsx` wrap them in `useMemo`.
 * @module store/selectors
 */
import type { ISODate } from '../dates';
import { computeTripPlan, type TripPlan } from '../allowance';
import type { Spend, Trip } from '../types';
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
