import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { makeReceipt, makeSpend } from '@tbc/core/testing';
import type { SpendTag, TimelineDay } from '@tbc/core';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ReceiptTimeline } from './receipt-timeline';

const entry = (
  id: string,
  merchant: string,
  amount: number,
  time: string,
  tag: SpendTag = 'food',
) => ({
  receipt: makeReceipt({ id, tag }, { merchant, time }),
  spends: [makeSpend({ amount, tag })],
  amount,
});

const days: TimelineDay[] = [
  {
    date: '2026-05-03',
    total: 5_450,
    entries: [
      entry('a', 'Mercado da Ribeira', 3_900, '19:02', 'groceries'),
      entry('b', 'Pastelaria Central', 1_550, '08:15'),
    ],
  },
  { date: '2026-05-02', total: 800, entries: [entry('c', 'Carris', 800, '12:00', 'transport')] },
];

/** Counted bills, grouped by the day printed on them — the evening scan becomes a timeline. */
const meta = {
  title: 'Domain/ReceiptTimeline',
  component: ReceiptTimeline,
  args: { days, currency: 'EUR', today: '2026-05-03', onOpenReceipt: fn() },
} satisfies Meta<typeof ReceiptTimeline>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByTestId('receipt-row-c'));
    await expect(args.onOpenReceipt).toHaveBeenCalledWith('c');
  },
};
export const Empty: Story = { args: { days: [] } };
