import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { StatTile } from './stat-tile';

/** Summary metric: label, big value, optional hint. Tone colours the value (never the only cue — the hint says why). */
const meta = {
  title: 'Domain/StatTile',
  component: StatTile,
  args: { label: 'Spent', value: '€271.00', hint: 'of €700.00', tone: 'default' },
  argTypes: { tone: { control: 'select', options: ['default', 'positive', 'negative'] } },
} satisfies Meta<typeof StatTile>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Grid: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <View className="w-full flex-row flex-wrap gap-2">
      <StatTile className="flex-1" label="Spent" value="€271.00" hint="of €700.00" />
      <StatTile className="flex-1" label="Remaining" value="€429.00" tone="positive" />
      <StatTile className="flex-1" label="Average / day" value="€90.33" />
      <StatTile
        className="flex-1"
        label="Projected"
        value="€632.31"
        hint="at this pace"
        tone="negative"
      />
    </View>
  ),
};
