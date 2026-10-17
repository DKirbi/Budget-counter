import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { demoPlan } from '@tbc/core/testing';
import { WidgetPreview } from './widget-preview';

const plan = demoPlan();
const today = plan.today!;
const upcoming = plan.days.filter((d) => d.phase === 'future').slice(0, 3);

/**
 * Design reference for the Android home-screen widgets (the hero feature). The real widgets are native
 * (Glance / react-native-android-widget); this in-app preview shares their layout and the same tokens, and is what the
 * Settings screen shows before the user adds one.
 */
const meta = {
  title: 'Domain/WidgetPreview',
  component: WidgetPreview,
  args: { size: '2x2', today, upcoming, currency: 'EUR', tripName: 'Lisbon' },
  argTypes: { size: { control: 'inline-radio', options: ['2x2', '4x2'] } },
} satisfies Meta<typeof WidgetPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const TwoByTwo: Story = {};
export const FourByTwo: Story = { args: { size: '4x2' } };
export const OverToday: Story = {
  args: { today: { ...today, spent: 12_500, remaining: -2_500, status: 'over' } },
};
