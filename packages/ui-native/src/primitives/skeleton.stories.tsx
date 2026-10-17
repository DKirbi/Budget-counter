import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { Skeleton } from './skeleton';

/** Loading placeholder. Size and radius come from `className`. */
const meta = { title: 'Primitives/Skeleton', component: Skeleton } satisfies Meta<typeof Skeleton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SpendRowLoading: Story = {
  render: () => (
    <View className="w-full flex-row items-center gap-3">
      <Skeleton className="h-11 w-11 rounded-full" />
      <View className="flex-1 gap-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </View>
    </View>
  ),
};
