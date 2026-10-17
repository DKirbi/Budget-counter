import { selectActivePlan, selectInbox, selectTimeline } from '../store/selectors';
import { createTestStore, makeTrip } from '../testing';
import type { BudgetStore } from '../store/budgetStore';
import { RECEIPT_FIXTURES, fixtureOcr, simpleBillText } from './fixtures';
import { ocrFromText } from './ocr';
import {
  type ScanContext,
  commitScan,
  evaluateScan,
  offeredSplit,
  openIssues,
  plausibleWindow,
  processScan,
  summarizeBatch,
} from './pipeline';
import { parseReceipt } from './parse';

const TODAY = '2026-10-06';
const trip = makeTrip({
  id: 'trip-1',
  startDate: '2026-10-01',
  endDate: '2026-10-07',
  totalBudget: 70_000,
});
const ctx = (over: Partial<ScanContext> = {}): ScanContext => ({
  today: TODAY,
  trip,
  trips: [trip],
  receipts: [],
  merchantRules: {},
  autoConfirm: true,
  ...over,
});
const scan = (date: string, total = 1250, shop = 'CAFE CENTRAL', c = ctx()) =>
  processScan(ocrFromText(simpleBillText(date, total, shop)), c);

describe('processScan', () => {
  it('files a clean bill from today without asking', () => {
    const o = scan(TODAY);
    expect(o.mode).toBe('auto');
    expect(o.plan).toMatchObject({ canBudget: true, date: TODAY, amount: 1250, tripId: 'trip-1' });
    expect(o.parts).toEqual([{ amount: 1250, tag: 'food' }]);
    expect(o.aiMayHelp).toBe(false);
  });
  it('asks when auto-confirm is off, even for a clean bill', () => {
    const o = scan(TODAY, 1250, 'CAFE CENTRAL', ctx({ autoConfirm: false }));
    expect(o.mode).toBe('review');
    expect(o.plan.canBudget).toBe(true);
  });
  it('asks about a bill from days ago, and says why', () => {
    const o = scan('2026-10-02');
    expect(o.mode).toBe('review');
    expect(openIssues(o.plan).map((i) => i.code)).toEqual(['DATE_NOT_TODAY']);
    expect(o.aiMayHelp).toBe(false);
  });
  it('asks about a bill from outside the trip', () => {
    expect(openIssues(scan('2026-08-02').plan).map((i) => i.code)).toEqual(['DATE_OUTSIDE_TRIP']);
  });
  it('offers AI for an unreadable photo', () => {
    const o = processScan(ocrFromText('~~ blurry ~~'), ctx());
    expect(o.mode).toBe('review');
    expect(o.aiMayHelp).toBe(true);
    expect(o.parts).toEqual([]);
  });
  it('knows the trip window, so a slash date reads the way the trip needs', () => {
    const it = RECEIPT_FIXTURES.find((f) => f.id === 'it-cafe')!;
    const t = makeTrip({ startDate: '2026-10-08', endDate: '2026-10-14' });
    const o = processScan(fixtureOcr(it), ctx({ today: '2026-10-12', trip: t, trips: [t] }));
    expect(o.data).toMatchObject({ date: '2026-10-12' });
    expect(o.data.dateAmbiguous).toBeUndefined();
    expect(o.mode).toBe('auto');
  });
  it("uses the user's merchant rules", () => {
    const o = scan(
      TODAY,
      1250,
      'CAFE CENTRAL',
      ctx({ merchantRules: { 'cafe central': 'shopping' } }),
    );
    expect(o.parts[0]!.tag).toBe('shopping');
  });
  it('works without a trip: nothing can be filed', () => {
    const o = scan(TODAY, 1250, 'CAFE CENTRAL', ctx({ trip: null, trips: [] }));
    expect(o.mode).toBe('review');
    expect(openIssues(o.plan).map((i) => i.code)).toEqual(['NO_TRIP']);
  });
});

describe('evaluateScan with decisions', () => {
  it('turns "review" into "auto-able" once the user decided', () => {
    const data = parseReceipt(ocrFromText(simpleBillText('2026-10-02')));
    expect(evaluateScan(data, ctx()).mode).toBe('review');
    const decided = evaluateScan(data, ctx(), { acknowledged: ['DATE_NOT_TODAY'] });
    expect(decided).toMatchObject({ mode: 'auto', plan: { canBudget: true, date: '2026-10-02' } });
  });
});

describe('plausibleWindow', () => {
  it('runs from the trip start to today, or the trip end if it is over', () => {
    expect(plausibleWindow(trip, TODAY)).toEqual({ from: '2026-10-01', to: TODAY });
    expect(plausibleWindow(trip, '2026-12-01')).toEqual({ from: '2026-10-01', to: '2026-10-07' });
    expect(plausibleWindow(trip, '2026-09-01')).toBeUndefined();
    expect(plausibleWindow(null, TODAY)).toBeUndefined();
  });
});

describe('offeredSplit', () => {
  it('is offered only when the parts add up to what would be counted', () => {
    const data = parseReceipt(
      ocrFromText('SPAR\nDatum 06.10.2026\nMilch 3,00\nSouvenir magnet 5,00\nSUMME 8,00 EUR'),
    );
    const o = evaluateScan(data, ctx());
    expect(offeredSplit(o)).toEqual([
      { tag: 'groceries', amount: 300 },
      { tag: 'shopping', amount: 500 },
    ]);
  });
  it('is not offered for a bill in another currency (the counted amount differs)', () => {
    const data = parseReceipt(
      ocrFromText('SPAR\nDatum 06.10.2026\nMilch $3.00\nSouvenir magnet $5.00\nSUMME $8.00'),
    );
    expect(offeredSplit(evaluateScan(data, ctx(), { amountInTripCurrency: 700 }))).toBeUndefined();
  });
  it('is undefined for ordinary bills', () => {
    expect(offeredSplit(scan(TODAY))).toBeUndefined();
  });
});

describe('an evening of scanning, end to end', () => {
  const fresh = (): { store: BudgetStore } => ({
    store: createTestStore({ initial: { trips: [trip], activeTripId: 'trip-1' } }),
  });
  /** What the scan screen does for each photo. */
  const scanInto = (store: BudgetStore, text: string, imageUri: string) => {
    const s = store.getState();
    const c = ctx({
      receipts: s.receipts,
      merchantRules: s.merchantRules,
      autoConfirm: s.settings.autoConfirmReceipts,
    });
    return commitScan(s.actions, processScan(ocrFromText(text), c), { rawText: text, imageUri });
  };

  it('files the clean ones, holds the odd ones, and the timeline and budget follow', () => {
    const { store } = fresh();
    const batch = [
      scanInto(store, simpleBillText(TODAY, 1250, 'CAFE CENTRAL'), 'file:///1.jpg'), // clean
      scanInto(store, simpleBillText(TODAY, 4200, 'SPAR'), 'file:///2.jpg'), // clean
      scanInto(store, simpleBillText('2026-10-05', 800, 'PEKARNA'), 'file:///3.jpg'), // yesterday: quiet
      scanInto(store, simpleBillText('2026-10-02', 3000, 'TAXI LJUBLJANA'), 'file:///4.jpg'), // 4 days ago: asks
      scanInto(store, simpleBillText('2026-08-02', 999, 'OLD SHOP'), 'file:///5.jpg'), // other month: asks
      scanInto(store, simpleBillText(TODAY, 1250, 'CAFE CENTRAL'), 'file:///6.jpg'), // same bill again: asks
      scanInto(store, '~~ blur ~~', 'file:///7.jpg'), // unreadable: asks
    ];
    expect(batch.map((r) => r.filed)).toEqual([true, true, true, false, false, false, false]);
    expect(summarizeBatch(batch)).toEqual({ filed: 3, needAttention: 4, amount: 6250 });

    const s = store.getState();
    expect(s.receipts).toHaveLength(7);
    expect(s.spends).toHaveLength(3);
    expect(s.spends.every((sp) => sp.receiptId)).toBe(true);
    expect(selectInbox(s.receipts).map((r) => r.imageUri)).toEqual([
      'file:///4.jpg',
      'file:///5.jpg',
      'file:///6.jpg',
      'file:///7.jpg',
    ]);

    // The timeline is built from the printed dates, not the scan time.
    expect(selectTimeline(s, 'trip-1').map((d) => [d.date, d.total])).toEqual([
      [TODAY, 5450],
      ['2026-10-05', 800],
    ]);
    // Today's money moved: 100/day - 54.50 spent today (+ yesterday's overspend/underspend carried).
    const plan = selectActivePlan(s, TODAY)!;
    expect(plan.today!.spent).toBe(5450);
  });

  it('the duplicate is caught against what was just filed, with the right reason', () => {
    const { store } = fresh();
    scanInto(store, simpleBillText(TODAY), 'file:///a.jpg');
    const again = scanInto(store, simpleBillText(TODAY), 'file:///b.jpg');
    expect(again.filed).toBe(false);
    const c = ctx({ receipts: store.getState().receipts });
    const o = processScan(ocrFromText(simpleBillText(TODAY)), c);
    expect(openIssues(o.plan).map((i) => i.code)).toEqual(['DUPLICATE']);
  });

  it('every odd bill keeps its photo and raw text, so nothing is lost if the app closes', () => {
    const { store } = fresh();
    scanInto(store, '~~ blur ~~', 'file:///x.jpg');
    expect(store.getState().receipts[0]).toMatchObject({
      status: 'needs-attention',
      imageUri: 'file:///x.jpg',
      rawText: '~~ blur ~~',
    });
  });

  it('recorded acknowledgements travel with an auto-filed bill', () => {
    const { store } = fresh();
    const r = scanInto(store, simpleBillText('2026-10-05'), 'file:///y.jpg');
    expect(r.receipt.acknowledged).toEqual(['DATE_NOT_TODAY']);
    expect(r.filed).toBe(true);
  });

  it('with auto-confirm off, everything waits for a tap', () => {
    const { store } = fresh();
    store.getState().actions.setAutoConfirmReceipts(false);
    const r = scanInto(store, simpleBillText(TODAY), 'file:///z.jpg');
    expect(r.filed).toBe(false);
    expect(store.getState().spends).toEqual([]);
  });
});
