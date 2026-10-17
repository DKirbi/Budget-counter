/**
 * Fixtures and helpers for tests, Storybook stories and demos. Not imported by production code.
 * @module testing
 */
import { type TripPlan, computeTripPlan } from './allowance';
import type { ISODate } from './dates';
import { type BudgetData, type BudgetStore, createBudgetStore } from './store/budgetStore';
import { createMemoryStorage } from './store/storage';
import { RECEIPT_SCHEMA_VERSION, type Receipt, type ReceiptIssue } from './receipts/types';
import { DEFAULT_SETTINGS, type Spend, type Trip } from './types';
import type { FakeScanServices } from './receipts/fakes';

export { createMemoryStorage } from './store/storage';
export {
  createFakeScanServices,
  fixtureImages,
  type FakeScanOptions,
  type FakeScanServices,
} from './receipts/fakes';
export {
  RECEIPT_FIXTURES,
  fixtureOcr,
  simpleBillText,
  type ReceiptFixture,
} from './receipts/fixtures';

/** A fixed "today" used across stories and tests so screenshots are stable. */
export const DEMO_TODAY: ISODate = '2026-05-03';

/**
 * Build a trip with sensible defaults (Lisbon, 7 days, €700 → €100/day).
 * @param overrides - Fields to change.
 */
export function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    name: 'Lisbon long weekend',
    currency: 'EUR',
    totalBudget: 70_000,
    startDate: '2026-05-01',
    endDate: '2026-05-07',
    overspendPolicy: 'cascade',
    createdAt: '2026-04-20T09:00:00.000Z',
    ...overrides,
  };
}

let spendCounter = 0;
/**
 * Build a spend. Ids are unique per call unless you pass one.
 * @param overrides - Fields to change.
 */
export function makeSpend(overrides: Partial<Spend> = {}): Spend {
  spendCounter += 1;
  return {
    id: `spend-${spendCounter}`,
    tripId: 'trip-1',
    date: '2026-05-01',
    amount: 1_000,
    tag: 'food',
    createdAt: `2026-05-01T12:${String(spendCounter % 60).padStart(2, '0')}:00.000Z`,
    ...overrides,
  };
}

let receiptCounter = 0;
/**
 * Build a stored receipt (budgeted, Lisbon café, €12.50, day 2 of the demo trip) with unique ids.
 * @param overrides - Top-level fields to change.
 * @param data - Fields of `receipt.data` to change.
 */
export function makeReceipt(
  overrides: Partial<Receipt> = {},
  data: Partial<Receipt['data']> = {},
): Receipt {
  receiptCounter += 1;
  return {
    id: `receipt-${receiptCounter}`,
    tripId: 'trip-1',
    status: 'budgeted',
    date: '2026-05-02',
    tag: 'food',
    rawText: '',
    acknowledged: [],
    scannedAt: `2026-05-03T18:${String(receiptCounter % 60).padStart(2, '0')}:00.000Z`,
    updatedAt: '2026-05-03T18:00:00.000Z',
    data: {
      schemaVersion: RECEIPT_SCHEMA_VERSION,
      source: 'ocr',
      merchant: 'Pastelaria Central',
      date: '2026-05-02',
      time: '09:41',
      currency: 'EUR',
      total: 1_250,
      items: [],
      confidence: 0.9,
      ...data,
    },
    ...overrides,
  };
}

/**
 * Build a review issue (a date problem with two ways out) for component stories.
 * @param overrides - Fields to change.
 */
export function makeIssue(overrides: Partial<ReceiptIssue> = {}): ReceiptIssue {
  return {
    code: 'DATE_NOT_TODAY',
    severity: 'decision',
    title: 'This bill is from 28 Apr',
    detail: 'It is four days older than today. File it under the day printed on it?',
    acknowledgeable: true,
    resolved: false,
    ...overrides,
  };
}

/** Services plugged into a story or test (fake OCR, picker, secrets, fetch) — see {@link StoryLoaded}. */
export type StoryServices = FakeScanServices;

/** A believable mid-trip data set: day 1 frugal, day 2 overspent, day 3 (today) in progress. */
export function demoData(): BudgetData {
  const trip = makeTrip();
  const s = (date: ISODate, amount: number, tag: Spend['tag'], note: string, n: number): Spend =>
    makeSpend({
      id: `demo-${n}`,
      date,
      amount,
      tag,
      note,
      createdAt: `${date}T${String(8 + n).padStart(2, '0')}:00:00.000Z`,
    });
  return {
    trips: [trip],
    activeTripId: trip.id,
    receipts: [],
    merchantRules: {},
    settings: DEFAULT_SETTINGS,
    spends: [
      s('2026-05-01', 1_450, 'food', 'Pastéis de nata', 1),
      s('2026-05-01', 4_200, 'transport', 'Metro day pass + airport', 2),
      s('2026-05-01', 2_800, 'groceries', 'Supermarket', 3),
      s('2026-05-02', 9_500, 'activities', 'Sintra tickets', 4),
      s('2026-05-02', 6_400, 'food', 'Dinner in Alfama', 5),
      s('2026-05-03', 1_800, 'food', 'Lunch', 6),
      s('2026-05-03', 950, 'transport', 'Tram 28', 7),
    ],
  };
}

/**
 * The allowance plan for {@link demoData} on {@link DEMO_TODAY}: day 1 frugal, day 2 over (debt carried in),
 * day 3 in progress, four days to come. Handy for component stories that need realistic `DayPlan`s.
 */
export function demoPlan(): TripPlan {
  const data = demoData();
  return computeTripPlan(data.trips[0]!, data.spends, DEMO_TODAY);
}

/** Options for {@link createTestStore}. */
export interface TestStoreOptions {
  initial?: Partial<BudgetData>;
  /** Start with the demo data set. */
  demo?: boolean;
}

/**
 * A store with synchronous in-memory storage, deterministic ids and a frozen clock.
 * @param options - Seed data.
 */
export function createTestStore(options: TestStoreOptions = {}): BudgetStore {
  let n = 0;
  return createBudgetStore({
    storage: createMemoryStorage(),
    now: () => new Date('2026-05-03T10:00:00.000Z'),
    createId: () => `id-${++n}`,
    initial: options.demo ? demoData() : options.initial,
  });
}

/**
 * What the Storybook preview's loader hands to every story via `context.loaded`, so `play` functions can assert on
 * (and drive) the same in-memory store the UI is using.
 * @example
 * play: async ({ canvasElement, loaded }) => {
 *   const { store } = loaded as StoryLoaded;
 *   …
 *   expect(store.getState().spends).toHaveLength(8);
 * }
 */
export interface StoryLoaded {
  store: BudgetStore;
  /** Fake scan services (OCR by fixture, recording fetch…). Configure with `parameters.scan`. */
  services: StoryServices;
}
