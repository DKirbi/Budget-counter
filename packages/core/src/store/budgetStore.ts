/**
 * The app's single source of truth: trips, spends and settings.
 *
 * Built with zustand's *vanilla* `createStore` so it works outside React (tests, workers, future
 * sync engine) and is injected via context (see `react.tsx`). Only raw facts are stored; balances
 * are always derived by the allowance engine, so an edit can never leave a stale number behind.
 * @module store/budgetStore
 */
import { createJSONStorage, persist } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';
import { type ISODate, isISODate } from '../dates';
import type { Minor } from '../money';
import type {
  Settings,
  Spend,
  SplitPart,
  SpendTag,
  ThemePreference,
  Trip,
  TripInput,
} from '../types';
import type { StateStorage } from './storage';

/** Machine-readable reason a store action was rejected. */
export type BudgetErrorCode =
  'TRIP_NOT_FOUND' | 'SPEND_NOT_FOUND' | 'DATE_OUT_OF_RANGE' | 'INVALID_AMOUNT' | 'INVALID_TRIP';

/** Thrown when an action would break a domain invariant. Forms should validate first; this is the safety net. */
export class BudgetError extends Error {
  constructor(
    public readonly code: BudgetErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BudgetError';
  }
}

/** The persisted part of the state. */
export interface BudgetData {
  trips: Trip[];
  spends: Spend[];
  activeTripId: string | null;
  settings: Settings;
}

/** Fields of a spend that may be edited. */
export type SpendPatch = Partial<Pick<Spend, 'amount' | 'tag' | 'note' | 'date'>>;

/** Fields of a trip that may be edited after creation. */
export type TripPatch = Partial<Pick<Trip, 'name' | 'overspendPolicy' | 'totalBudget'>>;

/** Everything that can change the data. Lives under `state.actions` so the object identity is stable. */
export interface BudgetActions {
  /** Create a trip and make it the active one. */
  createTrip(input: TripInput): Trip;
  /** Edit name, overspend policy or total budget. */
  updateTrip(id: string, patch: TripPatch): void;
  /** Delete a trip and all of its spends. Activates another trip if the active one was removed. */
  deleteTrip(id: string): void;
  /** Choose which trip the Today and Summary screens show. */
  setActiveTrip(id: string): void;
  /**
   * Log a spend. Several `parts` are stored as separate spends sharing a `splitGroupId`
   * (one card payment, several tags).
   */
  logSpend(input: { tripId: string; date: ISODate; note?: string; parts: SplitPart[] }): Spend[];
  /** Edit one logged spend. */
  updateSpend(id: string, patch: SpendPatch): void;
  /** Remove one logged spend. */
  removeSpend(id: string): void;
  /** Choose light, dark or follow-the-system. */
  setTheme(theme: ThemePreference): void;
  /** Wipe all data (used by "Reset app" and tests). */
  reset(): void;
}

/** Full store state: data + actions. */
export type BudgetState = BudgetData & { actions: BudgetActions };

/** Vanilla store handle. */
export type BudgetStore = ReturnType<typeof createBudgetStore>;

/** Options for {@link createBudgetStore}. */
export interface BudgetStoreOptions {
  /** Where to persist. Pass AsyncStorage on native, `localStorage` on web, memory in tests. */
  storage: StateStorage;
  /** Storage key. */
  name?: string;
  /** Clock, for `createdAt`. Defaults to `new Date()`. */
  now?: () => Date;
  /** Id factory. Defaults to a time + random id; tests pass a counter. */
  createId?: () => string;
  /** Seed data (merged over the empty defaults, then over whatever storage holds). */
  initial?: Partial<BudgetData>;
}

/** Current persisted schema version. Bump and extend {@link migrate} when {@link BudgetData} changes shape. */
export const STORE_VERSION = 1;

/** The empty state of a fresh install. */
export const EMPTY_DATA: BudgetData = {
  trips: [],
  spends: [],
  activeTripId: null,
  settings: { theme: 'system' },
};

/**
 * Upgrade older persisted data to the current shape.
 * @param persisted - Whatever was found in storage.
 * @param version - The version it was written with.
 */
export function migrate(persisted: unknown, version: number): BudgetData {
  // v1 is the first release; nothing to upgrade yet. Add `if (version < 2) {...}` steps here.
  void version;
  return { ...EMPTY_DATA, ...(persisted as Partial<BudgetData>) };
}

const defaultId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function assertAmount(amount: Minor): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new BudgetError(
      'INVALID_AMOUNT',
      'Amount must be a positive whole number of minor units',
    );
  }
}

/**
 * Create the budget store.
 * @param options - Storage and optional overrides, see {@link BudgetStoreOptions}.
 * @returns A vanilla zustand store with `persist` middleware attached.
 * @example
 * const store = createBudgetStore({ storage: AsyncStorage });
 * store.getState().actions.createTrip({ name: 'Lisbon', currency: 'EUR', totalBudget: 70000, startDate, endDate, overspendPolicy: 'cascade' });
 */
export function createBudgetStore(options: BudgetStoreOptions) {
  const {
    storage,
    name = 'trip-budget/v1',
    now = () => new Date(),
    createId = defaultId,
    initial,
  } = options;

  return createStore<BudgetState>()(
    persist(
      (set, get) => {
        const requireTrip = (id: string): Trip => {
          const trip = get().trips.find((t) => t.id === id);
          if (!trip) throw new BudgetError('TRIP_NOT_FOUND', `No trip with id "${id}"`);
          return trip;
        };
        const requireSpend = (id: string): Spend => {
          const spend = get().spends.find((s) => s.id === id);
          if (!spend) throw new BudgetError('SPEND_NOT_FOUND', `No spend with id "${id}"`);
          return spend;
        };
        const assertInRange = (trip: Trip, date: ISODate) => {
          if (!isISODate(date) || date < trip.startDate || date > trip.endDate) {
            throw new BudgetError(
              'DATE_OUT_OF_RANGE',
              `${date} is outside ${trip.startDate}–${trip.endDate}`,
            );
          }
        };

        const actions: BudgetActions = {
          createTrip(input) {
            if (input.endDate < input.startDate)
              throw new BudgetError('INVALID_TRIP', 'End date is before start date');
            assertAmount(input.totalBudget);
            const trip: Trip = { ...input, id: createId(), createdAt: now().toISOString() };
            set((s) => ({ trips: [...s.trips, trip], activeTripId: trip.id }));
            return trip;
          },

          updateTrip(id, patch) {
            requireTrip(id);
            if (patch.totalBudget !== undefined) assertAmount(patch.totalBudget);
            set((s) => ({ trips: s.trips.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
          },

          deleteTrip(id) {
            requireTrip(id);
            set((s) => {
              const trips = s.trips.filter((t) => t.id !== id);
              return {
                trips,
                spends: s.spends.filter((sp) => sp.tripId !== id),
                activeTripId:
                  s.activeTripId === id ? (trips[trips.length - 1]?.id ?? null) : s.activeTripId,
              };
            });
          },

          setActiveTrip(id) {
            requireTrip(id);
            set({ activeTripId: id });
          },

          logSpend({ tripId, date, note, parts }) {
            const trip = requireTrip(tripId);
            assertInRange(trip, date);
            if (parts.length === 0)
              throw new BudgetError('INVALID_AMOUNT', 'A spend needs at least one part');
            parts.forEach((p) => assertAmount(p.amount));
            const splitGroupId = parts.length > 1 ? createId() : undefined;
            const created = now().toISOString();
            const spends: Spend[] = parts.map((p) => ({
              id: createId(),
              tripId,
              date,
              amount: p.amount,
              tag: p.tag as SpendTag,
              ...(note ? { note } : {}),
              ...(splitGroupId ? { splitGroupId } : {}),
              createdAt: created,
            }));
            set((s) => ({ spends: [...s.spends, ...spends] }));
            return spends;
          },

          updateSpend(id, patch) {
            const spend = requireSpend(id);
            if (patch.amount !== undefined) assertAmount(patch.amount);
            if (patch.date !== undefined) assertInRange(requireTrip(spend.tripId), patch.date);
            set((s) => ({
              spends: s.spends.map((sp) => (sp.id === id ? { ...sp, ...patch } : sp)),
            }));
          },

          removeSpend(id) {
            requireSpend(id);
            set((s) => ({ spends: s.spends.filter((sp) => sp.id !== id) }));
          },

          setTheme(theme) {
            set((s) => ({ settings: { ...s.settings, theme } }));
          },

          reset() {
            set({ ...EMPTY_DATA, settings: get().settings });
          },
        };

        return { ...EMPTY_DATA, ...initial, actions };
      },
      {
        name,
        version: STORE_VERSION,
        storage: createJSONStorage(() => storage),
        partialize: ({ trips, spends, activeTripId, settings }): BudgetData => ({
          trips,
          spends,
          activeTripId,
          settings,
        }),
        migrate: (persisted, version) => migrate(persisted, version) as BudgetState,
      },
    ),
  );
}
