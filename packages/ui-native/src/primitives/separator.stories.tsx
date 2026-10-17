import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { Separator } from './separator';
import { Text } from './text';

/** Hairline divider, horizontal or vertical. */
const meta = { title: 'Primitives/Separator', component: Separator } satisfies Meta<
  typeof Separator
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: () => (
    <View className="w-full gap-3">
      <Text>Food</Text>
      <Separator />
      <Text>Transport</Text>
    </View>
  ),
};

export const Vertical: Story = {
  render: () => (
    <View className="h-6 flex-row items-center gap-3">
      <Text>Today</Text>
      <Separator orientation="vertical" />
      <Text>Days</Text>
    </View>
  ),
};
