import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from 'lucide-react-native';
import { View } from 'react-native';
import { Alert } from './alert';

/** Inline message. Used for the day message ("You're €25 over…") and the pace warning on Summary. */
const meta = {
  title: 'Primitives/Alert',
  component: Alert,
  args: { variant: 'default', title: 'Heads up', description: 'Unspent money moves to tomorrow.' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'info', 'success', 'warning', 'destructive'],
    },
  },
} satisfies Meta<typeof Alert>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { icon: Info } };

export const AllVariants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <View className="gap-3">
      <Alert icon={Info} variant="info" title="Tip" description="Tap the ring to log a spend." />
      <Alert
        icon={CheckCircle2}
        variant="success"
        title="On track"
        description="€12.00 under today's limit."
      />
      <Alert
        icon={AlertTriangle}
        variant="warning"
        title="Near limit"
        description="Only €8.00 left today."
      />
      <Alert
        icon={OctagonAlert}
        variant="destructive"
        title="Over by €25.00"
        description="Tomorrow's allowance drops to €75.00."
      />
    </View>
  ),
};
