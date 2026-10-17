import { classifyDay, computeTripPlan, previewSpend } from './allowance';
import { makeSpend, makeTrip } from './testing';

/** €700 over 7 days = €100 base allowance (10 000 minor units) per day. */
const trip = makeTrip();
const spend = (date: string, amount: number) => makeSpend({ date, amount });

describe('computeTripPlan — basics', () => {
  it('splits the budget evenly and puts today on the right row', () => {
    const plan = computeTripPlan(trip, [], '2026-05-03');
    expect(plan.days).toHaveLength(7);
    expect(plan.days.every((d) => d.planned === 10_000)).toBe(true);
    expect(plan.phase).toBe('active');
    expect(plan.today?.date).toBe('2026-05-03');
    expect(plan.days.map((d) => d.phase)).toEqual([
      'past',
      'past',
      'today',
      'future',
      'future',
      'future',
      'future',
    ]);
    expect(plan.daysLeft).toBe(5);
  });

  it('gives remainders to the earliest days so the plan always sums to the budget', () => {
    const odd = makeTrip({ totalBudget: 10_001, endDate: '2026-05-03' }); // 3 days
    const plan = computeTripPlan(odd, [], '2026-05-01');
    expect(plan.days.map((d) => d.planned)).toEqual([3_334, 3_334, 3_333]);
    expect(plan.days.reduce((s, d) => s + d.planned, 0)).toBe(10_001);
  });

  it('ignores spends that belong to other trips', () => {
    const plan = computeTripPlan(
      trip,
      [makeSpend({ tripId: 'other', date: '2026-05-03', amount: 9_999 })],
      '2026-05-03',
    );
    expect(plan.totalSpent).toBe(0);
  });

  it('handles a single-day trip', () => {
    const one = makeTrip({ totalBudget: 5_000, endDate: '2026-05-01' });
    const plan = computeTripPlan(one, [spend('2026-05-01', 1_000)], '2026-05-01');
    expect(plan.days).toHaveLength(1);
    expect(plan.today?.remaining).toBe(4_000);
    expect(plan.daysLeft).toBe(1);
  });

  it('rejects trips that end before they start', () => {
    expect(() => computeTripPlan(makeTrip({ endDate: '2026-04-30' }), [], '2026-05-01')).toThrow(
      RangeError,
    );
  });

  it('reports upcoming and finished trips', () => {
    const before = computeTripPlan(trip, [], '2026-04-01');
    expect(before.phase).toBe('upcoming');
    expect(before.today).toBeNull();
    expect(before.daysLeft).toBe(7);
    expect(before.days.every((d) => d.phase === 'future')).toBe(true);

    const after = computeTripPlan(trip, [spend('2026-05-02', 30_000)], '2026-06-01');
    expect(after.phase).toBe('finished');
    expect(after.today).toBeNull();
    expect(after.daysLeft).toBe(0);
    expect(after.days.every((d) => d.phase === 'past')).toBe(true);
  });
});

describe('computeTripPlan — carry-over (unspent money rolls forward)', () => {
  it("adds yesterday's unspent money to today", () => {
    const plan = computeTripPlan(trip, [spend('2026-05-01', 6_000)], '2026-05-02');
    expect(plan.days[0]).toMatchObject({ spent: 6_000, remaining: 4_000 });
    expect(plan.days[1]).toMatchObject({ carryIn: 4_000, available: 14_000 });
  });

  it('compounds across several frugal days', () => {
    const plan = computeTripPlan(trip, [], '2026-05-04');
    expect(plan.days.slice(0, 4).map((d) => d.available)).toEqual([10_000, 20_000, 30_000, 40_000]);
  });

  it("shows tomorrow's carry from today but does not invent savings for later days", () => {
    // Days 1–2 were unspent, so today starts with 20 000 carried + 10 000 base.
    const plan = computeTripPlan(trip, [spend('2026-05-03', 4_000)], '2026-05-03');
    const [today, tomorrow, later] = [plan.days[2]!, plan.days[3]!, plan.days[4]!];
    expect(today).toMatchObject({ carryIn: 20_000, available: 30_000, remaining: 26_000 });
    expect(tomorrow).toMatchObject({ carryIn: 26_000, available: 36_000, status: 'planned' });
    expect(later).toMatchObject({ carryIn: 0, available: 10_000 });
  });
});

describe('computeTripPlan — cascade policy (default)', () => {
  it('deducts an overspend from the very next day', () => {
    const plan = computeTripPlan(trip, [spend('2026-05-01', 15_000)], '2026-05-02');
    expect(plan.days[0]).toMatchObject({ remaining: -5_000, status: 'over' });
    expect(plan.days[1]).toMatchObject({ carryIn: -5_000, available: 5_000 });
  });

  it('keeps rolling debt forward until a day absorbs it', () => {
    const plan = computeTripPlan(trip, [spend('2026-05-01', 35_000)], '2026-05-03');
    // day1 -25k -> day2 available -15k (over even before spending) -> day3 available -5k
    expect(plan.days[1]).toMatchObject({ available: -15_000, remaining: -15_000, status: 'over' });
    expect(plan.days[2]).toMatchObject({ available: -5_000, status: 'over' });
    expect(plan.days[3]).toMatchObject({ available: 5_000 });
  });

  it('a later saving pays back earlier debt', () => {
    const plan = computeTripPlan(trip, [spend('2026-05-01', 15_000)], '2026-05-03');
    expect(plan.days[1]).toMatchObject({ available: 5_000, spent: 0, remaining: 5_000 });
    expect(plan.days[2]).toMatchObject({ carryIn: 5_000, available: 15_000 });
  });
});

describe('computeTripPlan — redistribute policy', () => {
  const redis = makeTrip({ overspendPolicy: 'redistribute' });

  it('spreads an overspend across all remaining days', () => {
    // -6 000 over 6 remaining days = -1 000 each
    const plan = computeTripPlan(redis, [spend('2026-05-01', 16_000)], '2026-05-02');
    expect(plan.days[0]).toMatchObject({ remaining: -6_000, status: 'over' });
    expect(plan.days.slice(1).map((d) => d.base)).toEqual([
      9_000, 9_000, 9_000, 9_000, 9_000, 9_000,
    ]);
    expect(plan.days[1]).toMatchObject({ carryIn: 0, available: 9_000 });
  });

  it('distributes uneven remainders without losing a unit', () => {
    const plan = computeTripPlan(redis, [spend('2026-05-01', 10_007)], '2026-05-02');
    const reductions = plan.days.slice(1).map((d) => d.planned - d.base);
    expect(reductions.reduce((a, b) => a + b, 0)).toBe(7);
    expect(Math.max(...reductions) - Math.min(...reductions)).toBeLessThanOrEqual(1);
  });

  it('still carries surplus forward', () => {
    const plan = computeTripPlan(redis, [spend('2026-05-01', 6_000)], '2026-05-02');
    expect(plan.days[1]).toMatchObject({ carryIn: 4_000, available: 14_000 });
  });

  it('cannot redistribute an overspend on the final day: the trip is simply over budget', () => {
    // Six unspent days bank 60 000, so the last day has 70 000 available; spending 80 000 overshoots by 10 000.
    const plan = computeTripPlan(redis, [spend('2026-05-07', 80_000)], '2026-05-07');
    expect(plan.days[6]).toMatchObject({ available: 70_000, remaining: -10_000, status: 'over' });
    expect(plan.remaining).toBe(-10_000);
    expect(plan.overBudget).toBe(true);
  });

  it('total remaining budget is identical under both policies', () => {
    const spends = [spend('2026-05-01', 16_000), spend('2026-05-02', 3_000)];
    const a = computeTripPlan(trip, spends, '2026-05-03');
    const b = computeTripPlan(redis, spends, '2026-05-03');
    expect(a.remaining).toBe(b.remaining);
    expect(a.remaining).toBe(70_000 - 19_000);
  });
});

describe('computeTripPlan — invariants', () => {
  it('sum of spent + remaining budget equals the total budget', () => {
    const spends = [
      spend('2026-05-01', 123),
      spend('2026-05-03', 45_678),
      spend('2026-05-05', 999),
    ];
    const plan = computeTripPlan(trip, spends, '2026-05-03');
    expect(plan.totalSpent + plan.remaining).toBe(trip.totalBudget);
    expect(plan.overBudget).toBe(false);
  });

  it('flags a trip that overspent its whole budget', () => {
    const plan = computeTripPlan(trip, [spend('2026-05-02', 80_000)], '2026-05-03');
    expect(plan.overBudget).toBe(true);
    expect(plan.remaining).toBe(-10_000);
  });

  it('accepts spends logged ahead on future days', () => {
    const plan = computeTripPlan(trip, [spend('2026-05-06', 9_000)], '2026-05-03');
    expect(plan.days[5]).toMatchObject({
      phase: 'future',
      spent: 9_000,
      remaining: 1_000,
      status: 'near-limit',
    });
  });
});

describe('classifyDay', () => {
  it('marks empty future days as planned', () => {
    expect(classifyDay('future', 0, 10_000, 10_000)).toBe('planned');
  });
  it('marks negative balances as over', () => {
    expect(classifyDay('today', 12_000, 10_000, -2_000)).toBe('over');
    expect(classifyDay('today', 0, -1, -1)).toBe('over');
  });
  it('flags near-limit at 15% or less remaining, but only once something was spent', () => {
    expect(classifyDay('today', 8_500, 10_000, 1_500)).toBe('near-limit');
    expect(classifyDay('today', 8_400, 10_000, 1_600)).toBe('on-track');
    expect(classifyDay('today', 0, 10_000, 10_000)).toBe('on-track');
  });
  it('treats an exhausted allowance differently for past and current days', () => {
    expect(classifyDay('today', 0, 0, 0)).toBe('near-limit');
    expect(classifyDay('past', 0, 0, 0)).toBe('on-track');
  });
});

describe('previewSpend', () => {
  it('shows the resulting balance without mutating the plan', () => {
    const plan = computeTripPlan(trip, [spend('2026-05-03', 2_000)], '2026-05-03');
    // Available today = 20 000 carried + 10 000 base = 30 000; 2 000 already spent.
    expect(previewSpend(plan, '2026-05-03', 3_000)).toEqual({
      remaining: 25_000,
      status: 'on-track',
    });
    expect(previewSpend(plan, '2026-05-03', 30_000)?.status).toBe('over');
    expect(plan.today?.spent).toBe(2_000);
  });
  it('returns null outside the trip', () => {
    const plan = computeTripPlan(trip, [], '2026-05-03');
    expect(previewSpend(plan, '2026-06-01', 100)).toBeNull();
  });
});
