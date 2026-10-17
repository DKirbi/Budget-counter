import { DEFAULT_SETTINGS } from '../types';
import { createMemoryStorage, createTestStore, makeTrip } from '../testing';
import { simpleBillText } from '../receipts/fixtures';
import { ocrFromText } from '../receipts/ocr';
import { parseReceipt } from '../receipts/parse';
import type { ReceiptData } from '../receipts/types';
import { BudgetError, createBudgetStore } from './budgetStore';
import {
  selectAiQuota,
  selectArchived,
  selectInbox,
  selectReceiptSpends,
  selectTimeline,
} from './selectors';

const bill = (date = '2026-05-03', total = 1250, shop = 'CAFE CENTRAL'): ReceiptData =>
  parseReceipt(ocrFromText(simpleBillText(date, total, shop)));

function setup() {
  const store = createTestStore({ initial: { trips: [makeTrip()], activeTripId: 'trip-1' } });
  return { store, a: store.getState().actions, get: () => store.getState() };
}
const save = (
  a: ReturnType<typeof setup>['a'],
  over: Partial<Parameters<typeof a.saveReceipt>[0]> = {},
) =>
  a.saveReceipt({
    data: bill(),
    rawText: 'raw',
    tripId: 'trip-1',
    date: '2026-05-03',
    tag: 'food',
    ...over,
  });

describe('saveReceipt', () => {
  it('counts a bill: one receipt and one linked spend', () => {
    const { a, get } = setup();
    const r = save(a, {
      budget: { parts: [{ amount: 1250, tag: 'food' }] },
      imageUri: 'file:///b.jpg',
    });
    expect(r).toMatchObject({
      status: 'budgeted',
      tripId: 'trip-1',
      date: '2026-05-03',
      imageUri: 'file:///b.jpg',
    });
    expect(get().receipts).toHaveLength(1);
    const [spend] = get().spends;
    expect(spend).toMatchObject({
      amount: 1250,
      tag: 'food',
      date: '2026-05-03',
      receiptId: r.id,
      note: 'Cafe Central',
    });
    expect(selectReceiptSpends(get().spends, r.id)).toHaveLength(1);
  });

  it('a split bill makes several spends in one split group', () => {
    const { a, get } = setup();
    const r = save(a, {
      budget: {
        parts: [
          { amount: 800, tag: 'groceries' },
          { amount: 450, tag: 'shopping' },
        ],
      },
    });
    const spends = selectReceiptSpends(get().spends, r.id);
    expect(spends).toHaveLength(2);
    expect(new Set(spends.map((s) => s.splitGroupId)).size).toBe(1);
    expect(spends[0]?.splitGroupId).toBeDefined();
    expect(spends.reduce((n, s) => n + s.amount, 0)).toBe(1250);
  });

  it('without a budget the bill waits in the inbox and counts for nothing', () => {
    const { a, get } = setup();
    const r = save(a);
    expect(r.status).toBe('needs-attention');
    expect(get().spends).toEqual([]);
    expect(selectInbox(get().receipts)).toEqual([r]);
  });

  it('can be kept as an archived copy', () => {
    const { a, get } = setup();
    const r = save(a, { tripId: null, date: null, keep: 'archive' });
    expect(selectArchived(get().receipts)).toEqual([r]);
    expect(selectInbox(get().receipts)).toEqual([]);
  });

  it('refuses to count without a trip or day, or outside the trip, and saves nothing', () => {
    const { a, get } = setup();
    const parts = [{ amount: 1250, tag: 'food' as const }];
    expect(() => save(a, { tripId: null, budget: { parts } })).toThrow(BudgetError);
    expect(() => save(a, { date: null, budget: { parts } })).toThrow(/trip and a day/);
    expect(() => save(a, { date: '2026-06-01', budget: { parts } })).toThrow(/outside/);
    expect(() => save(a, { tripId: 'nope' })).toThrow(/No trip/);
    expect(get().receipts).toEqual([]);
    expect(get().spends).toEqual([]);
  });
});

describe('budgetReceipt / unbudgetReceipt', () => {
  it('counts an inbox bill, and re-counting replaces the old spends', () => {
    const { a, get } = setup();
    const r = save(a);
    a.budgetReceipt(r.id, {
      tripId: 'trip-1',
      date: '2026-05-03',
      parts: [{ amount: 1250, tag: 'food' }],
      acknowledged: ['DATE_NOT_TODAY'],
    });
    expect(get().receipts[0]).toMatchObject({
      status: 'budgeted',
      acknowledged: ['DATE_NOT_TODAY'],
    });
    expect(get().spends).toHaveLength(1);

    a.budgetReceipt(r.id, {
      tripId: 'trip-1',
      date: '2026-05-04',
      parts: [
        { amount: 700, tag: 'groceries' },
        { amount: 550, tag: 'other' },
      ],
      acknowledged: ['DATE_NOT_TODAY', 'DUPLICATE'],
    });
    expect(get().spends.map((s) => [s.date, s.amount, s.tag])).toEqual([
      ['2026-05-04', 700, 'groceries'],
      ['2026-05-04', 550, 'other'],
    ]);
    expect(get().receipts[0]).toMatchObject({
      date: '2026-05-04',
      tag: 'groceries',
      acknowledged: ['DATE_NOT_TODAY', 'DUPLICATE'],
    });
  });

  it('validates', () => {
    const { a } = setup();
    const r = save(a);
    expect(() =>
      a.budgetReceipt('nope', {
        tripId: 'trip-1',
        date: '2026-05-03',
        parts: [{ amount: 1, tag: 'food' }],
      }),
    ).toThrow(/No receipt/);
    expect(() =>
      a.budgetReceipt(r.id, {
        tripId: 'trip-1',
        date: '2026-07-03',
        parts: [{ amount: 1, tag: 'food' }],
      }),
    ).toThrow(/outside/);
    expect(() =>
      a.budgetReceipt(r.id, {
        tripId: 'trip-1',
        date: '2026-05-03',
        parts: [{ amount: 0, tag: 'food' }],
      }),
    ).toThrow(/positive/);
    expect(() =>
      a.budgetReceipt(r.id, { tripId: 'trip-1', date: '2026-05-03', parts: [] }),
    ).toThrow(/at least one/);
  });

  it('unbudget removes the spends and keeps the copy', () => {
    const { a, get } = setup();
    const r = save(a, { budget: { parts: [{ amount: 1250, tag: 'food' }] } });
    a.unbudgetReceipt(r.id);
    expect(get().spends).toEqual([]);
    expect(get().receipts[0]?.status).toBe('needs-attention');
    a.unbudgetReceipt(r.id, 'archive');
    expect(get().receipts[0]?.status).toBe('archived');
  });
});

describe('editing and deleting', () => {
  it('updateReceipt merges data fields and bumps updatedAt', () => {
    const { a, get } = setup();
    const r = save(a);
    a.updateReceipt(r.id, {
      data: { merchant: 'Cafe Nova' },
      tag: 'groceries',
      date: '2026-05-02',
    });
    expect(get().receipts[0]).toMatchObject({ tag: 'groceries', date: '2026-05-02' });
    expect(get().receipts[0]?.data).toMatchObject({ merchant: 'Cafe Nova', total: 1250 });
    expect(() => a.updateReceipt('nope', {})).toThrow(/No receipt/);
  });

  it('replaceData swaps the whole JSON so stale fields (an old ambiguous date) do not survive an AI re-read', () => {
    const { a, get } = setup();
    const r = save(a, {
      data: { ...bill(), dateAmbiguous: true, dateAlternatives: ['2026-04-05'] },
    });
    const fresh = { ...bill(), source: 'ai' as const, merchant: 'Cafe Nova' };
    a.updateReceipt(r.id, { replaceData: fresh, data: { merchant: 'ignored' } });
    expect(get().receipts[0]?.data).toEqual(fresh);
    expect(get().receipts[0]?.data.dateAmbiguous).toBeUndefined();
  });

  it('deleteReceipt removes its spends only and returns the receipt for photo cleanup', () => {
    const { a, get } = setup();
    a.logSpend({ tripId: 'trip-1', date: '2026-05-03', parts: [{ amount: 100, tag: 'other' }] });
    const r = save(a, {
      budget: { parts: [{ amount: 1250, tag: 'food' }] },
      imageUri: 'file:///b.jpg',
    });
    const removed = a.deleteReceipt(r.id);
    expect(removed.imageUri).toBe('file:///b.jpg');
    expect(get().receipts).toEqual([]);
    expect(get().spends).toHaveLength(1);
  });

  it('deleting the last spend of a bill sends it back to the inbox; deleting one of two does not', () => {
    const { a, get } = setup();
    const single = save(a, { budget: { parts: [{ amount: 1250, tag: 'food' }] } });
    const split = save(a, {
      budget: {
        parts: [
          { amount: 800, tag: 'food' },
          { amount: 450, tag: 'other' },
        ],
      },
    });
    const [s1] = selectReceiptSpends(get().spends, single.id);
    const [p1, p2] = selectReceiptSpends(get().spends, split.id);
    a.removeSpend(s1!.id);
    expect(get().receipts.find((r) => r.id === single.id)?.status).toBe('needs-attention');
    a.removeSpend(p1!.id);
    expect(get().receipts.find((r) => r.id === split.id)?.status).toBe('budgeted');
    a.removeSpend(p2!.id);
    expect(get().receipts.find((r) => r.id === split.id)?.status).toBe('needs-attention');
  });

  it('deleting a trip detaches its bills instead of destroying the copies', () => {
    const { a, get } = setup();
    const r = save(a, { budget: { parts: [{ amount: 1250, tag: 'food' }] } });
    a.deleteTrip('trip-1');
    expect(get().spends).toEqual([]);
    expect(get().receipts).toHaveLength(1);
    expect(get().receipts[0]).toMatchObject({ id: r.id, tripId: null, status: 'needs-attention' });
  });

  it('reset wipes bills and rules but keeps settings', () => {
    const { a, get } = setup();
    save(a);
    a.setMerchantRule('spar', 'groceries');
    a.setTheme('dark');
    a.reset();
    expect(get().receipts).toEqual([]);
    expect(get().merchantRules).toEqual({});
    expect(get().settings.theme).toBe('dark');
  });
});

describe('merchant rules', () => {
  it('sets, overwrites and removes; ignores empty keys', () => {
    const { a, get } = setup();
    a.setMerchantRule('spar', 'groceries');
    a.setMerchantRule('spar', 'food');
    a.setMerchantRule('', 'food');
    expect(get().merchantRules).toEqual({ spar: 'food' });
    a.removeMerchantRule('spar');
    a.removeMerchantRule('never-existed');
    expect(get().merchantRules).toEqual({});
  });
});

describe('AI settings and quota', () => {
  it('choosing a provider fills in its model and address; custom values win', () => {
    const { a, get } = setup();
    a.setAiSettings({ provider: 'gemini' });
    expect(get().settings.ai).toMatchObject({
      provider: 'gemini',
      model: 'gemini-flash-latest',
      baseUrl: expect.stringContaining('generativelanguage'),
    });
    a.setAiSettings({ model: 'my-model' });
    expect(get().settings.ai.model).toBe('my-model');
    a.setAiSettings({ provider: 'openai', model: 'gpt-x' });
    expect(get().settings.ai).toMatchObject({
      provider: 'openai',
      model: 'gpt-x',
      baseUrl: 'https://api.openai.com/v1',
    });
    a.setAiSettings({ provider: 'none' });
    expect(get().settings.ai.provider).toBe('none');
  });
  it('clamps nonsense limits', () => {
    const { a, get } = setup();
    a.setAiSettings({ dailyLimit: -5 });
    expect(get().settings.ai.dailyLimit).toBe(0);
    a.setAiSettings({ dailyLimit: Number.NaN });
    expect(get().settings.ai.dailyLimit).toBe(0);
  });
  it('counts per day and starts over on a new day', () => {
    const { a, get } = setup();
    a.setAiSettings({ dailyLimit: 3 });
    const q = () => selectAiQuota(get().settings.ai, get().settings.aiUsage, '2026-05-03');
    expect(q()).toEqual({ used: 0, limit: 3, remaining: 3 });
    a.recordAiUse('2026-05-03');
    a.recordAiUse('2026-05-03');
    expect(q()).toEqual({ used: 2, limit: 3, remaining: 1 });
    expect(selectAiQuota(get().settings.ai, get().settings.aiUsage, '2026-05-04').used).toBe(0);
    a.recordAiUse('2026-05-04');
    expect(get().settings.aiUsage).toEqual({ date: '2026-05-04', count: 1 });
    a.recordAiUse('2026-05-04');
    a.recordAiUse('2026-05-04');
    a.recordAiUse('2026-05-04');
    expect(selectAiQuota(get().settings.ai, get().settings.aiUsage, '2026-05-04').remaining).toBe(
      0,
    );
  });
  it('autoConfirm toggles', () => {
    const { a, get } = setup();
    expect(get().settings.autoConfirmReceipts).toBe(true);
    a.setAutoConfirmReceipts(false);
    expect(get().settings.autoConfirmReceipts).toBe(false);
  });
});

describe('timeline', () => {
  it('groups counted bills by the day printed on them, newest day first, with totals', () => {
    const { a, get } = setup();
    const day3a = save(a, {
      data: { ...bill('2026-05-03'), time: '09:00' },
      budget: { parts: [{ amount: 1000, tag: 'food' }] },
    });
    const day3b = save(a, {
      data: { ...bill('2026-05-03'), time: '18:30' },
      budget: {
        parts: [
          { amount: 500, tag: 'food' },
          { amount: 250, tag: 'other' },
        ],
      },
    });
    const day1 = save(a, {
      date: '2026-05-01',
      data: bill('2026-05-01'),
      budget: { parts: [{ amount: 300, tag: 'food' }] },
    });
    save(a); // inbox: not on the timeline
    save(a, { tripId: null, date: null, keep: 'archive' }); // archived: not on the timeline

    const days = selectTimeline(get(), 'trip-1');
    expect(days.map((d) => [d.date, d.total])).toEqual([
      ['2026-05-03', 1750],
      ['2026-05-01', 300],
    ]);
    expect(days[0]!.entries.map((e) => e.receipt.id)).toEqual([day3b.id, day3a.id]);
    expect(days[0]!.entries[0]).toMatchObject({ amount: 750 });
    expect(days[0]!.entries[0]!.spends).toHaveLength(2);
    expect(days[1]!.entries[0]!.receipt.id).toBe(day1.id);
  });
  it('is empty for another trip', () => {
    const { a, get } = setup();
    save(a, { budget: { parts: [{ amount: 1000, tag: 'food' }] } });
    expect(selectTimeline(get(), 'other-trip')).toEqual([]);
  });
  it('inbox is oldest scan first', () => {
    let tick = 0;
    const store = createBudgetStore({
      storage: createMemoryStorage(),
      now: () => new Date(Date.UTC(2026, 4, 3, 10, 0, tick++)),
      createId: () => `x${tick}`,
    });
    const a = store.getState().actions;
    const first = a.saveReceipt({
      data: bill(),
      rawText: '',
      tripId: null,
      date: null,
      tag: 'other',
    });
    const second = a.saveReceipt({
      data: bill(),
      rawText: '',
      tripId: null,
      date: null,
      tag: 'other',
    });
    expect(selectInbox(store.getState().receipts).map((r) => r.id)).toEqual([first.id, second.id]);
  });
});

describe('persistence of receipts', () => {
  it('survives a restart', () => {
    const storage = createMemoryStorage();
    const make = () =>
      createBudgetStore({
        storage,
        initial: undefined,
        createId: (() => {
          let n = 0;
          return () => `q-${++n}`;
        })(),
      });
    const a = make();
    const trip = a.getState().actions.createTrip({
      name: 'T',
      currency: 'EUR',
      totalBudget: 70000,
      startDate: '2026-05-01',
      endDate: '2026-05-07',
      overspendPolicy: 'cascade',
    });
    a.getState().actions.saveReceipt({
      data: bill(),
      rawText: 'raw',
      tripId: trip.id,
      date: '2026-05-03',
      tag: 'food',
      budget: { parts: [{ amount: 1250, tag: 'food' }] },
    });
    a.getState().actions.setMerchantRule('cafe central', 'food');
    const b = createBudgetStore({ storage });
    expect(b.getState().receipts[0]?.data.merchant).toBe('Cafe Central');
    expect(b.getState().spends[0]?.receiptId).toBe(b.getState().receipts[0]?.id);
    expect(b.getState().merchantRules).toEqual({ 'cafe central': 'food' });
    expect(b.getState().settings).toEqual(DEFAULT_SETTINGS);
  });
});
