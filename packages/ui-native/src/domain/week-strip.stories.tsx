import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { demoPlan } from '@tbc/core/testing';
import { expect, userEvent, within } from 'storybook/test';
import { Controlled } from '../storybook';
import { WeekStrip } from './week-strip';

/** Horizontal day picker on the Today screen: a dot per day coloured by status; the selected day is outlined. */
const meta = {
  title: 'Domain/WeekStrip',
  component: WeekStrip,
  args: { days: demoPlan().days, selectedDate: '2026-05-03', onSelect: () => undefined },
  argTypes: { days: { control: 'object' } },
  render: (args) => (
    <Controlled value={args.selectedDate}>
      {(selectedDate, setSelected) => (
        <WeekStrip {...args} selectedDate={selectedDate} onSelect={setSelected} />
      )}
    </Controlled>
  ),
} satisfies Meta<typeof WeekStrip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('week-day-2026-05-02'));
    await expect(canvas.getByTestId('week-day-2026-05-02')).toHaveAttribute('aria-checked', 'true');
  },
};
