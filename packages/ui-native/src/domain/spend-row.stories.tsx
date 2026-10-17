import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { SPEND_TAGS } from '@tbc/core';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { SpendRow } from './spend-row';

/** One logged spend: category icon, note, amount. `splitGroupId` adds the "Split" badge. Tappable when `onPress` is set. */
const meta = {
  title: 'Domain/SpendRow',
  component: SpendRow,
  args: {
    currency: 'EUR',
    onPress: fn(),
    spend: { id: 's1', amount: 1_450, tag: 'food', note: 'Pastéis de nata' },
  },
} satisfies Meta<typeof SpendRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByTestId('spend-row-s1'));
    await expect(args.onPress).toHaveBeenCalledWith('s1');
  },
};
export const WithoutNote: Story = { args: { spend: { id: 's2', amount: 250, tag: 'transport' } } };
export const Split: Story = {
  args: {
    spend: { id: 's3', amount: 2_500, tag: 'groceries', note: 'Supermarket', splitGroupId: 'g1' },
  },
};
export const ReadOnly: Story = { args: { onPress: undefined } };

export const AllCategories: Story = {
  parameters: { controls: { disable: true } },
  render: (args) => (
    <View className="gap-1">
      {SPEND_TAGS.map((t, i) => (
        <SpendRow
          key={t.id}
          {...args}
          spend={{ id: `t${i}`, amount: 1_000 * (i + 1), tag: t.id }}
        />
      ))}
    </View>
  ),
};
