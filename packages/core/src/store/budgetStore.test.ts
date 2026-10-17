import { computeTripPlan } from '../allowance';
import { createTestStore, makeTrip } from '../testing';
import { BudgetError, EMPTY_DATA, STORE_VERSION, createBudgetStore, migrate } from './budgetStore';
import {
  selectActivePlan,
  selectActiveTrip,
  selectSpendsOnDate,
  selectTripSpends,
} from './selectors';
import { createMemoryStorage } from './storage';

const tripInput = {
  name: 'Lisbon',
  currency: 'EUR',
  totalBudget: 70_000,
  startDate: '2026-05-01',
  endDate: '2026-05-07',
  overspendPolicy: 'cascade',
} as const;

describe('trips', () => {
  it('creates a trip, makes it active and stamps id/createdAt', () => {
    const store = createTestStore();
    const trip = store.getState().actions.createTrip(tripInput);
    expect(trip).toMatchObject({
      id: 'id-1',
      name: 'Lisbon',
      createdAt: '2026-05-03T10:00:00.000Z',
    });
    expect(store.getState().activeTripId).toBe('id-1');
  });

  it('validates input at the boundary', () => {
    const { actions } = createTestStore().getState();
    expect(() => actions.createTrip({ ...tripInput, endDate: '2026-04-30' })).toThrow(BudgetError);
    expect(() => actions.createTrip({ ...tripInput, totalBudget: 0 })).toThrow(/positive/);
  });

  it('edits name, policy and budget only', () => {
    const store = createTestStore();
    const { actions } = store.getState();
    const t = actions.createTrip(tripInput);
    actions.updateTrip(t.id, {
      name: 'Porto',
      overspendPolicy: 'redistribute',
      totalBudget: 50_000,
    });
    expect(store.getState().trips[0]).toMatchObject({
      name: 'Porto',
      overspendPolicy: 'redistribute',
      totalBudget: 50_000,
      startDate: '2026-05-01',
    });
    expect(() => actions.updateTrip('nope', { name: 'x' })).toThrow(
      expect.objectContaining({ code: 'TRIP_NOT_FOUND' }),
    );
    expect(() => actions.updateTrip(t.id, { totalBudget: -1 })).toThrow(
      expect.objectContaining({ code: 'INVALID_AMOUNT' }),
    );
  });

  it('deleting a trip removes its spends and moves the active trip', () => {
    const store = createTestStore();
    const { actions } = store.getState();
    const a = actions.createTrip(tripInput);
    const b = actions.createTrip({ ...tripInput, name: 'Porto' });
    actions.logSpend({ tripId: a.id, date: '2026-05-02', parts: [{ amount: 500, tag: 'food' }] });
    actions.logSpend({ tripId: b.id, date: '2026-05-02', parts: [{ amount: 700, tag: 'food' }] });

    actions.deleteTrip(b.id); // b was active
    expect(store.getState().activeTripId).toBe(a.id);
    expect(store.getState().spends).toHaveLength(1);

    actions.deleteTrip(a.id);
    expect(store.getState().activeTripId).toBeNull();
    expect(store.getState().spends).toHaveLength(0);
  });

  it('switches the active trip', () => {
    const store = createTestStore();
    const { actions } = store.getState();
    const a = actions.createTrip(tripInput);
    actions.createTrip({ ...tripInput, name: 'Porto' });
    actions.setActiveTrip(a.id);
    expect(selectActiveTrip(store.getState())?.name).toBe('Lisbon');
  });
});

describe('spends', () => {
  const setup = () => {
    const store = createTestStore();
    const trip = store.getState().actions.createTrip(tripInput);
    return { store, trip, actions: store.getState().actions };
  };

  it('logs a single spend without a split group', () => {
    const { store, trip, actions } = setup();
    const [sp] = actions.logSpend({
      tripId: trip.id,
      date: '2026-05-03',
      note: 'Lunch',
      parts: [{ amount: 1_250, tag: 'food' }],
    });
    expect(sp).toMatchObject({ amount: 1_250, tag: 'food', note: 'Lunch', tripId: trip.id });
    expect(sp?.splitGroupId).toBeUndefined();
    expect(store.getState().spends).toHaveLength(1);
  });

  it('logs a split payment as separate spends sharing a group id', () => {
    const { store, trip, actions } = setup();
    const created = actions.logSpend({
      tripId: trip.id,
      date: '2026-05-03',
      parts: [
        { amount: 2_500, tag: 'food' },
        { amount: 1_500, tag: 'groceries' },
      ],
    });
    expect(created).toHaveLength(2);
    expect(new Set(created.map((c) => c.splitGroupId)).size).toBe(1);
    expect(created[0]?.splitGroupId).toBeTruthy();
    expect(store.getState().spends.map((s) => s.tag)).toEqual(['food', 'groceries']);
  });

  it('rejects out-of-range dates, unknown trips and bad amounts', () => {
    const { trip, actions } = setup();
    const ok = [{ amount: 100, tag: 'food' as const }];
    expect(() => actions.logSpend({ tripId: trip.id, date: '2026-06-01', parts: ok })).toThrow(
      expect.objectContaining({ code: 'DATE_OUT_OF_RANGE' }),
    );
    expect(() => actions.logSpend({ tripId: 'x', date: '2026-05-02', parts: ok })).toThrow(
      expect.objectContaining({ code: 'TRIP_NOT_FOUND' }),
    );
    expect(() => actions.logSpend({ tripId: trip.id, date: '2026-05-02', parts: [] })).toThrow(
      expect.objectContaining({ code: 'INVALID_AMOUNT' }),
    );
    expect(() =>
      actions.logSpend({
        tripId: trip.id,
        date: '2026-05-02',
        parts: [{ amount: 0, tag: 'food' }],
      }),
    ).toThrow(BudgetError);
    expect(() =>
      actions.logSpend({
        tripId: trip.id,
        date: '2026-05-02',
        parts: [{ amount: 1.5, tag: 'food' }],
      }),
    ).toThrow(BudgetError);
  });

  it('edits and removes a spend, and the derived plan follows', () => {
    const { store, trip, actions } = setup();
    const [sp] = actions.logSpend({
      tripId: trip.id,
      date: '2026-05-03',
      parts: [{ amount: 3_000, tag: 'food' }],
    });
    const plan = () => computeTripPlan(trip, store.getState().spends, '2026-05-03').today!;
    // 2 unspent days (20 000) + today's 10 000 base - 3 000 spent
    expect(plan().remaining).toBe(27_000);

    actions.updateSpend(sp!.id, { amount: 5_000, tag: 'transport', date: '2026-05-04' });
    expect(store.getState().spends[0]).toMatchObject({
      amount: 5_000,
      tag: 'transport',
      date: '2026-05-04',
    });
    expect(plan().spent).toBe(0);

    actions.removeSpend(sp!.id);
    expect(store.getState().spends).toHaveLength(0);
    expect(() => actions.removeSpend(sp!.id)).toThrow(
      expect.objectContaining({ code: 'SPEND_NOT_FOUND' }),
    );
    expect(() => actions.updateSpend('nope', { amount: 1 })).toThrow(BudgetError);
  });

  it('validates edits too', () => {
    const { trip, actions } = setup();
    const [sp] = actions.logSpend({
      tripId: trip.id,
      date: '2026-05-03',
      parts: [{ amount: 100, tag: 'food' }],
    });
    expect(() => actions.updateSpend(sp!.id, { amount: -5 })).toThrow(BudgetError);
    expect(() => actions.updateSpend(sp!.id, { date: '2027-01-01' })).toThrow(
      expect.objectContaining({ code: 'DATE_OUT_OF_RANGE' }),
    );
  });
});

describe('settings & reset', () => {
  it('stores the theme preference and keeps it across reset', () => {
    const store = createTestStore({ demo: true });
    const { actions } = store.getState();
    actions.setTheme('dark');
    actions.reset();
    expect(store.getState().settings.theme).toBe('dark');
    expect(store.getState().trips).toHaveLength(0);
    expect(store.getState().activeTripId).toBeNull();
  });
});

describe('persistence', () => {
  it('writes only data (never actions) and rehydrates into a new store', () => {
    const storage = createMemoryStorage();
    const a = createBudgetStore({
      storage,
      createId: (() => {
        let n = 0;
        return () => `p-${++n}`;
      })(),
    });
    const t = a.getState().actions.createTrip(tripInput);
    a.getState().actions.logSpend({
      tripId: t.id,
      date: '2026-05-02',
      parts: [{ amount: 900, tag: 'food' }],
    });

    const raw = JSON.parse(storage.getItem('trip-budget/v1') as string);
    expect(raw.version).toBe(STORE_VERSION);
    expect(Object.keys(raw.state).sort()).toEqual(['activeTripId', 'settings', 'spends', 'trips']);

    const b = createBudgetStore({ storage });
    expect(b.persist.hasHydrated()).toBe(true);
    expect(b.getState().trips[0]?.name).toBe('Lisbon');
    expect(b.getState().spends[0]?.amount).toBe(900);
    expect(typeof b.getState().actions.logSpend).toBe('function');
  });

  it('migrate fills missing fields from defaults', () => {
    expect(migrate({ trips: [makeTrip()] }, 0)).toEqual({ ...EMPTY_DATA, trips: [makeTrip()] });
  });

  it('supports asynchronous storage (AsyncStorage-style) and reports hydration', async () => {
    const backing = createMemoryStorage({
      'trip-budget/v1': JSON.stringify({
        version: STORE_VERSION,
        state: { ...EMPTY_DATA, trips: [makeTrip()], activeTripId: 'trip-1' },
      }),
    });
    const asyncStorage = {
      getItem: async (k: string) => backing.getItem(k),
      setItem: async (k: string, v: string) => backing.setItem(k, v),
      removeItem: async (k: string) => backing.removeItem(k),
    };
    const store = createBudgetStore({ storage: asyncStorage });
    expect(store.persist.hasHydrated()).toBe(false);
    await new Promise<void>((resolve) => store.persist.onFinishHydration(() => resolve()));
    expect(store.getState().trips).toHaveLength(1);
  });
});

describe('selectors', () => {
  it('orders spends newest first and filters by day', () => {
    const store = createTestStore({ demo: true });
    const s = store.getState();
    const spends = selectTripSpends(s.spends, 'trip-1');
    expect(spends[0]?.date).toBe('2026-05-03');
    expect(spends.at(-1)?.date).toBe('2026-05-01');
    expect(selectSpendsOnDate(spends, '2026-05-02')).toHaveLength(2);
  });

  it('builds the active plan or null', () => {
    expect(selectActivePlan(createTestStore().getState(), '2026-05-03')).toBeNull();
    const plan = selectActivePlan(createTestStore({ demo: true }).getState(), '2026-05-03');
    expect(plan?.today?.date).toBe('2026-05-03');
  });
});
