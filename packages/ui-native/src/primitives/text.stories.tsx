import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { Text } from './text';

/**
 * Themed text with the type scale from `tokens/core/typography.json`.
 * `numeric` uses tabular figures so amounts do not jitter while the user types.
 */
const meta = {
  title: 'Primitives/Text',
  component: Text,
  args: { variant: 'body', children: 'Daily allowance' },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'h1',
        'h2',
        'h3',
        'lead',
        'body',
        'small',
        'caption',
        'muted',
        'numeric',
      ],
    },
  },
} satisfies Meta<typeof Text>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Scale: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <View className="gap-2">
      {(['h1', 'h2', 'h3', 'lead', 'body', 'small', 'muted', 'caption', 'numeric'] as const).map(
        (v) => (
          <Text key={v} variant={v}>
            {v} · €1,234.50 spent today
          </Text>
        ),
      )}
    </View>
  ),
};
