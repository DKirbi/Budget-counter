import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { CategoryBar } from './category-bar';

/** One row of the Summary breakdown: category, amount and share of total spending. */
const meta = {
  title: 'Domain/CategoryBar',
  component: CategoryBar,
  args: { currency: 'EUR', total: { tag: 'food', amount: 9_650, share: 0.356, count: 3 } },
  argTypes: { total: { control: 'object' } },
} satisfies Meta<typeof CategoryBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Small: Story = {
  args: { total: { tag: 'transport', amount: 950, share: 0.035, count: 1 } },
};
export const Dominant: Story = {
  args: { total: { tag: 'activities', amount: 42_000, share: 0.82, count: 2 } },
};
