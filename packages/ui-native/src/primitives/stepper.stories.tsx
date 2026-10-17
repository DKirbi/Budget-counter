import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Controlled } from '../storybook';
import { Stepper } from './stepper';

/**
 * Integer stepper (trip length, start day, spend day). Exposes the `adjustable` accessibility role, so screen-reader
 * users can swipe up/down; the +/- buttons are ≥ 44 px and disable at the limits.
 */
const meta = {
  title: 'Primitives/Stepper',
  component: Stepper,
  args: {
    label: 'days',
    value: 7,
    min: 1,
    max: 9,
    testID: 'stepper',
    format: (n: number) => `${n} days`,
    onValueChange: () => undefined,
  },
  render: (args) => (
    <Controlled value={args.value}>
      {(value, setValue) => <Stepper {...args} value={value} onValueChange={setValue} />}
    </Controlled>
  ),
} satisfies Meta<typeof Stepper>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const StopsAtTheLimits: Story = {
  args: { value: 8 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('stepper-increase'));
    await expect(canvas.getByTestId('stepper-value')).toHaveTextContent('9 days');
    await expect(canvas.getByLabelText('Increase days')).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(canvas.getByTestId('stepper-decrease'));
    await expect(canvas.getByTestId('stepper-value')).toHaveTextContent('8 days');
  },
};
