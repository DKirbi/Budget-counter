import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { MoneyText } from './money-text';

/**
 * Formats integer minor units with `Intl.NumberFormat` — currency-aware (JPY has no decimals, CHF uses a different
 * grouping) and tabular so columns of amounts line up.
 */
const meta = {
  title: 'Domain/MoneyText',
  component: MoneyText,
  args: { amount: 1_250, currency: 'EUR', size: 'base', tone: 'default' },
  argTypes: {
    size: { control: 'select', options: ['sm', 'base', 'lg', 'xl', 'display'] },
    tone: { control: 'select', options: ['default', 'muted', 'positive', 'negative', 'auto'] },
  },
} satisfies Meta<typeof MoneyText>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Negative: Story = { args: { amount: -1_250, tone: 'auto' } };
export const Signed: Story = { args: { amount: 1_250, signed: true, tone: 'positive' } };
export const Compact: Story = { args: { amount: 10_000, compact: true } };

export const Currencies: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <View className="gap-1">
      <MoneyText amount={123_456} currency="EUR" />
      <MoneyText amount={123_456} currency="USD" />
      <MoneyText amount={123_456} currency="GBP" />
      <MoneyText amount={123_456} currency="JPY" />
      <MoneyText amount={123_456} currency="CHF" />
    </View>
  ),
};
