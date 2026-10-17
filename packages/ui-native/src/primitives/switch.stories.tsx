import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { expect, userEvent, within } from 'storybook/test';
import { Controlled } from '../storybook';
import { Label } from './label';
import { Switch } from './switch';

/** On/off toggle (Radix Switch on the web, native Switch on device). Pair with a `Label` so the whole row is tappable. */
const meta = {
  title: 'Primitives/Switch',
  component: Switch,
  args: { checked: false, onCheckedChange: () => undefined },
  render: (args) => (
    <Controlled value={args.checked}>
      {(checked, setChecked) => (
        <View className="flex-row items-center gap-3">
          <Switch
            {...args}
            checked={checked}
            aria-label="Split this payment"
            testID="demo-switch"
            onCheckedChange={setChecked}
          />
          <Label onPress={() => setChecked(!checked)}>Split this payment</Label>
        </View>
      )}
    </Controlled>
  ),
} satisfies Meta<typeof Switch>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = {};
export const On: Story = { args: { checked: true } };

export const Toggles: Story = {
  play: async ({ canvasElement }) => {
    const sw = within(canvasElement).getByTestId('demo-switch');
    await userEvent.click(sw);
    await expect(sw).toBeChecked();
    await userEvent.click(sw);
    await expect(sw).not.toBeChecked();
  },
};
