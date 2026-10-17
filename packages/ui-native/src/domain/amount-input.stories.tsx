import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Controlled } from '../storybook';
import { AmountInput } from './amount-input';

/**
 * Big, decimal-keyboard amount field with the currency symbol. Accepts `12`, `12.5` and the European `12,50`;
 * parsing and validation live in `@tbc/core` (`parseAmount`) so the web app behaves identically.
 */
const meta = {
  title: 'Domain/AmountInput',
  component: AmountInput,
  args: {
    value: '',
    currency: 'EUR',
    accessibilityLabel: 'Amount',
    testID: 'amount',
    onChangeText: () => undefined,
  },
  argTypes: { currency: { control: 'select', options: ['EUR', 'USD', 'GBP', 'JPY', 'CHF'] } },
  render: (args) => (
    <Controlled value={args.value}>
      {(value, setValue) => <AmountInput {...args} value={value} onChangeText={setValue} />}
    </Controlled>
  ),
} satisfies Meta<typeof AmountInput>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
export const Filled: Story = { args: { value: '12.50' } };
export const Invalid: Story = { args: { value: '', invalid: true } };
export const Yen: Story = { args: { value: '2400', currency: 'JPY' } };

export const Typing: Story = {
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByTestId('amount');
    await userEvent.type(input, '450,50');
    await expect(input).toHaveValue('450,50');
  },
};
