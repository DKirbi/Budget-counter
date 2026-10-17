/**
 * Demo data generator: a believable mid-trip state relative to *today*, so a fresh install (or a
 * screenshot, or a Storybook story) can show the app with real numbers in one tap.
 * @module demo
 */
import { type ISODate, addDays } from './dates';
import type { BudgetActions } from './store/budgetStore';
import type { SpendTag, Trip } from './types';

/**
 * Create a 7-day Lisbon trip that started two days ago, with a frugal first day and an overspent second.
 * @param actions - Store actions (`store.getState().actions`).
 * @param today - Current day; the trip is positioned around it.
 * @returns The created (and now active) trip.
 */
export function seedDemoTrip(actions: BudgetActions, today: ISODate): Trip {
  const start = addDays(today, -2);
  const trip = actions.createTrip({
    name: 'Lisbon long weekend',
    currency: 'EUR',
    totalBudget: 70_000,
    startDate: start,
    endDate: addDays(start, 6),
    overspendPolicy: 'cascade',
  });
  const log = (offset: number, amount: number, tag: SpendTag, note: string) =>
    actions.logSpend({
      tripId: trip.id,
      date: addDays(start, offset),
      note,
      parts: [{ amount, tag }],
    });
  log(0, 1_450, 'food', 'Pastéis de nata');
  log(0, 4_200, 'transport', 'Metro pass + airport');
  log(0, 2_800, 'groceries', 'Supermarket');
  log(1, 9_500, 'activities', 'Sintra tickets');
  log(1, 6_400, 'food', 'Dinner in Alfama');
  log(2, 1_800, 'food', 'Lunch');
  log(2, 950, 'transport', 'Tram 28');
  return trip;
}
