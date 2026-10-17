import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { makeReceipt } from '@tbc/core/testing';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ReceiptRow } from './receipt-row';

/** One scanned bill. Status badges say what is going on: waiting for you, kept as a copy, split, read by AI. */
const meta = {
  title: 'Domain/ReceiptRow',
  component: ReceiptRow,
  args: {
    currency: 'EUR',
    amount: 1_250,
    onPress: fn(),
    receipt: makeReceipt({ id: 'r1' }),
  },
} satisfies Meta<typeof ReceiptRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Counted: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByTestId('receipt-row-r1'));
    await expect(args.onPress).toHaveBeenCalledWith('r1');
  },
};
export const NeedsYou: Story = {
  args: { receipt: makeReceipt({ id: 'r2', status: 'needs-attention' }) },
};
export const NotCounted: Story = {
  args: { receipt: makeReceipt({ id: 'r3', status: 'archived' }), showDate: true },
};
export const SplitAndAi: Story = {
  args: { receipt: makeReceipt({ id: 'r4', tag: 'groceries' }, { source: 'ai' }), split: true },
};
export const Unreadable: Story = {
  args: {
    amount: null,
    receipt: makeReceipt(
      { id: 'r5', status: 'needs-attention', date: null },
      { merchant: undefined, time: undefined },
    ),
  },
};
