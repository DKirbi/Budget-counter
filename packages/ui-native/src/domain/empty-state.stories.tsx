import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Plane } from 'lucide-react-native';
import { Button } from '../primitives/button';
import { Text } from '../primitives/text';
import { EmptyState } from './empty-state';

/** First-run and "nothing here yet" screens. Always offers the next action, never a dead end. */
const meta = {
  title: 'Domain/EmptyState',
  component: EmptyState,
  args: {
    icon: Plane,
    title: 'Plan your first trip',
    description: 'Set a budget and we will split it into daily allowances.',
  },
} satisfies Meta<typeof EmptyState>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithAction: Story = {
  args: {
    action: (
      <Button>
        <Text>Create a trip</Text>
      </Button>
    ),
  },
};
export const WithoutAction: Story = {};
