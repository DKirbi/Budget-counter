import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { demoPlan } from '@tbc/core/testing';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { DayCard } from './day-card';

const days = demoPlan().days; // 2026-05-01…07 of the Lisbon demo trip

/** A day in the Days list: date, status, spent vs. available, and the debt/credit carried in from yesterday. */
const meta = {
  title: 'Domain/DayCard',
  component: DayCard,
  args: { day: days[2]!, currency: 'EUR', onPress: fn(), selected: false },
} satisfies Meta<typeof DayCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Today: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByTestId('day-card-2026-05-03'));
    await expect(args.onPress).toHaveBeenCalledWith('2026-05-03');
  },
};
export const UnderBudgetPast: Story = { args: { day: days[0]! } };
export const OverspentPast: Story = { args: { day: days[1]! } };
export const FutureWithDebt: Story = { args: { day: days[3]! } };
export const Selected: Story = { args: { selected: true } };

export const WholeTrip: Story = {
  parameters: { controls: { disable: true } },
  render: (args) => (
    <View className="gap-2">
      {days.map((day) => (
        <DayCard key={day.date} {...args} day={day} />
      ))}
    </View>
  ),
};
