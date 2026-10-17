import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
import { AllowanceRing } from './allowance-ring';

/**
 * The hero of the Today screen (and the widget): how much of *today's* money is left.
 * Colour + label encode status, never colour alone (WCAG 1.4.1); the ring itself is a `progressbar` for screen readers.
 */
const meta = {
  title: 'Domain/AllowanceRing',
  component: AllowanceRing,
  args: {
    remaining: 6_550,
    available: 10_000,
    spent: 3_450,
    currency: 'EUR',
    status: 'on-track',
    size: 220,
    testID: 'ring',
  },
  argTypes: {
    status: { control: 'select', options: ['planned', 'on-track', 'near-limit', 'over'] },
    size: { control: { type: 'range', min: 120, max: 300, step: 10 } },
  },
} satisfies Meta<typeof AllowanceRing>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OnTrack: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByTestId('ring-amount')).toHaveTextContent('€65.50');
  },
};
export const NearLimit: Story = { args: { remaining: 900, spent: 9_100, status: 'near-limit' } };
export const Over: Story = {
  args: { remaining: -2_500, spent: 12_500, status: 'over' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Over by')).toBeVisible();
    await expect(canvas.getByTestId('ring-amount')).toHaveTextContent('€25.00');
  },
};
export const Planned: Story = { args: { remaining: 10_000, spent: 0, status: 'planned' } };
export const WithCarryOver: Story = {
  args: { remaining: 21_000, available: 25_000, spent: 4_000, status: 'on-track' },
};

export const Sizes: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <View className="flex-row items-end gap-4">
      <AllowanceRing
        remaining={6_550}
        available={10_000}
        spent={3_450}
        currency="EUR"
        status="on-track"
        size={96}
        strokeWidth={10}
      />
      <AllowanceRing
        remaining={6_550}
        available={10_000}
        spent={3_450}
        currency="EUR"
        status="on-track"
        size={160}
      />
    </View>
  ),
};
