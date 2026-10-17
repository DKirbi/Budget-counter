/**
 * Trip statistics derived from a {@link TripPlan}: totals, pace, per-tag breakdown and streaks.
 * @module summary
 */
import type { DayPlan, TripPlan } from './allowance';
import type { Minor } from './money';
import type { Spend, SpendTag } from './types';

/** Spend total for one tag. */
export interface TagTotal {
  tag: SpendTag;
  amount: Minor;
  /** Fraction of all spending, 0..1. */
  share: number;
  count: number;
}

/** Numbers shown on the trip summary screen. */
export interface TripSummary {
  totalBudget: Minor;
  totalSpent: Minor;
  remaining: Minor;
  daysTotal: number;
  /** Days that have started (past days plus today). */
  daysElapsed: number;
  daysLeft: number;
  /** Average spend per elapsed day. */
  avgPerDay: Minor;
  /** `avgPerDay × daysTotal`, or `null` before any day has elapsed. */
  projectedTotal: Minor | null;
  /** Planned spending up to and including today minus actual spending. Positive = ahead of plan (saving). */
  aheadOfPlan: Minor;
  byTag: TagTotal[];
  /** Days (past or today) that ended with a negative balance. */
  overDays: number;
  /** Past day with the biggest gap under its base allowance. */
  bestDay: DayPlan | null;
  /** Past day with the biggest gap over its base allowance (only if any day was actually over). */
  worstDay: DayPlan | null;
  /** Consecutive completed days, ending yesterday, where spending stayed within the base allowance. */
  streak: number;
}

/**
 * Derive the summary for a plan.
 * @param plan - Result of `computeTripPlan`.
 * @param spends - Spends of the same trip (used for the per-tag breakdown).
 */
export function computeTripSummary(plan: TripPlan, spends: readonly Spend[]): TripSummary {
  const tripSpends = spends.filter((s) => s.tripId === plan.trip.id);
  const started = plan.days.filter((d) => d.phase !== 'future');
  const past = plan.days.filter((d) => d.phase === 'past');

  const tagMap = new Map<SpendTag, { amount: Minor; count: number }>();
  for (const s of tripSpends) {
    const cur = tagMap.get(s.tag) ?? { amount: 0, count: 0 };
    tagMap.set(s.tag, { amount: cur.amount + s.amount, count: cur.count + 1 });
  }
  const total = plan.totalSpent;
  const byTag = [...tagMap.entries()]
    .map(([tag, v]) => ({
      tag,
      amount: v.amount,
      count: v.count,
      share: total > 0 ? v.amount / total : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const spentToDate = started.reduce((sum, d) => sum + d.spent, 0);
  const plannedToDate = started.reduce((sum, d) => sum + d.planned, 0);
  const avgPerDay = started.length > 0 ? Math.round(spentToDate / started.length) : 0;

  const gap = (d: DayPlan) => d.base - d.spent;
  const bestDay = past.length > 0 ? past.reduce((a, b) => (gap(b) > gap(a) ? b : a)) : null;
  const worstCandidate = past.length > 0 ? past.reduce((a, b) => (gap(b) < gap(a) ? b : a)) : null;

  let streak = 0;
  for (let i = past.length - 1; i >= 0; i--) {
    const d = past[i] as DayPlan;
    if (d.spent <= d.base) streak++;
    else break;
  }

  return {
    totalBudget: plan.trip.totalBudget,
    totalSpent: total,
    remaining: plan.remaining,
    daysTotal: plan.days.length,
    daysElapsed: started.length,
    daysLeft: plan.daysLeft,
    avgPerDay,
    projectedTotal: started.length > 0 ? avgPerDay * plan.days.length : null,
    aheadOfPlan: plannedToDate - spentToDate,
    byTag,
    overDays: started.filter((d) => d.remaining < 0).length,
    bestDay,
    worstDay: worstCandidate && gap(worstCandidate) < 0 ? worstCandidate : null,
    streak,
  };
}
