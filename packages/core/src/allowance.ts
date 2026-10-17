/**
 * The allowance engine — the heart of the app.
 *
 * A trip budget is split into one **base allowance** per day. Whatever you do not spend rolls into the
 * next day; whatever you overspend is taken back according to the trip's {@link OverspendPolicy}:
 *
 * - `cascade` (default): a negative balance is deducted from the very next day, and keeps rolling
 *   forward until it is absorbed. Strict and easy to reason about — good for tight budgets.
 * - `redistribute`: the overspend is spread evenly over *all* remaining days by lowering their base
 *   allowance. Gentler, but hides the damage of a single big spend. Surplus still carries forward.
 *
 * Everything here is a **pure function** of `(trip, spends, today)`. Nothing is stored: the plan is
 * recomputed on demand, so edits and deletes can never leave stale balances behind.
 * @module allowance
 */
import { type ISODate, diffDays, eachDay } from './dates';
import { type Minor, splitEvenly } from './money';
import type { Spend, Trip } from './types';

/** Where a day sits relative to "today". */
export type DayPhase = 'past' | 'today' | 'future';

/**
 * Health of a day's balance.
 * - `planned`: a future day with nothing logged yet.
 * - `on-track`: comfortably within the available amount.
 * - `near-limit`: within {@link NEAR_LIMIT_RATIO} of the limit (or nothing available today).
 * - `over`: spent more than available.
 */
export type DayStatus = 'planned' | 'on-track' | 'near-limit' | 'over';

/** A day is "near the limit" when this fraction (or less) of what was available is left. */
export const NEAR_LIMIT_RATIO = 0.15;

/** One row of the plan. All money is in minor units and may be negative where noted. */
export interface DayPlan {
  date: ISODate;
  /** 0-based position within the trip. */
  index: number;
  phase: DayPhase;
  /** The even split of the total budget for this day, before any redistribution. */
  planned: Minor;
  /** Base allowance after redistribution adjustments (equals `planned` under `cascade`). */
  base: Minor;
  /** Signed balance inherited from the previous day (negative = debt). */
  carryIn: Minor;
  /** What can be spent: `base + carryIn`. May be negative. */
  available: Minor;
  /** Sum of spends logged on this day. */
  spent: Minor;
  /** `available - spent`. Negative means overspent. */
  remaining: Minor;
  status: DayStatus;
}

/** Trip-level view of the plan. */
export interface TripPlan {
  trip: Trip;
  /** `upcoming` before the first day, `finished` after the last. */
  phase: 'upcoming' | 'active' | 'finished';
  days: DayPlan[];
  /** The row for today, or `null` when today is outside the trip. */
  today: DayPlan | null;
  totalSpent: Minor;
  /** `totalBudget - totalSpent`; negative when the whole trip is over budget. */
  remaining: Minor;
  /** Days still to go including today (whole length when upcoming, 0 when finished). */
  daysLeft: number;
  overBudget: boolean;
}

/** Classify a day. Exported for tests and for components that preview a hypothetical spend. */
export function classifyDay(
  phase: DayPhase,
  spent: Minor,
  available: Minor,
  remaining: Minor,
): DayStatus {
  if (phase === 'future' && spent === 0) return 'planned';
  if (remaining < 0) return 'over';
  if (available <= 0) return phase === 'past' ? 'on-track' : 'near-limit';
  if (spent > 0 && remaining / available <= NEAR_LIMIT_RATIO) return 'near-limit';
  return 'on-track';
}

/**
 * Compute the full day-by-day plan for a trip.
 *
 * Future days show the *planned* allowance, except tomorrow which also shows what today would
 * carry over if you stopped spending now. Later days assume each earlier day is spent as planned,
 * so unspent money is never double-counted into a fantasy number.
 *
 * @param trip - The trip to plan.
 * @param spends - Spends for the trip (spends of other trips are ignored).
 * @param today - Current calendar day; inject it so the function stays pure and testable.
 * @throws RangeError when the trip has no days (`endDate` before `startDate`).
 * @example
 * const plan = computeTripPlan(trip, spends, '2026-05-03');
 * plan.today?.remaining; // what is left to spend today
 */
export function computeTripPlan(trip: Trip, spends: readonly Spend[], today: ISODate): TripPlan {
  const dates = eachDay(trip.startDate, trip.endDate);
  const n = dates.length;
  if (n === 0) throw new RangeError('Trip must span at least one day');

  const planned = splitEvenly(trip.totalBudget, n);
  const spentByDate = new Map<ISODate, Minor>();
  for (const s of spends) {
    if (s.tripId === trip.id) spentByDate.set(s.date, (spentByDate.get(s.date) ?? 0) + s.amount);
  }

  const reductions: Minor[] = new Array<Minor>(n).fill(0);
  let carry: Minor = 0;
  const days: DayPlan[] = [];

  dates.forEach((date, i) => {
    const phase: DayPhase = date < today ? 'past' : date === today ? 'today' : 'future';
    const plannedToday = planned[i] as Minor;
    const base = plannedToday - (reductions[i] as Minor);
    const spent = spentByDate.get(date) ?? 0;
    const carryIn = carry;
    const available = base + carryIn;
    const remaining = available - spent;
    days.push({
      date,
      index: i,
      phase,
      planned: plannedToday,
      base,
      carryIn,
      available,
      spent,
      remaining,
      status: classifyDay(phase, spent, available, remaining),
    });

    if (phase === 'future' && spent === 0) {
      carry = 0; // assume the planned day is spent as planned
    } else if (remaining >= 0 || trip.overspendPolicy === 'cascade') {
      carry = remaining;
    } else {
      carry = 0;
      const daysAfter = n - i - 1;
      if (daysAfter > 0) {
        splitEvenly(-remaining, daysAfter).forEach((share, k) => {
          reductions[i + 1 + k] = (reductions[i + 1 + k] as Minor) + share;
        });
      }
    }
  });

  const totalSpent = days.reduce((sum, d) => sum + d.spent, 0);
  const phase = today < trip.startDate ? 'upcoming' : today > trip.endDate ? 'finished' : 'active';
  return {
    trip,
    phase,
    days,
    today: days.find((d) => d.phase === 'today') ?? null,
    totalSpent,
    remaining: trip.totalBudget - totalSpent,
    daysLeft:
      phase === 'upcoming' ? n : phase === 'finished' ? 0 : diffDays(today, trip.endDate) + 1,
    overBudget: trip.totalBudget - totalSpent < 0,
  };
}

/**
 * Preview how a hypothetical spend on `date` would change that day's balance, without touching state.
 * Powers the live "you will have €x left" hint while typing an amount.
 * @param plan - Current plan.
 * @param date - Day the spend would be logged on.
 * @param amount - Spend amount in minor units.
 * @returns The day's `remaining` after the spend and its resulting status, or `null` for dates outside the trip.
 */
export function previewSpend(
  plan: TripPlan,
  date: ISODate,
  amount: Minor,
): { remaining: Minor; status: DayStatus } | null {
  const day = plan.days.find((d) => d.date === date);
  if (!day) return null;
  const spent = day.spent + amount;
  const remaining = day.available - spent;
  return { remaining, status: classifyDay(day.phase, spent, day.available, remaining) };
}
