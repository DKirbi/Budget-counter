import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { Badge } from './badge';
import { Text } from './text';

/** Compact status label. Colours map to semantic tokens (`success`, `warning`, `destructive`, `info`). */
const meta = {
  title: 'Primitives/Badge',
  component: Badge,
  args: { variant: 'default' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'outline', 'success', 'warning', 'destructive', 'info'],
    },
  },
  render: (args) => (
    <Badge {...args}>
      <Text>On track</Text>
    </Badge>
  ),
} satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllVariants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <View className="flex-row flex-wrap gap-2">
      {(
        ['default', 'secondary', 'outline', 'success', 'warning', 'destructive', 'info'] as const
      ).map((v) => (
        <Badge key={v} variant={v}>
          <Text>{v}</Text>
        </Badge>
      ))}
    </View>
  ),
};
