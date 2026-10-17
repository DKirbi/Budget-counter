import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Controlled } from '../storybook';
import { TagPicker } from './tag-picker';

/**
 * Category chooser — a radio group of icon chips. `compact` shows icon-only 44 px circles for dense layouts such as
 * split-payment rows (labels remain for screen readers).
 */
const meta = {
  title: 'Domain/TagPicker',
  component: TagPicker,
  args: { value: 'food', compact: false, onValueChange: () => undefined },
  render: (args) => (
    <Controlled value={args.value}>
      {(value, setValue) => <TagPicker {...args} value={value} onValueChange={setValue} />}
    </Controlled>
  ),
} satisfies Meta<typeof TagPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('tag-transport'));
    await expect(canvas.getByTestId('tag-transport')).toHaveAttribute('aria-checked', 'true');
    await expect(canvas.getByTestId('tag-food')).toHaveAttribute('aria-checked', 'false');
  },
};
export const Compact: Story = { args: { compact: true } };
