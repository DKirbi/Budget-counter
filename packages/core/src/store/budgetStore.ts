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
import type { IssueCode, Receipt, ReceiptData, ReceiptStatus } from '../receipts/types';
import {
  AI_PROVIDERS,
  type AiSettings,
  DEFAULT_SETTINGS,
  type Settings,
  type Spend,
  type SpendTag,
  type SplitPart,
  type ThemePreference,
  type Trip,
  type TripInput,
} from '../types';
import type { StateStorage } from './storage';

/** Machine-readable reason a store action was rejected. */
export type BudgetErrorCode =
  | 'TRIP_NOT_FOUND'
  | 'SPEND_NOT_FOUND'
  | 'RECEIPT_NOT_FOUND'
  | 'DATE_OUT_OF_RANGE'
  | 'INVALID_AMOUNT'
  | 'INVALID_TRIP'
  | 'INVALID_RECEIPT';

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
  /** Scanned bills: the digital copies, newest last. Their spends live in `spends` (linked by `receiptId`). */
  receipts: Receipt[];
  /** Categories the user taught the app, by merchant key (see `merchantKey`). */
  merchantRules: Record<string, SpendTag>;
  activeTripId: string | null;
  settings: Settings;
}

/** Fields of a spend that may be edited. */
export type SpendPatch = Partial<Pick<Spend, 'amount' | 'tag' | 'note' | 'date'>>;

/** Fields of a trip that may be edited after creation. */
export type TripPatch = Partial<Pick<Trip, 'name' | 'overspendPolicy' | 'totalBudget'>>;

/** Input for {@link BudgetActions.saveReceipt}. */
export interface SaveReceiptInput {
  data: ReceiptData;
  /** Raw OCR text, kept so the parser can be re-run later. */
  rawText: string;
  /** Local file URI of the photo. */
  imageUri?: string;
  /** Trip the bill was scanned for. */
  tripId: string | null;
  /** Day to file the bill under; `null` while unknown. */
  date: ISODate | null;
  /** Main category. */
  tag: SpendTag;
  /** Issues the user has already accepted. */
  acknowledged?: readonly IssueCode[];
  /** Count the bill now: each part becomes a spend on `date` in `tripId`. */
  budget?: { parts: SplitPart[] };
  /** When not counted: wait in the inbox (default) or keep as a plain digital copy. */
  keep?: 'inbox' | 'archive';
}

/** Input for {@link BudgetActions.budgetReceipt}. */
export interface BudgetReceiptInput {
  tripId: string;
  date: ISODate;
  parts: SplitPart[];
  acknowledged?: readonly IssueCode[];
}

/** Fields of a receipt that may be edited. `data` is merged field by field. */
export interface ReceiptPatch {
  data?: Partial<ReceiptData>;
  /** Swap the whole JSON (an AI re-read), instead of merging field by field. Wins over `data`. */
  replaceData?: ReceiptData;
  date?: ISODate | null;
  tag?: SpendTag;
  acknowledged?: readonly IssueCode[];
}

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
  logSpend(input: {
    tripId: string;
    date: ISODate;
    note?: string;
    parts: SplitPart[];
    receiptId?: string;
  }): Spend[];
  /** Edit one logged spend. */
  updateSpend(id: string, patch: SpendPatch): void;
  /** Remove one logged spend. */
  removeSpend(id: string): void;
  /** Save a scanned bill, and (optionally) count it in the same step. */
  saveReceipt(input: SaveReceiptInput): Receipt;
  /** Count a saved bill: replaces any spends it already has with `parts` on `date` in `tripId`. */
  budgetReceipt(id: string, input: BudgetReceiptInput): Receipt;
  /** Stop counting a bill: removes its spends, keeps the digital copy. */
  unbudgetReceipt(id: string, keep?: 'inbox' | 'archive'): Receipt;
  /** Edit a saved bill's data without touching its spends. */
  updateReceipt(id: string, patch: ReceiptPatch): Receipt;
  /** Delete a bill and every spend created from it. Returns it so the caller can delete the photo file. */
  deleteReceipt(id: string): Receipt;
  /** Remember that bills from this merchant (see `merchantKey`) are in this category. */
  setMerchantRule(merchantKey: string, tag: SpendTag): void;
  /** Forget a merchant rule. */
  removeMerchantRule(merchantKey: string): void;
  /** Choose light, dark or follow-the-system. */
  setTheme(theme: ThemePreference): void;
  /** File clean bills straight away (`true`) or always ask for a tap (`false`). */
  setAutoConfirmReceipts(on: boolean): void;
  /** Change AI fallback preferences. Choosing a provider fills in its default model and address. */
  setAiSettings(patch: Partial<AiSettings>): void;
  /** Count one AI call on `today` (the counter starts over each day). */
  recordAiUse(today: ISODate): void;
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

/**
 * Current persisted schema version. Bump and extend {@link migrate} when {@link BudgetData} changes shape.
 * - v1: trips, spends, theme.
 * - v2: scanned receipts, merchant rules, `Spend.receiptId`, receipt/AI settings.
 */
export const STORE_VERSION = 2;

/** The empty state of a fresh install. */
export const EMPTY_DATA: BudgetData = {
  trips: [],
  spends: [],
  receipts: [],
  merchantRules: {},
  activeTripId: null,
  settings: DEFAULT_SETTINGS,
};

/** Merge saved settings over the defaults, one level deeper for the nested groups. */
export function mergeSettings(saved: Partial<Settings> | undefined): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    ai: { ...DEFAULT_SETTINGS.ai, ...saved?.ai },
    aiUsage: { ...DEFAULT_SETTINGS.aiUsage, ...saved?.aiUsage },
  };
}

/**
 * Upgrade older persisted data to the current shape. Safe to call with data that is already current.
 * @param persisted - Whatever was found in storage.
 * @param version - The version it was written with.
 */
export function migrate(persisted: unknown, version: number): BudgetData {
  void version; // every step so far is "fill in what is missing", which is idempotent
  const p = (persisted ?? {}) as Partial<BudgetData>;
  return { ...EMPTY_DATA, ...p, settings: mergeSettings(p.settings) };
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
        const requireReceipt = (id: string): Receipt => {
          const receipt = get().receipts.find((r) => r.id === id);
          if (!receipt) throw new BudgetError('RECEIPT_NOT_FOUND', `No receipt with id "${id}"`);
          return receipt;
        };
        /** Build the spends for one payment (several parts = one split group). */
        const buildSpends = (
          tripId: string,
          date: ISODate,
          parts: SplitPart[],
          extra: { note?: string; receiptId?: string },
        ): Spend[] => {
          if (parts.length === 0)
            throw new BudgetError('INVALID_AMOUNT', 'A spend needs at least one part');
          parts.forEach((p) => assertAmount(p.amount));
          const splitGroupId = parts.length > 1 ? createId() : undefined;
          const created = now().toISOString();
          return parts.map((p) => ({
            id: createId(),
            tripId,
            date,
            amount: p.amount,
            tag: p.tag as SpendTag,
            ...(extra.note ? { note: extra.note } : {}),
            ...(splitGroupId ? { splitGroupId } : {}),
            ...(extra.receiptId ? { receiptId: extra.receiptId } : {}),
            createdAt: created,
          }));
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
              const stamp = now().toISOString();
              return {
                trips,
                spends: s.spends.filter((sp) => sp.tripId !== id),
                // Bills outlive their trip as digital copies that wait for a new home.
                receipts: s.receipts.map((r) =>
                  r.tripId === id
                    ? {
                        ...r,
                        tripId: null,
                        status: r.status === 'budgeted' ? ('needs-attention' as const) : r.status,
                        updatedAt: stamp,
                      }
                    : r,
                ),
                activeTripId:
                  s.activeTripId === id ? (trips[trips.length - 1]?.id ?? null) : s.activeTripId,
              };
            });
          },

          setActiveTrip(id) {
            requireTrip(id);
            set({ activeTripId: id });
          },

          logSpend({ tripId, date, note, parts, receiptId }) {
            const trip = requireTrip(tripId);
            assertInRange(trip, date);
            const spends = buildSpends(tripId, date, parts, {
              ...(note ? { note } : {}),
              ...(receiptId ? { receiptId } : {}),
            });
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
            const removed = requireSpend(id);
            set((s) => {
              const spends = s.spends.filter((sp) => sp.id !== id);
              const { receiptId } = removed;
              // A bill whose last spend is gone is no longer counted: send it back to the inbox.
              const orphaned =
                receiptId !== undefined && !spends.some((sp) => sp.receiptId === receiptId);
              return {
                spends,
                ...(orphaned
                  ? {
                      receipts: s.receipts.map((r) =>
                        r.id === receiptId && r.status === 'budgeted'
                          ? {
                              ...r,
                              status: 'needs-attention' as const,
                              updatedAt: now().toISOString(),
                            }
                          : r,
                      ),
                    }
                  : {}),
              };
            });
          },

          saveReceipt(input) {
            const id = createId();
            const stamp = now().toISOString();
            let status: ReceiptStatus = input.keep === 'archive' ? 'archived' : 'needs-attention';
            let spends: Spend[] = [];
            if (input.budget) {
              if (!input.tripId || !input.date)
                throw new BudgetError('INVALID_RECEIPT', 'Counting a bill needs a trip and a day');
              const trip = requireTrip(input.tripId);
              assertInRange(trip, input.date);
              spends = buildSpends(trip.id, input.date, input.budget.parts, {
                ...(input.data.merchant ? { note: input.data.merchant } : {}),
                receiptId: id,
              });
              status = 'budgeted';
            } else if (input.tripId) {
              requireTrip(input.tripId);
            }
            const receipt: Receipt = {
              id,
              tripId: input.tripId,
              status,
              data: input.data,
              date: input.date,
              tag: input.tag,
              rawText: input.rawText,
              ...(input.imageUri ? { imageUri: input.imageUri } : {}),
              acknowledged: [...(input.acknowledged ?? [])],
              scannedAt: stamp,
              updatedAt: stamp,
            };
            set((s) => ({ receipts: [...s.receipts, receipt], spends: [...s.spends, ...spends] }));
            return receipt;
          },

          budgetReceipt(id, input) {
            const existing = requireReceipt(id);
            const trip = requireTrip(input.tripId);
            assertInRange(trip, input.date);
            const spends = buildSpends(trip.id, input.date, input.parts, {
              ...(existing.data.merchant ? { note: existing.data.merchant } : {}),
              receiptId: id,
            });
            const updated: Receipt = {
              ...existing,
              tripId: trip.id,
              status: 'budgeted',
              date: input.date,
              tag: (input.parts[0]?.tag ?? existing.tag) as SpendTag,
              acknowledged: [...new Set([...existing.acknowledged, ...(input.acknowledged ?? [])])],
              updatedAt: now().toISOString(),
            };
            set((s) => ({
              receipts: s.receipts.map((r) => (r.id === id ? updated : r)),
              spends: [...s.spends.filter((sp) => sp.receiptId !== id), ...spends],
            }));
            return updated;
          },

          unbudgetReceipt(id, keep = 'inbox') {
            const existing = requireReceipt(id);
            const updated: Receipt = {
              ...existing,
              status: keep === 'archive' ? 'archived' : 'needs-attention',
              updatedAt: now().toISOString(),
            };
            set((s) => ({
              receipts: s.receipts.map((r) => (r.id === id ? updated : r)),
              spends: s.spends.filter((sp) => sp.receiptId !== id),
            }));
            return updated;
          },

          updateReceipt(id, patch) {
            const existing = requireReceipt(id);
            const updated: Receipt = {
              ...existing,
              ...(patch.replaceData
                ? { data: patch.replaceData }
                : patch.data
                  ? { data: { ...existing.data, ...patch.data } }
                  : {}),
              ...(patch.date !== undefined ? { date: patch.date } : {}),
              ...(patch.tag ? { tag: patch.tag } : {}),
              ...(patch.acknowledged ? { acknowledged: [...patch.acknowledged] } : {}),
              updatedAt: now().toISOString(),
            };
            set((s) => ({ receipts: s.receipts.map((r) => (r.id === id ? updated : r)) }));
            return updated;
          },

          deleteReceipt(id) {
            const existing = requireReceipt(id);
            set((s) => ({
              receipts: s.receipts.filter((r) => r.id !== id),
              spends: s.spends.filter((sp) => sp.receiptId !== id),
            }));
            return existing;
          },

          setMerchantRule(merchantKey, tag) {
            if (!merchantKey) return;
            set((s) => ({ merchantRules: { ...s.merchantRules, [merchantKey]: tag } }));
          },

          removeMerchantRule(merchantKey) {
            set((s) => {
              const { [merchantKey]: _gone, ...rest } = s.merchantRules;
              return { merchantRules: rest };
            });
          },

          setTheme(theme) {
            set((s) => ({ settings: { ...s.settings, theme } }));
          },

          setAutoConfirmReceipts(on) {
            set((s) => ({ settings: { ...s.settings, autoConfirmReceipts: on } }));
          },

          setAiSettings(patch) {
            set((s) => {
              const next: AiSettings = { ...s.settings.ai, ...patch };
              const meta = AI_PROVIDERS.find((p) => p.id === next.provider);
              // Picking a provider fills in its model and address unless the caller set them too.
              if (meta && patch.provider && patch.provider !== s.settings.ai.provider) {
                if (patch.model === undefined) next.model = meta.defaultModel;
                if (patch.baseUrl === undefined) next.baseUrl = meta.baseUrl;
              }
              if (!Number.isFinite(next.dailyLimit) || next.dailyLimit < 0) next.dailyLimit = 0;
              return { settings: { ...s.settings, ai: next } };
            });
          },

          recordAiUse(today) {
            set((s) => {
              const { aiUsage } = s.settings;
              const count = aiUsage.date === today ? aiUsage.count + 1 : 1;
              return { settings: { ...s.settings, aiUsage: { date: today, count } } };
            });
          },

          reset() {
            set({ ...EMPTY_DATA, settings: get().settings });
          },
        };

        return {
          ...EMPTY_DATA,
          ...initial,
          settings: mergeSettings(initial?.settings),
          actions,
        };
      },
      {
        name,
        version: STORE_VERSION,
        storage: createJSONStorage(() => storage),
        partialize: ({
          trips,
          spends,
          receipts,
          merchantRules,
          activeTripId,
          settings,
        }): BudgetData => ({ trips, spends, receipts, merchantRules, activeTripId, settings }),
        migrate: (persisted, version) => migrate(persisted, version) as BudgetState,
        // Settings gain fields over time; never let an older saved object erase the new defaults.
        merge: (persisted, current) => {
          const saved = (persisted ?? {}) as Partial<BudgetData>;
          return {
            ...current,
            ...saved,
            settings: mergeSettings(saved.settings),
            actions: current.actions,
          };
        },
      },
    ),
  );
}
