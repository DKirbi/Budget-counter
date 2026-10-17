import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Plus, Trash2 } from 'lucide-react-native';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Button } from './button';
import { Icon } from './icon';
import { Text } from './text';

/**
 * shadcn's `Button` for React Native: CVA variants + sizes, label colour pushed down through `TextClassContext`.
 * Every size except `sm` keeps a ≥ 44 px touch target (our operators use this one-handed, on the move).
 */
const meta = {
  title: 'Primitives/Button',
  component: Button,
  args: { onPress: fn(), variant: 'default', size: 'default', disabled: false },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'],
    },
    size: { control: 'select', options: ['default', 'sm', 'lg', 'icon'] },
  },
  render: (args) => (
    <Button {...args}>
      <Text>Save spend</Text>
    </Button>
  ),
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByText('Save spend'));
    await expect(args.onPress).toHaveBeenCalledTimes(1);
  },
};

export const Variants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <View className="gap-3">
      {(['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'] as const).map(
        (variant) => (
          <Button key={variant} variant={variant}>
            <Text>{variant}</Text>
          </Button>
        ),
      )}
    </View>
  ),
};

export const Sizes: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <View className="items-start gap-3">
      <Button size="sm">
        <Text>Small</Text>
      </Button>
      <Button size="default">
        <Text>Default</Text>
      </Button>
      <Button size="lg">
        <Text>Large</Text>
      </Button>
      <Button size="icon" accessibilityLabel="Add spend">
        <Icon as={Plus} size={20} className="text-primary-foreground" />
      </Button>
    </View>
  ),
};

export const WithIcon: Story = {
  render: (args) => (
    <Button {...args} variant="destructive">
      <Icon as={Trash2} size={18} className="text-destructive-foreground" />
      <Text>Delete spend</Text>
    </Button>
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByText('Save spend'));
    await expect(args.onPress).not.toHaveBeenCalled();
  },
};
