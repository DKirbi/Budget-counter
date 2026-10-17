import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { Progress } from './progress';

/** Determinate progress bar. `indicatorClassName` swaps the colour to encode status (e.g. `bg-warning` near the limit). */
const meta = {
  title: 'Primitives/Progress',
  component: Progress,
  args: { value: 60 },
  argTypes: { value: { control: { type: 'range', min: 0, max: 100 } } },
  render: (args) => (
    <View className="w-full">
      <Progress aria-label="Budget used" {...args} />
    </View>
  ),
} satisfies Meta<typeof Progress>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Warning: Story = { args: { value: 92, indicatorClassName: 'bg-warning' } };
export const Over: Story = { args: { value: 100, indicatorClassName: 'bg-destructive' } };

/** When a parent already announces the value (day card, category row), hide the bar from assistive tech. */
export const Decorative: Story = { args: { value: 40, decorative: true, 'aria-label': undefined } };
