import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { DEFAULT_SETTINGS } from '@tbc/core';
import { demoData, makeReceipt, makeSpend, makeTrip } from '@tbc/core/testing';
import { fn } from 'storybook/test';
import { MiniApp } from './MiniApp';
import { CreateTripScreen } from './screens/CreateTripScreen';
import { DayScreen } from './screens/DayScreen';
import { LogSpendScreen } from './screens/LogSpendScreen';
import { ReceiptReviewScreen } from './screens/ReceiptReviewScreen';
import { ScanScreen } from './screens/ScanScreen';

/**
 * Every screen, in the states that matter. The four tab screens are shown inside `MiniApp` (the router-free shell:
 * same tab bar labels and testIDs as the real Expo Router app), the modal screens standalone.
 *
 * Use the toolbar's **Theme** switch to review dark mode.
 */
const meta = {
  title: 'Screens/Overview',
  component: MiniApp,
  parameters: { frame: 'phone', layout: 'centered', docs: { story: { height: '820px' } } },
} satisfies Meta<typeof MiniApp>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Trip that started today with nothing spent yet — the ring shows the full allowance. */
const freshTrip = makeTrip({ startDate: '2026-05-03', endDate: '2026-05-09' });

export const TodayEmpty: Story = { name: 'Today · first run', args: { initialTab: 'today' } };

export const TodayOnTrack: Story = {
  name: 'Today · mid-trip',
  args: { initialTab: 'today' },
  parameters: { budget: { demo: true } },
};

export const TodayNearLimit: Story = {
  name: 'Today · near the limit',
  args: { initialTab: 'today' },
  parameters: {
    budget: {
      initial: {
        trips: [freshTrip],
        activeTripId: freshTrip.id,
        spends: [
          makeSpend({ date: '2026-05-03', amount: 9_200, tag: 'food', note: 'Tasting menu' }),
        ],
      },
    },
  },
};

export const TodayOver: Story = {
  name: 'Today · overspent',
  args: { initialTab: 'today' },
  parameters: {
    budget: {
      initial: {
        trips: [freshTrip],
        activeTripId: freshTrip.id,
        spends: [
          makeSpend({ date: '2026-05-03', amount: 12_500, tag: 'activities', note: 'Concert' }),
        ],
      },
    },
  },
};

export const Days: Story = {
  name: 'Days',
  args: { initialTab: 'days' },
  parameters: { budget: { demo: true } },
};
export const Summary: Story = {
  name: 'Summary',
  args: { initialTab: 'summary' },
  parameters: { budget: { demo: true } },
};
export const SummaryEmpty: Story = {
  name: 'Summary · nothing yet',
  args: { initialTab: 'summary' },
};
export const Settings: Story = {
  name: 'Settings',
  args: { initialTab: 'settings' },
  parameters: { budget: { demo: true } },
};

/** The standalone modal screens. */
export const CreateTrip: StoryObj<typeof CreateTripScreen> = {
  name: 'Create trip',
  render: () => <CreateTripScreen onDone={fn()} />,
};

export const LogSpend: StoryObj<typeof LogSpendScreen> = {
  name: 'Log spend',
  parameters: { budget: { demo: true } },
  render: () => <LogSpendScreen onDone={fn()} />,
};

export const DayDetail: StoryObj<typeof DayScreen> = {
  name: 'Day detail (overspent day)',
  parameters: { budget: { demo: true } },
  render: () => <DayScreen date="2026-05-02" onAddSpend={fn()} onOpenSpend={fn()} />,
};

// ── Bills ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Two counted days, one bill waiting for the user and one kept copy, built straight into the store. */
function billsData() {
  const trip = makeTrip();
  const counted = (id: string, date: string, amount: number, merchant: string, time: string) => ({
    receipt: makeReceipt({ id, date }, { merchant, time, date, total: amount }),
    spend: makeSpend({ id: `sp-${id}`, receiptId: id, date, amount, note: merchant }),
  });
  const a = counted('r-lunch', '2026-05-03', 1250, 'Pastelaria Central', '12:30');
  const b = counted('r-market', '2026-05-03', 4200, 'Mercado da Ribeira', '19:02');
  const c = counted('r-metro', '2026-05-02', 800, 'Carris', '08:15');
  const waiting = makeReceipt(
    { id: 'r-taxi', status: 'needs-attention', date: '2026-04-28', tag: 'transport' },
    { merchant: 'Taxi Lisboa', total: 3000, time: '23:10', date: '2026-04-28' },
  );
  const copy = makeReceipt(
    { id: 'r-copy', status: 'archived', date: '2026-04-28' },
    { merchant: 'Museum shop', total: 999, date: '2026-04-28' },
  );
  return {
    trips: [trip],
    activeTripId: trip.id,
    receipts: [a.receipt, b.receipt, c.receipt, waiting, copy],
    spends: [a.spend, b.spend, c.spend],
  };
}

export const BillsEmpty: Story = {
  name: 'Bills · nothing scanned yet',
  args: { initialTab: 'bills' },
  parameters: { budget: { initial: { trips: [freshTrip], activeTripId: freshTrip.id } } },
};

export const BillsTimeline: Story = {
  name: 'Bills · timeline, inbox and copies',
  args: { initialTab: 'bills' },
  parameters: { budget: { initial: billsData() } },
};

export const BillsNoTrip: Story = { name: 'Bills · no trip yet', args: { initialTab: 'bills' } };

export const SettingsBillsAndAi: Story = {
  name: 'Settings · Bills & AI switched on',
  args: { initialTab: 'settings' },
  parameters: {
    budget: {
      initial: {
        ...demoData(),
        settings: {
          ...DEFAULT_SETTINGS,
          ai: {
            provider: 'gemini',
            model: 'gemini-flash-latest',
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
            dailyLimit: 20,
          },
        },
      },
    },
    scan: { secrets: { 'tbc.ai.apiKey': 'demo-key' } },
  },
};

export const ScanIdle: StoryObj<typeof ScanScreen> = {
  name: 'Scan · ready',
  parameters: { budget: { demo: true } },
  render: () => <ScanScreen onOpenReceipt={fn()} onDone={fn()} onCreateTrip={fn()} />,
};

export const ScanWithoutOcr: StoryObj<typeof ScanScreen> = {
  name: 'Scan · no text reading in this build',
  parameters: { budget: { demo: true }, scan: { ocrSupported: false } },
  render: () => <ScanScreen onOpenReceipt={fn()} onDone={fn()} onCreateTrip={fn()} />,
};

export const ReviewOddDate: StoryObj<typeof ReceiptReviewScreen> = {
  name: 'Review · bill from before the trip',
  parameters: { budget: { initial: billsData() } },
  render: () => <ReceiptReviewScreen receiptId="r-taxi" onDone={fn()} />,
};

export const ReviewCounted: StoryObj<typeof ReceiptReviewScreen> = {
  name: 'Review · counted bill',
  parameters: { budget: { initial: billsData() } },
  render: () => <ReceiptReviewScreen receiptId="r-lunch" onDone={fn()} />,
};

export const ReviewUnreadable: StoryObj<typeof ReceiptReviewScreen> = {
  name: 'Review · unreadable photo, AI available',
  parameters: {
    budget: {
      initial: (() => {
        const base = billsData();
        const blurred = makeReceipt(
          {
            id: 'r-blur',
            status: 'needs-attention',
            date: null,
            imageUri: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
          },
          {
            merchant: undefined,
            total: undefined,
            date: undefined,
            time: undefined,
            confidence: 0,
          },
        );
        return { ...base, receipts: [...base.receipts, blurred] };
      })(),
    },
  },
  render: () => <ReceiptReviewScreen receiptId="r-blur" onDone={fn()} />,
};

export const ReviewNotFound: StoryObj<typeof ReceiptReviewScreen> = {
  name: 'Review · bill not found',
  render: () => <ReceiptReviewScreen receiptId="nope" onDone={fn()} />,
};
