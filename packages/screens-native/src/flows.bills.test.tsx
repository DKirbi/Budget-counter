/**
 * Bill-scanning user flows (F11–F15), driven through the real screens, real store, real parser and
 * real odd-bill checks. Only the device is replaced: OCR text comes from a fake engine, photos from a
 * fake picker, and the AI service from a fake `fetch`. Mirrored 1:1 by `flows.bills.stories.tsx`;
 * see docs/TESTING.md for the matrix.
 */
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import {
  AI_KEY_NAME,
  type BudgetStore,
  merchantKey,
  ocrFromText,
  parseReceipt,
  selectInbox,
} from '@tbc/core';
import {
  DEMO_TODAY,
  type FakeScanOptions,
  createFakeScanServices,
  createTestStore,
  makeTrip,
  simpleBillText,
} from '@tbc/core/testing';
import * as React from 'react';
import { MiniApp } from './MiniApp';
import { renderWithStore } from './testing';

const press = (id: string) =>
  act(async () => {
    await fireEvent.press(screen.getByTestId(id));
    await Promise.resolve();
    await Promise.resolve();
  });
const type = (id: string, text: string) => fireEvent.changeText(screen.getByTestId(id), text);
const has = (id: string) => screen.queryByTestId(id) !== null;
const label = (id: string) => screen.getByTestId(id).props.accessibilityLabel as string;

const lisbon = makeTrip(); // 1–7 May, €700, today in the tests is 3 May
const porto = makeTrip({
  id: 'trip-porto',
  name: 'Porto',
  startDate: '2026-04-20',
  endDate: '2026-04-25',
});

/** Render the Bills tab with fake devices. */
async function setup(
  scan: FakeScanOptions = {},
  options: { today?: string; trips?: ReturnType<typeof makeTrip>[]; store?: BudgetStore } = {},
) {
  const services = createFakeScanServices(scan);
  const store =
    options.store ??
    createTestStore({
      initial: { trips: options.trips ?? [lisbon], activeTripId: 'trip-1' },
    });
  const view = await renderWithStore(<MiniApp initialTab="bills" />, {
    store,
    services,
    today: options.today ?? DEMO_TODAY,
  });
  return { ...view, store, services };
}

/** Scan photos from the library and wait until the batch is done. */
async function scanFromLibrary() {
  await press('scan-bills');
  await press('scan-library');
  await waitFor(() => expect(has('scan-summary')).toBe(true));
}

const summary = () => screen.getByTestId('scan-summary');

describe('F11 · Evening scan: clean bills file themselves', () => {
  const photos = {
    'image://a': simpleBillText('2026-05-03', 1250, 'CAFE CENTRAL'),
    'image://b': simpleBillText('2026-05-02', 800, 'PEKARNA'),
    'image://c': simpleBillText('2026-04-28', 3000, 'TAXI LJUBLJANA'), // before the trip started
  };

  it('reads a batch from the library, files what is clean and says what is left', async () => {
    const { store, services } = await setup({ ocrByUri: photos, picks: Object.keys(photos) });
    expect(screen.getByTestId('timeline-empty')).toBeOnTheScreen();

    await scanFromLibrary();
    expect(summary()).toHaveTextContent(/2 filed · €20\.50 added · 1 needs you/);
    expect(services.calls.recognized).toEqual(Object.keys(photos));

    const s = store.getState();
    expect(s.receipts.map((r) => r.status)).toEqual(['budgeted', 'budgeted', 'needs-attention']);
    expect(s.spends.map((x) => [x.date, x.amount, x.receiptId !== undefined])).toEqual([
      ['2026-05-03', 1250, true],
      ['2026-05-02', 800, true],
    ]);
    expect(label('scan-result-1')).toContain('Filed');
    expect(label('scan-result-3')).toContain('Needs you');
    expect(label('scan-result-3')).toContain('outside Lisbon long weekend');

    // Back on the Bills tab the timeline is built from the printed dates, newest day first.
    await press('scan-done');
    expect(screen.getAllByTestId(/^timeline-day-/).map((n) => n.props.testID)).toEqual([
      'timeline-day-2026-05-03',
      'timeline-day-2026-05-02',
    ]);
    expect(screen.getByTestId('inbox')).toHaveTextContent(/Needs you · 1/);
  });

  it('keeps every photo with the bill, so nothing is lost if the app closes', async () => {
    const { store } = await setup({ ocrByUri: photos, picks: Object.keys(photos) });
    await scanFromLibrary();
    expect(store.getState().receipts.map((r) => r.imageUri)).toEqual(Object.keys(photos));
    expect(store.getState().receipts[2]?.rawText).toContain('TAXI LJUBLJANA');
  });

  it('takes photos one at a time with the camera and the list keeps growing', async () => {
    const { store } = await setup({ ocrByUri: photos, captures: ['image://a', 'image://b'] });
    await press('scan-bills');
    await press('scan-camera');
    await waitFor(() => expect(has('scan-summary')).toBe(true));
    expect(screen.getByText('Scan another bill')).toBeOnTheScreen();
    await press('scan-camera');
    await waitFor(() => expect(screen.getAllByTestId(/^scan-result-/)).toHaveLength(2));
    await waitFor(() => expect(summary()).toHaveTextContent(/All 2 filed · €20\.50 added/));
    expect(store.getState().spends).toHaveLength(2);
  });

  it('says so when the camera is closed without a photo', async () => {
    await setup({ captures: [null] });
    await press('scan-bills');
    await press('scan-camera');
    await waitFor(() =>
      expect(screen.getByTestId('scan-notice')).toHaveTextContent('No photo taken.'),
    );
    expect(has('scan-results')).toBe(false);
  });

  it('asks about every bill when automatic filing is switched off', async () => {
    const { store } = await setup({ ocrByUri: photos, picks: ['image://a'] });
    store.getState().actions.setAutoConfirmReceipts(false);
    await scanFromLibrary();
    expect(summary()).toHaveTextContent(/0 filed · 1 needs you/);
    expect(store.getState().spends).toEqual([]);
    // One tap in the review screen counts it.
    await press('scan-result-1');
    await press('review-count');
    expect(store.getState().spends.map((x) => x.amount)).toEqual([1250]);
  });

  it('saves photos for AI or hand entry when this build cannot read text', async () => {
    const { store, services } = await setup({ ocrSupported: false, picks: ['image://a'] });
    await press('scan-bills');
    expect(screen.getByTestId('scan-no-ocr')).toBeOnTheScreen();
    await press('scan-library');
    await waitFor(() => expect(has('scan-summary')).toBe(true));
    expect(services.calls.recognized).toEqual([]);
    expect(label('scan-result-1')).toContain('Saved — fill it in or use AI');
    expect(selectInbox(store.getState().receipts)).toHaveLength(1);
  });

  it('needs a trip first', async () => {
    await renderWithStore(<MiniApp initialTab="bills" />, { services: createFakeScanServices() });
    expect(screen.getByTestId('bills-no-trip')).toBeOnTheScreen();
    await press('bills-create-trip');
    expect(screen.getByTestId('screen-create-trip')).toBeOnTheScreen();
  });
});

describe('F12 · An odd date asks, and the answer decides the day', () => {
  const FOUR_DAYS_AGO = simpleBillText('2026-05-02', 1250, 'CAFE CENTRAL');
  const week = { today: '2026-05-06' }; // the bill is 4 days older than "today"

  it('a bill from days ago: keep the printed day', async () => {
    const { store } = await setup(
      { ocrByUri: { 'image://a': FOUR_DAYS_AGO }, picks: ['image://a'] },
      week,
    );
    await scanFromLibrary();
    expect(summary()).toHaveTextContent(/0 filed · 1 needs you/);
    expect(store.getState().spends).toEqual([]);

    await press('scan-result-1');
    expect(screen.getByTestId('issue-DATE_NOT_TODAY').props.role).toBe('alert');
    expect(screen.getByTestId('issue-DATE_NOT_TODAY')).toHaveTextContent(/From 4 days ago/);
    expect(screen.getByTestId('review-count')).toBeDisabled();
    expect(screen.getByTestId('review-blocked-hint')).toHaveTextContent(/1 thing needs an answer/);

    await press('issue-DATE_NOT_TODAY-date-2026-05-02');
    expect(screen.getByTestId('review-count')).toBeEnabled();
    expect(screen.getByText('Count €12.50')).toBeOnTheScreen();
    await press('review-count');

    const [spend] = store.getState().spends;
    expect(spend).toMatchObject({ date: '2026-05-02', amount: 1250, tripId: 'trip-1' });
    expect(store.getState().receipts[0]).toMatchObject({ status: 'budgeted', date: '2026-05-02' });
    // Back on the scan list the row now reads "Filed".
    expect(label('scan-result-1')).toContain('Filed');
  });

  it('a bill from days ago: file it under today instead', async () => {
    const { store } = await setup(
      { ocrByUri: { 'image://a': FOUR_DAYS_AGO }, picks: ['image://a'] },
      week,
    );
    await scanFromLibrary();
    await press('scan-result-1');
    await press('issue-DATE_NOT_TODAY-date-2026-05-06');
    await press('review-count');
    expect(store.getState().spends[0]).toMatchObject({ date: '2026-05-06', amount: 1250 });
  });

  it('a bill the user can still re-date with the day stepper', async () => {
    const { store } = await setup(
      { ocrByUri: { 'image://a': FOUR_DAYS_AGO }, picks: ['image://a'] },
      week,
    );
    await scanFromLibrary();
    await press('scan-result-1');
    await press('issue-DATE_NOT_TODAY-date-2026-05-02');
    await press('review-day-increase');
    await press('review-count');
    expect(store.getState().spends[0]?.date).toBe('2026-05-03');
  });

  it('a possible duplicate is held back until the user says it is a different purchase', async () => {
    const same = simpleBillText('2026-05-03', 1250, 'CAFE CENTRAL');
    const { store } = await setup({
      ocrByUri: { 'image://a': same, 'image://b': same },
      picks: ['image://a', 'image://b'],
    });
    await scanFromLibrary();
    expect(summary()).toHaveTextContent(/1 filed · €12\.50 added · 1 needs you/);
    expect(label('scan-result-2')).toContain('Looks like a bill you already scanned');

    await press('scan-result-2');
    expect(screen.getByTestId('review-count')).toBeDisabled();
    expect(screen.getByText('Count it anyway')).toBeOnTheScreen();
    await press('issue-DUPLICATE-ack');
    await press('review-count');
    expect(store.getState().spends.map((s) => s.amount)).toEqual([1250, 1250]);
  });

  it('a bill with no date at all offers today or yesterday', async () => {
    const undated = ['CAFE NOVA', 'Kava\t5,00', 'SKUPAJ\t5,00 EUR'].join('\n');
    const { store } = await setup({ ocrByUri: { 'image://a': undated }, picks: ['image://a'] });
    await scanFromLibrary();
    await press('scan-result-1');
    expect(screen.getByTestId('issue-NO_DATE')).toHaveTextContent(/No date found/);
    await press('issue-NO_DATE-date-2026-05-02'); // yesterday
    await press('review-count');
    expect(store.getState().spends[0]).toMatchObject({ date: '2026-05-02', amount: 500 });
  });

  it('a bill dated in the future cannot be counted until the day is fixed', async () => {
    const future = simpleBillText('2026-05-09', 700, 'KIOSK');
    const { store } = await setup({ ocrByUri: { 'image://a': future }, picks: ['image://a'] });
    await scanFromLibrary();
    await press('scan-result-1');
    expect(screen.getByTestId('issue-DATE_FUTURE')).toBeOnTheScreen();
    expect(screen.getByTestId('review-count')).toBeDisabled();
    await press('issue-DATE_FUTURE-date-2026-05-03');
    await press('review-count');
    expect(store.getState().spends[0]?.date).toBe('2026-05-03');
  });
});

describe('F13 · Outside the trip: move it, re-date it, or keep a copy', () => {
  const march = simpleBillText('2026-03-01', 2100, 'MUSEUM SHOP');
  const aprilInPorto = simpleBillText('2026-04-22', 4500, 'TASCA DO ZE');

  it('offers the other trip whose dates contain the bill, and counts it there', async () => {
    const { store } = await setup(
      { ocrByUri: { 'image://a': aprilInPorto }, picks: ['image://a'] },
      { trips: [lisbon, porto] },
    );
    await scanFromLibrary();
    await press('scan-result-1');
    expect(screen.getByTestId('issue-DATE_OUTSIDE_TRIP')).toHaveTextContent(
      /outside Lisbon long weekend/,
    );
    await press('issue-DATE_OUTSIDE_TRIP-trip-trip-porto');
    await press('review-count');
    expect(store.getState().spends[0]).toMatchObject({
      tripId: 'trip-porto',
      date: '2026-04-22',
      amount: 4500,
    });
    expect(store.getState().activeTripId).toBe('trip-1'); // the active trip is untouched
  });

  it('can pull a stray date to the nearest trip day', async () => {
    const { store } = await setup({ ocrByUri: { 'image://a': march }, picks: ['image://a'] });
    await scanFromLibrary();
    await press('scan-result-1');
    await press('issue-DATE_OUTSIDE_TRIP-date-2026-05-01');
    await press('review-count');
    expect(store.getState().spends[0]).toMatchObject({ date: '2026-05-01', tripId: 'trip-1' });
  });

  it('keeps a digital copy that is not counted anywhere', async () => {
    const { store } = await setup({ ocrByUri: { 'image://a': march }, picks: ['image://a'] });
    await scanFromLibrary();
    await press('scan-result-1');
    await press('issue-DATE_OUTSIDE_TRIP-keep');
    expect(store.getState().spends).toEqual([]);
    expect(store.getState().receipts[0]).toMatchObject({
      status: 'archived',
      imageUri: 'image://a',
    });
    expect(label('scan-result-1')).toContain('Kept as a copy');

    await press('scan-done');
    expect(screen.getByTestId('archive')).toHaveTextContent(/Kept as copies · 1/);
    expect(has('inbox')).toBe(false);
  });
});

describe('F14 · An unreadable bill: fill it in offline, or let AI finish it', () => {
  const blur = '~~ blur ~~';
  const KEY = 'AIza-test-KEY';
  const gemini = (obj: unknown) => ({
    candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }],
  });
  const aiBill = {
    merchant: 'Cafe Nova',
    date: '2026-05-03',
    currency: 'EUR',
    total: 18.5,
    items: [{ description: 'Kosilo', amount: 18.5 }],
  };
  const blurred = (extra: FakeScanOptions = {}): FakeScanOptions => ({
    ocrByUri: { 'image://a': blur },
    picks: ['image://a'],
    ...extra,
  });
  /** Gemini on, key saved: the user has opted in to the AI helper. */
  const withAi = (store: BudgetStore) =>
    store.getState().actions.setAiSettings({ provider: 'gemini' });

  it('offline: the user types what is missing, nothing leaves the device', async () => {
    const { store, services } = await setup(blurred());
    await scanFromLibrary();
    expect(summary()).toHaveTextContent(/0 filed · 1 needs you/);

    await press('scan-result-1');
    expect(screen.getByTestId('review-ai-card')).toHaveTextContent(
      /turn on AI reading in Settings/,
    );
    expect(has('review-ai')).toBe(false); // AI is off: only the manual path is offered
    expect(screen.getByTestId('review-count')).toBeDisabled();

    type('review-merchant', 'Kiosk Zoran');
    type('review-total', '23.40');
    await press('issue-NO_DATE-date-2026-05-03');
    await press('review-count');

    expect(store.getState().spends[0]).toMatchObject({
      amount: 2340,
      date: '2026-05-03',
      note: 'Kiosk Zoran',
    });
    expect(services.calls.fetches).toEqual([]);
  });

  it('"I\'ll fill it in" dismisses the AI offer', async () => {
    const { store } = await setup(blurred());
    withAi(store);
    await scanFromLibrary();
    await press('scan-result-1');
    expect(has('review-ai')).toBe(true);
    await press('review-by-hand');
    expect(has('review-ai-card')).toBe(false);
  });

  it('types a bill in from scratch, with no photo', async () => {
    const { store } = await setup();
    await press('scan-bills');
    await press('scan-manual');
    expect(screen.getByTestId('screen-receipt')).toBeOnTheScreen();
    expect(screen.getByText('Typed in')).toBeOnTheScreen();
    expect(has('review-ai-card')).toBe(false); // there is no photo to send
    expect(screen.getByTestId('receipt-photo')).toHaveTextContent('Entered by hand — no photo.');
    type('review-total', '9.90');
    await press('issue-NO_DATE-date-2026-05-03');
    await press('tag-food');
    await press('review-count');
    expect(store.getState().spends[0]).toMatchObject({ amount: 990, tag: 'food' });
    expect(store.getState().receipts[0]?.data.source).toBe('manual');
  });

  it('asks before sending anything; the answer fills the form; the user still confirms the count', async () => {
    const { store, services } = await setup(
      blurred({ secrets: { [AI_KEY_NAME]: KEY }, aiResponse: { body: gemini(aiBill) } }),
    );
    withAi(store);
    await scanFromLibrary();
    await press('scan-result-1');
    expect(screen.getByTestId('review-ai-card')).toHaveTextContent(/20 of 20 AI reads left today/);

    await press('review-ai');
    expect(screen.getByTestId('confirm-ai')).toHaveTextContent(
      /Send this photo to Google Gemini\?/,
    );
    expect(services.calls.fetches).toEqual([]); // nothing sent yet

    await press('confirm-ai-confirm');
    await waitFor(() => expect(has('review-ai-done')).toBe(true));
    expect(services.calls.fetches).toHaveLength(1);
    expect(services.calls.fetches[0]?.headers['x-goog-api-key']).toBe(KEY);
    expect(services.calls.encoded).toEqual(['image://a']);
    expect(screen.getByTestId('review-total').props.value).toBe('18.50');
    expect(screen.getByTestId('review-merchant').props.value).toBe('Cafe Nova');
    expect(screen.getByText('Read by AI')).toBeOnTheScreen();
    expect(store.getState().settings.aiUsage).toEqual({ date: '2026-05-03', count: 1 });
    expect(store.getState().spends).toEqual([]); // reading is not counting

    await press('review-count');
    expect(store.getState().spends[0]).toMatchObject({ amount: 1850, date: '2026-05-03' });
    expect(store.getState().receipts[0]?.data.source).toBe('ai');
  });

  it('cancelling the confirmation sends nothing and uses no quota', async () => {
    const { store, services } = await setup(blurred({ secrets: { [AI_KEY_NAME]: KEY } }));
    withAi(store);
    await scanFromLibrary();
    await press('scan-result-1');
    await press('review-ai');
    await press('confirm-ai-cancel');
    expect(services.calls.fetches).toEqual([]);
    expect(store.getState().settings.aiUsage.count).toBe(0);
    expect(has('review-ai')).toBe(true);
  });

  it.each([
    [429, 'Free AI quota used up', { 'retry-after': '120' }],
    [401, 'The API key was rejected', {}],
    [404, 'That AI model is not available', {}],
  ])('a %s answer is explained and leaves the bill as it was', async (status, title, headers) => {
    const { store } = await setup(
      blurred({
        secrets: { [AI_KEY_NAME]: KEY },
        aiResponse: { status, body: { error: { message: 'nope' } }, headers },
      }),
    );
    withAi(store);
    await scanFromLibrary();
    await press('scan-result-1');
    await press('review-ai');
    await press('confirm-ai-confirm');
    await waitFor(() => expect(has('review-ai-error')).toBe(true));
    expect(screen.getByTestId('review-ai-error')).toHaveTextContent(new RegExp(title));
    expect(store.getState().settings.aiUsage.count).toBe(0); // a failed call is not counted
    expect(store.getState().receipts[0]?.data.total).toBeUndefined();
    // …and filling it in by hand still works.
    type('review-total', '5');
    await press('issue-NO_DATE-date-2026-05-03');
    await press('review-count');
    expect(store.getState().spends[0]?.amount).toBe(500);
  });

  it('a rate-limit answer tells how long to wait', async () => {
    const { store } = await setup(
      blurred({
        secrets: { [AI_KEY_NAME]: KEY },
        aiResponse: { status: 429, body: {}, headers: { 'retry-after': '120' } },
      }),
    );
    withAi(store);
    await scanFromLibrary();
    await press('scan-result-1');
    await press('review-ai');
    await press('confirm-ai-confirm');
    await waitFor(() => expect(has('review-ai-error')).toBe(true));
    expect(screen.getByTestId('review-ai-error')).toHaveTextContent(/about 2 min/);
  });

  it('without a saved key it says so instead of calling the service', async () => {
    const { store, services } = await setup(blurred());
    withAi(store);
    await scanFromLibrary();
    await press('scan-result-1');
    await press('review-ai');
    await press('confirm-ai-confirm');
    await waitFor(() => expect(has('review-ai-error')).toBe(true));
    expect(screen.getByTestId('review-ai-error')).toHaveTextContent(/Add your API key first/);
    expect(services.calls.fetches).toEqual([]);
  });

  it('stops offering AI once the local daily limit is used', async () => {
    const { store } = await setup(blurred({ secrets: { [AI_KEY_NAME]: KEY } }));
    withAi(store);
    store.getState().actions.setAiSettings({ dailyLimit: 1 });
    store.getState().actions.recordAiUse(DEMO_TODAY);
    await scanFromLibrary();
    await press('scan-result-1');
    expect(screen.getByTestId('review-ai')).toBeDisabled();
    expect(screen.getByTestId('review-ai-card')).toHaveTextContent(/0 of 1 AI reads left today/);
  });
});

describe('F15 · The Bills tab: timeline, inbox, copies; and Bills & AI settings', () => {
  /** A store that already holds two counted days, one bill waiting and one kept copy. */
  function seeded() {
    const store = createTestStore({ initial: { trips: [lisbon], activeTripId: 'trip-1' } });
    const a = store.getState().actions;
    const bill = (date: string, total: number, shop: string) =>
      parseReceipt(ocrFromText(simpleBillText(date, total, shop)));
    const add = (
      date: string,
      total: number,
      shop: string,
      over: Partial<Parameters<typeof a.saveReceipt>[0]> = {},
    ) =>
      a.saveReceipt({
        data: bill(date, total, shop),
        rawText: 'raw',
        tripId: 'trip-1',
        date,
        tag: 'food',
        imageUri: `file:///${shop}.jpg`,
        ...over,
      });
    const counted = (date: string, total: number, shop: string) =>
      add(date, total, shop, { budget: { parts: [{ amount: total, tag: 'food' }] } });
    const lunch = counted('2026-05-03', 1250, 'CAFE CENTRAL');
    counted('2026-05-03', 4200, 'SPAR');
    counted('2026-05-02', 800, 'PEKARNA');
    add('2026-05-02', 3000, 'TAXI'); // waiting
    add('2026-05-01', 999, 'OLD SHOP', { keep: 'archive' });
    return { store, lunch };
  }

  it('shows counted days newest first, the inbox, and the kept copies', async () => {
    const { store } = seeded();
    await setup({}, { store });
    expect(screen.getAllByTestId(/^timeline-day-/).map((n) => n.props.testID)).toEqual([
      'timeline-day-2026-05-03',
      'timeline-day-2026-05-02',
    ]);
    expect(screen.getByLabelText('Sun 3 May, today, €54.50 in 2 bills')).toBeOnTheScreen();
    expect(screen.getByTestId('inbox')).toHaveTextContent(/Needs you · 1/);
    expect(screen.getByTestId('archive')).toHaveTextContent(/Kept as copies · 1/);
    expect(screen.getByText(/3 counted · 1 to check/)).toBeOnTheScreen();
  });

  it('editing a counted bill updates its spend', async () => {
    const { store, lunch } = seeded();
    await setup({}, { store });
    await press(`receipt-row-${lunch.id}`);
    expect(screen.getByTestId('review-status')).toHaveTextContent(/Counted · €12\.50/);
    type('review-total', '15.00');
    await press('review-count'); // "Save changes"
    expect(store.getState().spends.find((s) => s.receiptId === lunch.id)?.amount).toBe(1500);
    expect(screen.getByTestId('timeline-day-2026-05-03')).toHaveTextContent(/€57\.00/);
  });

  it('"Stop counting" returns the money to the day and keeps the copy', async () => {
    const { store, lunch } = seeded();
    await setup({}, { store });
    await press(`receipt-row-${lunch.id}`);
    await press('review-archive');
    expect(store.getState().spends.some((s) => s.receiptId === lunch.id)).toBe(false);
    expect(store.getState().receipts.find((r) => r.id === lunch.id)?.status).toBe('archived');
    expect(screen.getByTestId('archive')).toHaveTextContent(/Kept as copies · 2/);
  });

  it('a kept copy can be counted later', async () => {
    const { store } = seeded();
    await setup({}, { store });
    const copy = store.getState().receipts.find((r) => r.status === 'archived')!;
    await press(`receipt-row-${copy.id}`);
    expect(has('review-archive')).toBe(false);
    await press('review-count');
    expect(store.getState().receipts.find((r) => r.id === copy.id)?.status).toBe('budgeted');
    expect(store.getState().spends.find((s) => s.receiptId === copy.id)?.amount).toBe(999);
  });

  it('deleting a bill asks first, removes its spend and its photo', async () => {
    const { store, lunch } = seeded();
    const { services } = await setup({}, { store });
    await press(`receipt-row-${lunch.id}`);
    await press('review-delete');
    await press('confirm-delete-receipt-cancel');
    expect(store.getState().receipts.some((r) => r.id === lunch.id)).toBe(true);

    await press('review-delete');
    await press('confirm-delete-receipt-confirm');
    expect(store.getState().receipts.some((r) => r.id === lunch.id)).toBe(false);
    expect(store.getState().spends.some((s) => s.receiptId === lunch.id)).toBe(false);
    await waitFor(() => expect(services.calls.removed).toEqual(['file:///CAFE CENTRAL.jpg']));
  });

  it("remembers a shop's category for the next bill", async () => {
    const scan: FakeScanOptions = {
      ocrByUri: {
        'image://a': simpleBillText('2026-05-03', 1500, 'ZORAN D.O.O.'),
        'image://b': simpleBillText('2026-05-03', 2300, 'ZORAN D.O.O.'),
      },
      picks: ['image://a'],
    };
    const { store } = await setup(scan);
    await scanFromLibrary();
    await press('scan-done');
    const first = store.getState().receipts[0]!;
    await press(`receipt-row-${first.id}`);
    await press('tag-shopping');
    await press('review-remember');
    await press('review-count');
    expect(store.getState().spends[0]?.tag).toBe('shopping');
    expect(store.getState().merchantRules[merchantKey('ZORAN D.O.O.')]).toBe('shopping');

    // The next bill from the same shop is filed under the remembered category by itself.
    scan.picks = ['image://b'];
    await scanFromLibrary();
    expect(store.getState().spends.map((x) => [x.amount, x.tag])).toEqual([
      [1500, 'shopping'],
      [2300, 'shopping'],
    ]);
  });

  it('settings: picking a provider, saving a key (kept out of the app data), model and daily limit', async () => {
    const { store, services } = await setup();
    await press('tab-settings');
    expect(has('settings-ai-details')).toBe(false); // AI is off by default
    await press('settings-ai-gemini');
    expect(store.getState().settings.ai).toMatchObject({
      provider: 'gemini',
      model: 'gemini-flash-latest',
    });
    expect(screen.getByTestId('settings-ai-model').props.value).toBe('gemini-flash-latest');

    type('settings-ai-key', ' SECRET-KEY-123 ');
    await press('settings-ai-key-save');
    expect(services.secretValues[AI_KEY_NAME]).toBe('SECRET-KEY-123');
    expect(screen.getByTestId('settings-ai-key-saved')).toBeOnTheScreen();
    expect(screen.getByTestId('settings-ai-key').props.value).toBe('');
    expect(JSON.stringify(store.getState())).not.toContain('SECRET-KEY-123');

    type('settings-ai-model', 'gemini-flash-lite-latest');
    expect(store.getState().settings.ai.model).toBe('gemini-flash-lite-latest');
    await press('settings-ai-limit-increase');
    expect(store.getState().settings.ai.dailyLimit).toBe(25);
    expect(screen.getByTestId('settings-ai-usage')).toHaveTextContent(/Used today: 0 of 25/);

    await press('settings-ai-key-remove');
    expect(services.secretValues[AI_KEY_NAME]).toBeUndefined();
    expect(has('settings-ai-key-saved')).toBe(false);

    await press('settings-ai-none');
    expect(has('settings-ai-details')).toBe(false);
  });

  it('settings: the address field appears only for OpenAI-compatible services', async () => {
    const { store } = await setup();
    await press('tab-settings');
    await press('settings-ai-openai');
    expect(screen.getByTestId('settings-ai-baseurl').props.value).toBe('https://api.openai.com/v1');
    type('settings-ai-baseurl', 'https://llm.example/v1');
    expect(store.getState().settings.ai.baseUrl).toBe('https://llm.example/v1');
    await press('settings-ai-gemini');
    expect(has('settings-ai-baseurl')).toBe(false);
  });

  it('settings: automatic filing can be switched off', async () => {
    const { store } = await setup();
    await press('tab-settings');
    expect(store.getState().settings.autoConfirmReceipts).toBe(true);
    await press('settings-auto-confirm');
    expect(store.getState().settings.autoConfirmReceipts).toBe(false);
  });
});
