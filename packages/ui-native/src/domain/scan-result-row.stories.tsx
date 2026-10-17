import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { fn } from 'storybook/test';
import { ScanResultRow } from './scan-result-row';

/** One photo in the evening batch: reading → filed / needs you / could not read. */
const meta = {
  title: 'Domain/ScanResultRow',
  component: ScanResultRow,
  args: {
    state: 'filed',
    title: 'Mercado da Ribeira',
    amount: 3_900,
    currency: 'EUR',
    onPress: fn(),
  },
} satisfies Meta<typeof ScanResultRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Filed: Story = { args: { detail: 'Today · Groceries' } };
export const NeedsYou: Story = {
  args: {
    state: 'attention',
    title: 'Taxi Ljubljana',
    detail: 'From 28 Apr, 4 days ago',
    amount: 3_000,
  },
};
export const Reading: Story = { args: { state: 'reading', title: 'Bill 3', amount: undefined } };
export const CouldNotRead: Story = {
  args: { state: 'failed', title: 'Bill 4', detail: 'No text found', amount: undefined },
};
export const Batch: Story = {
  parameters: { controls: { disable: true } },
  render: (args) => (
    <View className="gap-1">
      <ScanResultRow {...args} state="filed" detail="Today · Groceries" />
      <ScanResultRow
        {...args}
        state="attention"
        title="Taxi Ljubljana"
        detail="From 4 days ago"
        amount={3_000}
      />
      <ScanResultRow {...args} state="reading" title="Bill 3" amount={undefined} />
      <ScanResultRow
        {...args}
        state="failed"
        title="Bill 4"
        detail="No text found"
        amount={undefined}
      />
    </View>
  ),
};
