/**
 * React bindings for the budget store: a provider plus small, memoised hooks.
 * Imported from `@tbc/core/react` so the pure domain stays usable without React.
 * @module react
 */
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { useStore } from 'zustand';
import { computeTripPlan, type TripPlan } from './allowance';
import { type ISODate, todayISO } from './dates';
import type { BudgetState, BudgetStore } from './store/budgetStore';
import type { Receipt } from './receipts/types';
import {
  type AiQuota,
  type TimelineDay,
  selectActiveTrip,
  selectAiQuota,
  selectArchived,
  selectInbox,
  selectReceiptSpends,
  selectSpendsOnDate,
  selectTimeline,
  selectTripSpends,
} from './store/selectors';
import { computeTripSummary, type TripSummary } from './summary';
import type { Spend, Trip } from './types';

interface BudgetContextValue {
  store: BudgetStore;
  /** Fixed "today" for tests/stories; `undefined` means follow the real clock. */
  today?: ISODate;
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

/** Props for {@link BudgetProvider}. */
export interface BudgetProviderProps {
  store: BudgetStore;
  /** Freeze the current day (tests, Storybook, screenshots). Omit in production. */
  today?: ISODate;
  children: ReactNode;
}

/**
 * Make a store (and optionally a frozen "today") available to every hook below.
 * @example
 * <BudgetProvider store={store}><App /></BudgetProvider>
 */
export function BudgetProvider({ store, today, children }: BudgetProviderProps) {
  const value = useMemo(() => ({ store, today }), [store, today]);
  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

function useCtx(): BudgetContextValue {
  const ctx = useContext(BudgetContext);
  if (!ctx) throw new Error('Budget hooks must be used inside <BudgetProvider>');
  return ctx;
}

/**
 * The store itself, for code that must read the *latest* state inside an async loop (a scan batch files bills one
 * after another and each must see the previous one, which a render-time snapshot would not).
 */
export function useBudgetStore(): BudgetStore {
  return useCtx().store;
}

/**
 * Subscribe to a slice of state. Selectors must return stable references (primitives or existing
 * state objects); derive new arrays with the memoised hooks instead.
 * @param selector - Picks the slice.
 */
export function useBudget<T>(selector: (state: BudgetState) => T): T {
  return useStore(useCtx().store, selector);
}

/** Stable object of all mutating actions. Never re-renders on data changes. */
export function useBudgetActions() {
  return useBudget((s) => s.actions);
}

/** `true` once persisted data has been read from storage (immediately for sync storage). */
export function useHydrated(): boolean {
  const { store } = useCtx();
  return useSyncExternalStore(
    (onChange) => store.persist.onFinishHydration(onChange),
    () => store.persist.hasHydrated(),
    () => true, // server render: nothing to wait for
  );
}

/** Milliseconds until the next local midnight (used to roll "today" over while the app stays open). */
function msUntilMidnight(now: Date): number {
  const next = new Date(now);
  next.setHours(24, 0, 1, 0);
  return next.getTime() - now.getTime();
}

/**
 * Current calendar day. Follows the clock across midnight unless the provider froze it.
 * @returns `YYYY-MM-DD` in the device time zone.
 */
export function useToday(): ISODate {
  const { today: frozen } = useCtx();
  const [live, setLive] = useState(() => todayISO());
  useEffect(() => {
    if (frozen) return;
    const id = setTimeout(() => setLive(todayISO()), msUntilMidnight(new Date()));
    return () => clearTimeout(id);
  }, [frozen, live]);
  return frozen ?? live;
}

/** The trip currently selected, or `null` on a fresh install. */
export function useActiveTrip(): Trip | null {
  const trips = useBudget((s) => s.trips);
  const activeTripId = useBudget((s) => s.activeTripId);
  return useMemo(() => selectActiveTrip({ trips, activeTripId }), [trips, activeTripId]);
}

/**
 * Spends of a trip, newest first.
 * @param tripId - Trip id, or `null` to get an empty list.
 */
export function useTripSpends(tripId: string | null): Spend[] {
  const spends = useBudget((s) => s.spends);
  return useMemo(() => (tripId ? selectTripSpends(spends, tripId) : []), [spends, tripId]);
}

/**
 * Spends logged on one day of a trip, newest first.
 * @param tripId - Trip id.
 * @param date - Day to show.
 */
export function useDaySpends(tripId: string | null, date: ISODate): Spend[] {
  const spends = useTripSpends(tripId);
  return useMemo(() => selectSpendsOnDate(spends, date), [spends, date]);
}

/** Allowance plan for the active trip (recomputed only when trips, spends or the day change). */
export function useActivePlan(): TripPlan | null {
  const trip = useActiveTrip();
  const spends = useBudget((s) => s.spends);
  const today = useToday();
  return useMemo(() => (trip ? computeTripPlan(trip, spends, today) : null), [trip, spends, today]);
}

/** Summary statistics for the active trip. */
export function useActiveSummary(): TripSummary | null {
  const plan = useActivePlan();
  const spends = useBudget((s) => s.spends);
  return useMemo(() => (plan ? computeTripSummary(plan, spends) : null), [plan, spends]);
}

/**
 * One saved bill, or `undefined` if it was deleted.
 * @param id - Receipt id.
 */
export function useReceipt(id: string | undefined): Receipt | undefined {
  return useBudget((s) => (id ? s.receipts.find((r) => r.id === id) : undefined));
}

/**
 * The spends created from one bill.
 * @param receiptId - Receipt id.
 */
export function useReceiptSpends(receiptId: string | undefined): Spend[] {
  const spends = useBudget((s) => s.spends);
  return useMemo(
    () => (receiptId ? selectReceiptSpends(spends, receiptId) : []),
    [spends, receiptId],
  );
}

/** Bills waiting for a decision, oldest scan first. */
export function useInbox(): Receipt[] {
  const receipts = useBudget((s) => s.receipts);
  return useMemo(() => selectInbox(receipts), [receipts]);
}

/** Bills kept as digital copies only, newest first. */
export function useArchived(): Receipt[] {
  const receipts = useBudget((s) => s.receipts);
  return useMemo(() => selectArchived(receipts), [receipts]);
}

/**
 * The timeline of counted bills for a trip, grouped by the day printed on the bill.
 * @param tripId - Trip id, or `null` for an empty timeline.
 */
export function useTimeline(tripId: string | null): TimelineDay[] {
  const receipts = useBudget((s) => s.receipts);
  const spends = useBudget((s) => s.spends);
  return useMemo(
    () => (tripId ? selectTimeline({ receipts, spends }, tripId) : []),
    [receipts, spends, tripId],
  );
}

/** Today's remaining AI calls under the app's own daily cap. */
export function useAiQuota(): AiQuota {
  const ai = useBudget((s) => s.settings.ai);
  const usage = useBudget((s) => s.settings.aiUsage);
  const today = useToday();
  return useMemo(() => selectAiQuota(ai, usage, today), [ai, usage, today]);
}
