import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Controlled } from '../storybook';
import { Field } from './field';
import { Input } from './input';

/**
 * `Field` = label + control + hint/error, wired for screen readers (label, description and error are announced with the input).
 * `Input` is a themed `TextInput` with an `invalid` state.
 */
const meta = {
  title: 'Primitives/Field & Input',
  component: Field,
  args: {
    label: 'Trip name',
    description: 'Shown on Today and in the widget.',
    error: undefined,
    children: null,
  },
} satisfies Meta<typeof Field>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Field {...args}>
      <Controlled value="">
        {(value, setValue) => (
          <Input
            testID="field-input"
            placeholder="e.g. Lisbon"
            value={value}
            onChangeText={setValue}
          />
        )}
      </Controlled>
    </Field>
  ),
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByTestId('field-input');
    await userEvent.type(input, 'Porto');
    await expect(input).toHaveValue('Porto');
  },
};

export const WithError: Story = {
  args: { error: 'Give your trip a name' },
  render: (args) => (
    <Field {...args}>
      <Input invalid placeholder="e.g. Lisbon" />
    </Field>
  ),
};
