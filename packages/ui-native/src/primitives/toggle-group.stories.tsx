import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Controlled } from '../storybook';
import { Text } from './text';
import { ToggleGroup, ToggleGroupItem } from './toggle-group';

/** Chip-style single/multi select. Used for currency and (with icons) the category picker. */
const meta = {
  title: 'Primitives/ToggleGroup',
  component: ToggleGroup,
  args: { type: 'single', value: 'EUR', onValueChange: () => undefined },
  render: (args) => (
    <Controlled value={args.value as string}>
      {(value, setValue) => (
        <ToggleGroup type="single" value={value} onValueChange={(v) => v && setValue(v)}>
          {['EUR', 'USD', 'GBP', 'JPY'].map((code) => (
            <ToggleGroupItem key={code} value={code} aria-label={code} testID={`currency-${code}`}>
              <Text>{code}</Text>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
    </Controlled>
  ),
} satisfies Meta<typeof ToggleGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('currency-JPY'));
    await expect(canvas.getByTestId('currency-JPY')).toHaveAttribute('aria-checked', 'true');
    await expect(canvas.getByTestId('currency-EUR')).toHaveAttribute('aria-checked', 'false');
  },
};
