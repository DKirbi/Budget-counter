import type { Trip } from '../types';
import { makeTrip } from '../testing';
import {
  aiCouldHelp,
  analyzeReceipt,
  blockingIssues,
  chosenTrip,
  planBudgeting,
  type AnalyzeContext,
} from './analyze';
import { RECEIPT_FIXTURES, fixtureOcr, simpleBillText } from './fixtures';
import { ocrFromText } from './ocr';
import { parseReceipt } from './parse';
import type { IssueCode, Receipt, ReceiptData } from './types';

const TODAY = '2026-10-06';
const trip: Trip = makeTrip({
  id: 't1',
  name: 'Autumn city break',
  startDate: '2026-10-01',
  endDate: '2026-10-07',
});
const other: Trip = makeTrip({
  id: 't0',
  name: 'Summer coast',
  startDate: '2026-08-01',
  endDate: '2026-08-14',
});

const ctx = (over: Partial<AnalyzeContext> = {}): AnalyzeContext => ({
  today: TODAY,
  trip,
  trips: [trip, other],
  receipts: [],
  ...over,
});
const bill = (date: string, total = 1250, shop = 'CAFE CENTRAL'): ReceiptData =>
  parseReceipt(ocrFromText(simpleBillText(date, total, shop)));
const codes = (issues: ReturnType<typeof analyzeReceipt>) => issues.map((i) => i.code);
const find = (issues: ReturnType<typeof analyzeReceipt>, code: IssueCode) =>
  issues.find((i) => i.code === code);
const stored = (data: ReceiptData, over: Partial<Receipt> = {}): Receipt => ({
  id: 'r-old',
  tripId: 't1',
  status: 'budgeted',
  data,
  date: data.date ?? null,
  tag: 'food',
  rawText: '',
  acknowledged: [],
  scannedAt: '2026-10-06T18:00:00Z',
  updatedAt: '2026-10-06T18:00:00Z',
  ...over,
});

describe('a normal bill', () => {
  it('printed today needs no questions and can be budgeted', () => {
    const plan = planBudgeting(bill(TODAY), ctx());
    expect(blockingIssues(plan.issues)).toEqual([]);
    expect(plan).toMatchObject({ canBudget: true, tripId: 't1', date: TODAY, amount: 1250 });
  });
  it('every clean fixture is accepted when the trip fits', () => {
    for (const f of RECEIPT_FIXTURES.filter(
      (x) => x.expect.currency === 'EUR' && !x.expect.dateAmbiguous,
    )) {
      const data = parseReceipt(fixtureOcr(f));
      const t = makeTrip({ startDate: f.expect.date, endDate: f.expect.date });
      const plan = planBudgeting(data, ctx({ trip: t, trips: [t], today: f.expect.date }));
      expect({ id: f.id, ok: plan.canBudget }).toEqual({ id: f.id, ok: true });
    }
  });
});

describe('a bill from a different day', () => {
  it('yesterday is filed quietly with a note', () => {
    const issues = analyzeReceipt(bill('2026-10-05'), ctx());
    expect(find(issues, 'DATE_NOT_TODAY')).toMatchObject({
      severity: 'info',
      resolved: true,
      title: 'From yesterday',
    });
    expect(blockingIssues(issues)).toEqual([]);
  });
  it('older bills ask, and offer the bill date or today', () => {
    const issues = analyzeReceipt(bill('2026-10-03'), ctx());
    const issue = find(issues, 'DATE_NOT_TODAY')!;
    expect(issue).toMatchObject({ severity: 'decision', resolved: false, acknowledgeable: true });
    expect(issue.title).toContain('3 days ago');
    expect(issue.dateChoices!.map((c) => c.date)).toEqual(['2026-10-03', TODAY]);
    expect(planBudgeting(bill('2026-10-03'), ctx()).canBudget).toBe(false);
  });
  it('"keep the bill date" resolves it', () => {
    const plan = planBudgeting(bill('2026-10-03'), ctx(), { acknowledged: ['DATE_NOT_TODAY'] });
    expect(plan).toMatchObject({ canBudget: true, date: '2026-10-03' });
  });
  it('choosing another day resolves it and files under that day', () => {
    const plan = planBudgeting(bill('2026-10-03'), ctx(), { date: TODAY });
    expect(plan).toMatchObject({ canBudget: true, date: TODAY });
    expect(codes(plan.issues)).not.toContain('DATE_NOT_TODAY');
  });
  it('"don\'t ask again this session" downgrades to a note', () => {
    const issues = analyzeReceipt(bill('2026-10-03'), ctx({ allowOlderDates: true }));
    expect(find(issues, 'DATE_NOT_TODAY')).toMatchObject({ severity: 'info', resolved: true });
  });
  it('catching up after the trip is expected', () => {
    const t = makeTrip({ startDate: '2026-09-20', endDate: '2026-09-25' });
    const issues = analyzeReceipt(bill('2026-09-22'), ctx({ trip: t, trips: [t] }));
    expect(find(issues, 'DATE_NOT_TODAY')).toMatchObject({ severity: 'info' });
    expect(blockingIssues(issues)).toEqual([]);
  });
  it('the staleDays threshold is configurable', () => {
    const issues = analyzeReceipt(bill('2026-10-03'), ctx({ staleDays: 3 }));
    expect(find(issues, 'DATE_NOT_TODAY')).toMatchObject({ severity: 'info' });
  });
});

describe('a bill from the future', () => {
  it('blocks, and offers today', () => {
    const issues = analyzeReceipt(bill('2026-10-07'), ctx());
    const issue = find(issues, 'DATE_FUTURE')!;
    expect(issue).toMatchObject({ severity: 'decision', acknowledgeable: false });
    expect(issue.dateChoices![0]).toMatchObject({ date: TODAY });
  });
  it('is resolved by choosing a real day', () => {
    expect(planBudgeting(bill('2026-10-07'), ctx(), { date: TODAY }).canBudget).toBe(true);
  });
  it('is not resolved by acknowledging', () => {
    expect(
      planBudgeting(bill('2026-10-07'), ctx(), { acknowledged: ['DATE_FUTURE'] }).canBudget,
    ).toBe(false);
  });
});

describe('a bill from outside the trip', () => {
  const august = () => bill('2026-08-10');
  it('blocks and offers the nearest trip day', () => {
    const issue = find(analyzeReceipt(august(), ctx()), 'DATE_OUTSIDE_TRIP')!;
    expect(issue).toMatchObject({ severity: 'decision', acknowledgeable: false });
    expect(issue.title).toContain('outside Autumn city break');
    expect(issue.dateChoices).toEqual([
      { date: '2026-10-01', label: expect.stringContaining('Nearest trip day') },
    ]);
  });
  it('suggests another trip that contains the date', () => {
    const issue = find(analyzeReceipt(august(), ctx()), 'DATE_OUTSIDE_TRIP')!;
    expect(issue.tripChoices).toEqual([
      { tripId: 't0', label: expect.stringContaining('Summer coast') },
    ]);
  });
  it('can be moved to that trip', () => {
    const plan = planBudgeting(august(), ctx(), { tripId: 't0' });
    expect(plan).toMatchObject({ canBudget: true, tripId: 't0', date: '2026-08-10' });
  });
  it('can be kept as a digital copy without a trip', () => {
    const plan = planBudgeting(august(), ctx(), { tripId: null });
    expect(codes(plan.issues)).not.toContain('DATE_OUTSIDE_TRIP');
    expect(codes(plan.issues)).not.toContain('NO_TRIP');
    expect(plan.canBudget).toBe(false);
  });
  it('a hand-picked day outside the trip still blocks', () => {
    expect(codes(analyzeReceipt(august(), ctx(), { date: '2026-09-28' }))).toContain(
      'DATE_OUTSIDE_TRIP',
    );
  });
  it('after the trip is also outside', () => {
    expect(codes(analyzeReceipt(bill('2026-10-08'), ctx({ today: '2026-10-09' })))).toContain(
      'DATE_OUTSIDE_TRIP',
    );
  });
});

describe('missing or unclear dates', () => {
  it('no date → pick a day', () => {
    const data = parseReceipt(ocrFromText('KIOSK\nSKUPAJ 3,00 EUR'));
    const issue = find(analyzeReceipt(data, ctx()), 'NO_DATE')!;
    expect(issue.severity).toBe('decision');
    expect(issue.dateChoices!.map((c) => c.date)).toEqual([TODAY, '2026-10-05']);
    expect(planBudgeting(data, ctx(), { date: TODAY }).canBudget).toBe(true);
  });
  it('ambiguous date → asks, offers both readings, accepts either', () => {
    const data = parseReceipt(ocrFromText('Fecha 04/10/2026\nBAR X\nTOTAL 3,00 EUR'));
    expect(data.dateAmbiguous).toBe(true);
    const issue = find(analyzeReceipt(data, ctx()), 'DATE_AMBIGUOUS')!;
    expect(issue.dateChoices!.map((c) => c.date)).toEqual(['2026-10-04', '2026-04-10']);
    expect(planBudgeting(data, ctx(), { acknowledged: ['DATE_AMBIGUOUS'] }).date).toBe(
      '2026-10-04',
    );
    expect(planBudgeting(data, ctx(), { date: '2026-10-04' }).canBudget).toBe(true);
  });
  it('a second printed date is only a note', () => {
    const data = parseReceipt(
      ocrFromText('CAFE\nDatum 06.10.2026 12:00\nBestellt 04.10.2026\nSKUPAJ 3,00 EUR'),
    );
    const issue = find(analyzeReceipt(data, ctx()), 'MULTIPLE_DATES')!;
    expect(issue).toMatchObject({ severity: 'info', resolved: true });
    expect(blockingIssues(analyzeReceipt(data, ctx()))).toEqual([]);
  });
});

describe('totals and trips', () => {
  it('no total → type it in', () => {
    const data = parseReceipt(ocrFromText('CAFE\nDatum 06.10.2026'));
    expect(codes(analyzeReceipt(data, ctx()))).toContain('NO_TOTAL');
    const plan = planBudgeting(data, ctx(), { total: 450 });
    expect(plan).toMatchObject({ canBudget: true, amount: 450 });
  });
  it('no trip at all', () => {
    const plan = planBudgeting(bill(TODAY), ctx({ trip: null, trips: [] }));
    expect(codes(plan.issues)).toContain('NO_TRIP');
    expect(plan.canBudget).toBe(false);
  });
  it('chosenTrip honours explicit choices', () => {
    expect(chosenTrip(ctx())).toBe(trip);
    expect(chosenTrip(ctx(), { tripId: 't0' })).toBe(other);
    expect(chosenTrip(ctx(), { tripId: null })).toBeNull();
    expect(chosenTrip(ctx(), { tripId: 'nope' })).toBeNull();
  });
});

describe('currency', () => {
  const usd = () => parseReceipt(ocrFromText('DINER\nDate 2026-10-06\nTotal $27.55'));
  it('a bill in another currency needs the trip-currency amount', () => {
    const issue = find(analyzeReceipt(usd(), ctx()), 'CURRENCY_MISMATCH')!;
    expect(issue).toMatchObject({ severity: 'decision', resolved: false, acknowledgeable: false });
    expect(planBudgeting(usd(), ctx()).canBudget).toBe(false);
  });
  it('is resolved by entering what was paid in the trip currency', () => {
    const plan = planBudgeting(usd(), ctx(), { amountInTripCurrency: 2500 });
    expect(plan).toMatchObject({ canBudget: true, amount: 2500 });
  });
  it('is irrelevant when the bill is only kept as a copy', () => {
    expect(codes(analyzeReceipt(usd(), ctx(), { tripId: null }))).not.toContain(
      'CURRENCY_MISMATCH',
    );
  });
  it('a bill with no printed currency is assumed to be in the trip currency', () => {
    const data = parseReceipt(ocrFromText('KIOSK\nDatum 06.10.2026\nSKUPAJ 12,00'), {
      tripCurrency: 'EUR',
    });
    expect(codes(analyzeReceipt(data, ctx()))).not.toContain('CURRENCY_MISMATCH');
  });
});

describe('duplicates', () => {
  const first = () => stored(bill(TODAY));
  it('the same shop, day and total is flagged and can be acknowledged', () => {
    const c = ctx({ receipts: [first()] });
    expect(find(analyzeReceipt(bill(TODAY), c), 'DUPLICATE')).toMatchObject({
      severity: 'decision',
      acknowledgeable: true,
    });
    expect(planBudgeting(bill(TODAY), c).canBudget).toBe(false);
    expect(planBudgeting(bill(TODAY), c, { acknowledged: ['DUPLICATE'] }).canBudget).toBe(true);
  });
  it('a different total or day is not a duplicate', () => {
    const c = ctx({ receipts: [first()] });
    expect(codes(analyzeReceipt(bill(TODAY, 1300), c))).not.toContain('DUPLICATE');
    expect(codes(analyzeReceipt(bill('2026-10-05'), c))).not.toContain('DUPLICATE');
  });
  it('legal-form noise does not hide a duplicate', () => {
    const c = ctx({ receipts: [stored(bill(TODAY, 1250, 'CAFE CENTRAL d.o.o.'))] });
    expect(codes(analyzeReceipt(bill(TODAY), c))).toContain('DUPLICATE');
  });
  it('different receipt numbers on both are two purchases', () => {
    const a = { ...bill(TODAY), receiptNumber: '0001' };
    const b = { ...bill(TODAY), receiptNumber: '0002' };
    expect(codes(analyzeReceipt(b, ctx({ receipts: [stored(a)] })))).not.toContain('DUPLICATE');
    expect(
      codes(analyzeReceipt({ ...b, receiptNumber: '0001' }, ctx({ receipts: [stored(a)] }))),
    ).toContain('DUPLICATE');
  });
  it('a receipt never duplicates itself', () => {
    expect(
      codes(analyzeReceipt(bill(TODAY), ctx({ receipts: [first()], selfId: 'r-old' }))),
    ).not.toContain('DUPLICATE');
  });
  it('uses the filing day, not just the printed one', () => {
    const old = stored(bill('2026-10-03'), { date: '2026-10-04' });
    expect(codes(analyzeReceipt(bill('2026-10-04'), ctx({ receipts: [old] })))).toContain(
      'DUPLICATE',
    );
  });
});

describe('reading quality', () => {
  it('low confidence asks for a glance', () => {
    const data: ReceiptData = { ...bill(TODAY), confidence: 0.4 };
    expect(find(analyzeReceipt(data, ctx()), 'LOW_CONFIDENCE')).toMatchObject({
      severity: 'decision',
      acknowledgeable: true,
    });
    expect(planBudgeting(data, ctx(), { acknowledged: ['LOW_CONFIDENCE'] }).canBudget).toBe(true);
  });
  it('manually entered data is trusted', () => {
    const data: ReceiptData = { ...bill(TODAY), confidence: 0.4, source: 'manual' };
    expect(codes(analyzeReceipt(data, ctx()))).not.toContain('LOW_CONFIDENCE');
  });
  it('does not pile LOW_CONFIDENCE on top of a missing total or date', () => {
    const data = parseReceipt(ocrFromText('???'));
    expect(codes(analyzeReceipt(data, ctx()))).not.toContain('LOW_CONFIDENCE');
  });
  it('warnings never block', () => {
    const data: ReceiptData = {
      ...bill(TODAY),
      merchant: undefined,
      items: [{ description: 'Kosilo', amount: 1000 }],
    };
    const plan = planBudgeting(data, ctx());
    expect(codes(plan.issues)).toEqual(expect.arrayContaining(['NO_MERCHANT', 'ITEMS_MISMATCH']));
    expect(plan.canBudget).toBe(true);
  });
  it('orders decisions before warnings before notes', () => {
    const data: ReceiptData = { ...bill('2026-10-03'), merchant: undefined };
    const sev = analyzeReceipt(data, ctx()).map((i) => i.severity);
    expect(sev).toEqual(
      [...sev].sort(
        (a, b) =>
          ['decision', 'warning', 'info'].indexOf(a) - ['decision', 'warning', 'info'].indexOf(b),
      ),
    );
  });
});

describe('aiCouldHelp', () => {
  it("is about reading problems, not about the user's intent", () => {
    expect(aiCouldHelp(analyzeReceipt(parseReceipt(ocrFromText('CAFE\nKava 2,50')), ctx()))).toBe(
      true,
    );
    expect(aiCouldHelp(analyzeReceipt(bill('2026-10-03'), ctx()))).toBe(false);
    expect(aiCouldHelp(analyzeReceipt(bill('2026-08-10'), ctx()))).toBe(false);
    expect(aiCouldHelp(analyzeReceipt(bill(TODAY), ctx({ receipts: [stored(bill(TODAY))] })))).toBe(
      false,
    );
    expect(aiCouldHelp(analyzeReceipt(bill(TODAY), ctx()))).toBe(false);
  });
  it('stops offering once the user resolved the reading problem', () => {
    const data = parseReceipt(ocrFromText('CAFE\nDatum 06.10.2026'));
    expect(aiCouldHelp(analyzeReceipt(data, ctx(), { total: 300 }))).toBe(false);
  });
});
