import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Controlled } from '../storybook';
import { SegmentedControl } from './tabs';

const OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

/** Single-choice control built on Tabs (`role="tablist"`), e.g. the theme picker. Prefer it over a dropdown for ≤ 4 options. */
const meta = {
  title: 'Primitives/SegmentedControl',
  component: SegmentedControl<'system' | 'light' | 'dark'>,
  args: {
    value: 'system',
    options: OPTIONS,
    accessibilityLabel: 'Theme',
    onValueChange: () => undefined,
  },
  render: (args) => (
    <Controlled value={args.value}>
      {(value, setValue) => <SegmentedControl {...args} value={value} onValueChange={setValue} />}
    </Controlled>
  ),
} satisfies Meta<typeof SegmentedControl<'system' | 'light' | 'dark'>>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('segment-dark'));
    await expect(canvas.getByTestId('segment-dark')).toHaveAttribute('aria-selected', 'true');
    await expect(canvas.getByTestId('segment-system')).toHaveAttribute('aria-selected', 'false');
  },
};
