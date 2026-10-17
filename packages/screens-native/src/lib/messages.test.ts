import { computeTripPlan } from '@tbc/core';
import { makeSpend, makeTrip } from '@tbc/core/testing';
import { describeDay, tripSubtitle } from './messages';

const spend = (date: string, amount: number) => makeSpend({ date, amount });

describe('describeDay', () => {
  it('is silent for a healthy day', () => {
    const plan = computeTripPlan(makeTrip(), [spend('2026-05-01', 5_000)], '2026-05-01');
    expect(describeDay(plan, plan.today!)).toBeNull();
  });

  it('celebrates carried-over savings', () => {
    const plan = computeTripPlan(makeTrip(), [spend('2026-05-01', 4_000)], '2026-05-02');
    expect(describeDay(plan, plan.today!)).toEqual({
      variant: 'success',
      title: 'Includes €60.00 saved from earlier days',
    });
  });

  it('warns near the limit', () => {
    const plan = computeTripPlan(makeTrip(), [spend('2026-05-01', 9_200)], '2026-05-01');
    expect(describeDay(plan, plan.today!)).toMatchObject({
      variant: 'warning',
      title: 'Only €8.00 left today',
    });
  });

  it('explains cascade overspend', () => {
    const plan = computeTripPlan(makeTrip(), [spend('2026-05-01', 12_500)], '2026-05-01');
    expect(describeDay(plan, plan.today!)).toMatchObject({
      variant: 'destructive',
      title: "You're €25.00 over today's limit",
      description: expect.stringContaining("tomorrow's allowance"),
    });
  });

  it('explains redistribute overspend with the per-day amount', () => {
    const plan = computeTripPlan(
      makeTrip({ overspendPolicy: 'redistribute' }),
      [spend('2026-05-01', 16_000)],
      '2026-05-01',
    );
    expect(describeDay(plan, plan.today!)?.description).toBe(
      'It is spread over the remaining 6 days (about €10.00 a day).',
    );
  });

  it('distinguishes inherited debt from same-day overspending', () => {
    const plan = computeTripPlan(makeTrip(), [spend('2026-05-01', 35_000)], '2026-05-02');
    expect(describeDay(plan, plan.today!)?.title).toBe('Earlier overspending uses up today');
  });

  it('says the trip is over budget on the final day', () => {
    const plan = computeTripPlan(makeTrip(), [spend('2026-05-07', 80_000)], '2026-05-07');
    expect(describeDay(plan, plan.today!)?.description).toBe('The trip is now over budget.');
  });

  it('handles an exhausted allowance', () => {
    const plan = computeTripPlan(makeTrip(), [spend('2026-05-01', 10_000)], '2026-05-01');
    expect(describeDay(plan, plan.today!)?.variant).toBe('warning');
  });
});

describe('tripSubtitle', () => {
  it('covers every phase', () => {
    const trip = makeTrip();
    expect(tripSubtitle(computeTripPlan(trip, [], '2026-04-01'))).toBe('Starts soon · 7 days');
    expect(tripSubtitle(computeTripPlan(trip, [], '2026-05-03'))).toBe('Day 3 of 7 · 5 days left');
    expect(tripSubtitle(computeTripPlan(trip, [], '2026-05-07'))).toBe('Day 7 of 7 · 1 day left');
    expect(tripSubtitle(computeTripPlan(trip, [], '2026-06-01'))).toBe('Finished · 7 days');
  });
});
