import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Coffee, Plane, Utensils } from 'lucide-react-native';
import { View } from 'react-native';
import { Icon } from './icon';

/**
 * Lucide icons (the icon set shadcn uses) with NativeWind colour support: `className="text-primary"` tints the stroke
 * on native and web alike.
 */
const meta = {
  title: 'Primitives/Icon',
  component: Icon,
  args: { as: Coffee, size: 24 },
} satisfies Meta<typeof Icon>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { className: 'text-primary' } };

export const Tones: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <View className="flex-row gap-4">
      <Icon as={Utensils} size={28} className="text-foreground" />
      <Icon as={Plane} size={28} className="text-primary" />
      <Icon as={Coffee} size={28} className="text-destructive" />
    </View>
  ),
};
