/**
 * Bill-scanning flows F11–F15 as living documentation, mirroring `flows.bills.test.tsx` (Jest). Every story runs the
 * real screens, parser and odd-bill checks; only the device is faked (`parameters.scan`): OCR text per photo, the
 * photo library, and the AI service's answer. Replay a flow from the Interactions panel.
 */
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { AI_KEY_NAME } from '@tbc/core';
import {
  makeReceipt,
  makeSpend,
  makeTrip,
  simpleBillText,
  type StoryLoaded,
} from '@tbc/core/testing';
import { expect, screen, userEvent, within } from 'storybook/test';
import { MiniApp } from './MiniApp';

const meta = {
  title: 'Flows/Bills',
  component: MiniApp,
  args: { initialTab: 'bills' },
  parameters: { frame: 'phone', layout: 'centered', docs: { story: { height: '820px' } } },
} satisfies Meta<typeof MiniApp>;
export default meta;
type Story = StoryObj<typeof meta>;

type Ctx = { canvasElement: HTMLElement; loaded: Record<string, unknown> };
function driver({ canvasElement, loaded }: Ctx) {
  const canvas = within(canvasElement);
  const { store, services } = loaded as unknown as StoryLoaded;
  return {
    canvas,
    store,
    services,
    id: (testId: string) => canvas.getByTestId(testId),
    has: (testId: string) => canvas.queryByTestId(testId) !== null,
    tap: (testId: string) => userEvent.click(canvas.getByTestId(testId)),
    fill: async (testId: string, text: string) => {
      const el = canvas.getByTestId(testId);
      await userEvent.clear(el);
      await userEvent.type(el, text);
    },
    /** Wait until a scan batch has finished. */
    batchDone: () => canvas.findByTestId('scan-summary'),
  };
}

const lisbon = makeTrip(); // 1–7 May, €700; "today" in stories is 3 May
const porto = makeTrip({
  id: 'trip-porto',
  name: 'Porto',
  startDate: '2026-04-20',
  endDate: '2026-04-25',
});
const withTrip = { trips: [lisbon], activeTripId: lisbon.id };

export const F11_EveningScan: Story = {
  name: 'F11 · Evening scan: clean bills file themselves',
  parameters: {
    budget: { initial: withTrip },
    scan: {
      ocrByUri: {
        'image://a': simpleBillText('2026-05-03', 1250, 'CAFE CENTRAL'),
        'image://b': simpleBillText('2026-05-02', 800, 'PEKARNA'),
        'image://c': simpleBillText('2026-04-28', 3000, 'TAXI LJUBLJANA'),
      },
      picks: ['image://a', 'image://b', 'image://c'],
    },
  },
  play: async (ctx) => {
    const { canvas, store, id, tap, batchDone } = driver(ctx);
    await ctx.step('An empty timeline explains the ritual', async () => {
      await expect(id('timeline-empty')).toBeVisible();
    });
    await ctx.step("Choose the evening's photos; each one is read on the device", async () => {
      await tap('scan-bills');
      await tap('scan-library');
      await expect(await batchDone()).toHaveTextContent(/2 filed · €20\.50 added · 1 needs you/);
    });
    await ctx.step(
      'Clean bills are counted under the day printed on them; the odd one waits',
      async () => {
        await expect(store.getState().spends.map((s) => [s.date, s.amount])).toEqual([
          ['2026-05-03', 1250],
          ['2026-05-02', 800],
        ]);
        await expect(store.getState().receipts[2]!.status).toBe('needs-attention');
      },
    );
    await ctx.step('Done: the Bills tab shows the timeline and the inbox', async () => {
      await tap('scan-done');
      await expect(canvas.getByTestId('timeline-day-2026-05-03')).toBeVisible();
      await expect(canvas.getByTestId('timeline-day-2026-05-02')).toBeVisible();
      await expect(id('inbox')).toHaveTextContent(/Needs you · 1/);
    });
  },
};

export const F12_OddDate: Story = {
  name: 'F12 · An odd date asks, and the answer decides the day',
  parameters: {
    budget: { initial: withTrip, today: '2026-05-06' },
    scan: {
      ocrByUri: { 'image://a': simpleBillText('2026-05-02', 1250, 'CAFE CENTRAL') },
      picks: ['image://a'],
    },
  },
  play: async (ctx) => {
    const { store, id, tap, batchDone } = driver(ctx);
    await ctx.step('A bill four days older than today is held back', async () => {
      await tap('scan-bills');
      await tap('scan-library');
      await expect(await batchDone()).toHaveTextContent(/0 filed · 1 needs you/);
      await expect(store.getState().spends).toHaveLength(0);
    });
    await ctx.step('The review screen asks which day it belongs to', async () => {
      await tap('scan-result-1');
      await expect(id('issue-DATE_NOT_TODAY')).toHaveTextContent(/From 4 days ago/);
      await expect(id('review-count')).toHaveAttribute('aria-disabled', 'true');
    });
    await ctx.step('Keeping the printed day counts it on 2 May', async () => {
      await tap('issue-DATE_NOT_TODAY-date-2026-05-02');
      await tap('review-count');
      await expect(store.getState().spends[0]).toMatchObject({ date: '2026-05-02', amount: 1250 });
    });
  },
};

export const F13_OutsideTrip: Story = {
  name: 'F13 · Outside the trip: other trip, or a digital copy',
  parameters: {
    budget: { initial: { trips: [lisbon, porto], activeTripId: lisbon.id } },
    scan: {
      ocrByUri: {
        'image://porto': simpleBillText('2026-04-22', 4500, 'TASCA DO ZE'),
        'image://march': simpleBillText('2026-03-01', 2100, 'MUSEUM SHOP'),
      },
      picks: ['image://porto', 'image://march'],
    },
  },
  play: async (ctx) => {
    const { store, id, tap, batchDone } = driver(ctx);
    await ctx.step('Both bills are outside the active trip, so both wait', async () => {
      await tap('scan-bills');
      await tap('scan-library');
      await expect(await batchDone()).toHaveTextContent(/0 filed · 2 need you/);
    });
    await ctx.step('The April bill fits Porto: move it there', async () => {
      await tap('scan-result-1');
      await expect(id('issue-DATE_OUTSIDE_TRIP')).toBeVisible();
      await tap('issue-DATE_OUTSIDE_TRIP-trip-trip-porto');
      await tap('review-count');
      await expect(store.getState().spends[0]).toMatchObject({
        tripId: 'trip-porto',
        date: '2026-04-22',
      });
    });
    await ctx.step(
      'The March bill fits no trip: keep it as a copy that is not counted',
      async () => {
        await tap('scan-result-2');
        await tap('issue-DATE_OUTSIDE_TRIP-keep');
        await expect(store.getState().receipts[1]!.status).toBe('archived');
        await expect(store.getState().spends).toHaveLength(1);
      },
    );
  },
};

const gemini = (obj: unknown) => ({
  candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }],
});

export const F14_AiFallback: Story = {
  name: 'F14 · Unreadable bill: AI finishes it, after asking',
  parameters: {
    budget: { initial: withTrip },
    scan: {
      ocrByUri: { 'image://a': '~~ blur ~~' },
      picks: ['image://a'],
      secrets: { [AI_KEY_NAME]: 'AIza-demo-key' },
      aiResponse: {
        body: gemini({
          merchant: 'Cafe Nova',
          date: '2026-05-03',
          currency: 'EUR',
          total: 18.5,
          items: [{ description: 'Kosilo', amount: 18.5 }],
        }),
      },
    },
  },
  play: async (ctx) => {
    const { canvas, store, services, id, tap, batchDone } = driver(ctx);
    await ctx.step('The user has switched AI on in Settings (off by default)', async () => {
      store.getState().actions.setAiSettings({ provider: 'gemini' });
    });
    await ctx.step('The photo cannot be read, so it waits in the inbox', async () => {
      await tap('scan-bills');
      await tap('scan-library');
      await expect(await batchDone()).toHaveTextContent(/0 filed · 1 needs you/);
      await tap('scan-result-1');
      await expect(id('review-ai-card')).toHaveTextContent(/20 of 20 AI reads left today/);
    });
    await ctx.step('"Finish with AI" asks first, and nothing has been sent yet', async () => {
      await tap('review-ai');
      await expect(await screen.findByTestId('confirm-ai')).toHaveTextContent(
        /Send this photo to Google Gemini\?/,
      );
      await expect(services.calls.fetches).toHaveLength(0);
    });
    await ctx.step(
      "After confirming, the form is filled in; counting is still the user's call",
      async () => {
        await userEvent.click(screen.getByTestId('confirm-ai-confirm'));
        await canvas.findByTestId('review-ai-done');
        await expect(id('review-total')).toHaveValue('18.50');
        await expect(store.getState().settings.aiUsage.count).toBe(1);
        await expect(store.getState().spends).toHaveLength(0);
        await tap('review-count');
        await expect(store.getState().spends[0]).toMatchObject({
          amount: 1850,
          date: '2026-05-03',
        });
      },
    );
  },
};

export const F14b_FillItInOffline: Story = {
  name: 'F14b · Unreadable bill: fill it in yourself, stay offline',
  parameters: {
    budget: { initial: withTrip },
    scan: { ocrByUri: { 'image://a': '~~ blur ~~' }, picks: ['image://a'] },
  },
  play: async (ctx) => {
    const { store, services, id, tap, fill, batchDone } = driver(ctx);
    await ctx.step('With AI off, the review screen offers only the manual path', async () => {
      await tap('scan-bills');
      await tap('scan-library');
      await batchDone();
      await tap('scan-result-1');
      await expect(id('review-ai-card')).toHaveTextContent(/turn on AI reading in Settings/);
    });
    await ctx.step('Type the shop and total, pick the day, count it', async () => {
      await fill('review-merchant', 'Kiosk Zoran');
      await fill('review-total', '23.40');
      await tap('issue-NO_DATE-date-2026-05-03');
      await tap('review-count');
      await expect(store.getState().spends[0]).toMatchObject({ amount: 2340, note: 'Kiosk Zoran' });
      await expect(services.calls.fetches).toHaveLength(0);
    });
  },
};

/** Two counted days, one bill waiting, one kept copy — built straight into the store. */
function seededBills() {
  const counted = (id: string, date: string, amount: number, merchant: string, time: string) => ({
    receipt: makeReceipt({ id, date }, { merchant, time, date, total: amount }),
    spend: makeSpend({ id: `sp-${id}`, receiptId: id, date, amount, note: merchant }),
  });
  const a = counted('r-lunch', '2026-05-03', 1250, 'Pastelaria Central', '12:30');
  const b = counted('r-market', '2026-05-03', 4200, 'Mercado da Ribeira', '19:02');
  const c = counted('r-metro', '2026-05-02', 800, 'Carris', '08:15');
  const waiting = makeReceipt(
    { id: 'r-taxi', status: 'needs-attention', date: '2026-05-02', tag: 'transport' },
    { merchant: 'Taxi Lisboa', total: 3000, time: '23:10', date: '2026-05-02' },
  );
  const copy = makeReceipt(
    { id: 'r-copy', status: 'archived', date: '2026-04-28' },
    { merchant: 'Museum shop', total: 999, date: '2026-04-28' },
  );
  return {
    ...withTrip,
    receipts: [a.receipt, b.receipt, c.receipt, waiting, copy],
    spends: [a.spend, b.spend, c.spend],
  };
}

export const F15_BillsTab: Story = {
  name: 'F15 · Bills tab: timeline, inbox, copies; Bills & AI settings',
  parameters: { budget: { initial: seededBills() } },
  play: async (ctx) => {
    const { canvas, store, id, tap, fill } = driver(ctx);
    await ctx.step('Counted bills are grouped by printed day, newest first', async () => {
      await expect(canvas.getByTestId('timeline-day-2026-05-03')).toHaveTextContent(/€54\.50/);
      await expect(canvas.getByTestId('timeline-day-2026-05-02')).toHaveTextContent(/€8\.00/);
      await expect(id('inbox')).toHaveTextContent(/Needs you · 1/);
      await expect(id('archive')).toHaveTextContent(/Kept as copies · 1/);
    });
    await ctx.step('Stopping a count returns the money and keeps the copy', async () => {
      await tap('receipt-row-r-lunch');
      await tap('review-archive');
      await expect(store.getState().spends.some((s) => s.receiptId === 'r-lunch')).toBe(false);
      await expect(await canvas.findByTestId('archive')).toHaveTextContent(/Kept as copies · 2/);
    });
    await ctx.step(
      'Settings → Bills & AI: pick a provider and save a key (kept out of the app data)',
      async () => {
        await tap('tab-settings');
        await tap('settings-ai-gemini');
        await fill('settings-ai-key', 'SECRET-KEY-123');
        await tap('settings-ai-key-save');
        await expect(await canvas.findByTestId('settings-ai-key-saved')).toBeVisible();
        await expect(JSON.stringify(store.getState())).not.toContain('SECRET-KEY-123');
      },
    );
  },
};
