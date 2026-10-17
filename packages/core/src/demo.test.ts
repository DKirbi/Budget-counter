import { computeTripPlan } from './allowance';
import { seedDemoTrip } from './demo';
import { createTestStore } from './testing';

describe('seedDemoTrip', () => {
  it('creates an active trip around today with a spread of spends', () => {
    const store = createTestStore();
    const trip = seedDemoTrip(store.getState().actions, '2026-09-29');
    const s = store.getState();
    expect(s.activeTripId).toBe(trip.id);
    expect(trip.startDate).toBe('2026-09-27');
    expect(trip.endDate).toBe('2026-10-03');
    expect(s.spends).toHaveLength(7);
    const plan = computeTripPlan(trip, s.spends, '2026-09-29');
    expect(plan.phase).toBe('active');
    expect(plan.today?.index).toBe(2);
    expect(plan.days[1]!.spent).toBeGreaterThan(plan.days[1]!.planned); // the overspent day
  });
});
