import { computeTripPlan } from './allowance';
import { computeTripSummary } from './summary';
import { makeSpend, makeTrip } from './testing';

const trip = makeTrip(); // €100/day, 7 days
const s = (date: string, amount: number, tag: 'food' | 'transport' | 'groceries' = 'food') =>
  makeSpend({ date, amount, tag });

describe('computeTripSummary', () => {
  it('returns zeros for an empty trip', () => {
    const plan = computeTripPlan(trip, [], '2026-05-01');
    const sum = computeTripSummary(plan, []);
    expect(sum).toMatchObject({
      totalSpent: 0,
      avgPerDay: 0,
      byTag: [],
      overDays: 0,
      streak: 0,
      bestDay: null,
      worstDay: null,
    });
    expect(sum.aheadOfPlan).toBe(10_000); // day 1 planned, nothing spent
  });

  it('is null-safe before the trip starts', () => {
    const plan = computeTripPlan(trip, [], '2026-04-01');
    const sum = computeTripSummary(plan, []);
    expect(sum.daysElapsed).toBe(0);
    expect(sum.projectedTotal).toBeNull();
    expect(sum.aheadOfPlan).toBe(0);
  });

  it('breaks spending down by tag, largest first, with shares that add up to 1', () => {
    const spends = [
      s('2026-05-01', 3_000, 'food'),
      s('2026-05-01', 1_000, 'transport'),
      s('2026-05-02', 6_000, 'food'),
    ];
    const sum = computeTripSummary(computeTripPlan(trip, spends, '2026-05-02'), spends);
    expect(sum.byTag.map((t) => [t.tag, t.amount, t.count])).toEqual([
      ['food', 9_000, 2],
      ['transport', 1_000, 1],
    ]);
    expect(sum.byTag.reduce((a, t) => a + t.share, 0)).toBeCloseTo(1);
  });

  it('computes pace, projection and ahead-of-plan', () => {
    const spends = [s('2026-05-01', 6_000), s('2026-05-02', 8_000), s('2026-05-03', 1_000)];
    const sum = computeTripSummary(computeTripPlan(trip, spends, '2026-05-03'), spends);
    expect(sum.daysElapsed).toBe(3);
    expect(sum.avgPerDay).toBe(5_000);
    expect(sum.projectedTotal).toBe(35_000);
    expect(sum.aheadOfPlan).toBe(30_000 - 15_000);
    expect(sum.remaining).toBe(70_000 - 15_000);
  });

  it('finds best and worst days and counts over-budget days', () => {
    const spends = [s('2026-05-01', 2_000), s('2026-05-02', 18_000), s('2026-05-03', 9_000)];
    const sum = computeTripSummary(computeTripPlan(trip, spends, '2026-05-04'), spends);
    expect(sum.bestDay?.date).toBe('2026-05-01');
    expect(sum.worstDay?.date).toBe('2026-05-02');
    expect(sum.overDays).toBe(0); // cascade: day 1 saved 8k which absorbs day 2's 8k overspend
  });

  it('counts over days when debt is not absorbed', () => {
    const spends = [s('2026-05-01', 25_000)];
    const sum = computeTripSummary(computeTripPlan(trip, spends, '2026-05-03'), spends);
    expect(sum.overDays).toBe(2);
  });

  it('streak counts consecutive completed days within the base allowance, ending yesterday', () => {
    const spends = [
      s('2026-05-01', 12_000),
      s('2026-05-02', 9_000),
      s('2026-05-03', 100),
      s('2026-05-04', 10_000),
    ];
    const sum = computeTripSummary(computeTripPlan(trip, spends, '2026-05-05'), spends);
    expect(sum.streak).toBe(3); // days 2, 3, 4 — day 1 broke it
    expect(sum.worstDay?.date).toBe('2026-05-01');
  });

  it('has no worst day when nobody overspent', () => {
    const spends = [s('2026-05-01', 1_000)];
    expect(
      computeTripSummary(computeTripPlan(trip, spends, '2026-05-02'), spends).worstDay,
    ).toBeNull();
  });
});
