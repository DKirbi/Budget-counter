import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { makeSpend, makeTrip } from '@tbc/core/testing';
import { fn } from 'storybook/test';
import { MiniApp } from './MiniApp';
import { CreateTripScreen } from './screens/CreateTripScreen';
import { DayScreen } from './screens/DayScreen';
import { LogSpendScreen } from './screens/LogSpendScreen';

/**
 * Every screen, in the states that matter. The four tab screens are shown inside `MiniApp` (the router-free shell:
 * same tab bar labels and testIDs as the real Expo Router app), the modal screens standalone.
 *
 * Use the toolbar's **Theme** switch to review dark mode.
 */
const meta = {
  title: 'Screens/Overview',
  component: MiniApp,
  parameters: { frame: 'phone', layout: 'centered', docs: { story: { height: '820px' } } },
} satisfies Meta<typeof MiniApp>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Trip that started today with nothing spent yet — the ring shows the full allowance. */
const freshTrip = makeTrip({ startDate: '2026-05-03', endDate: '2026-05-09' });

export const TodayEmpty: Story = { name: 'Today · first run', args: { initialTab: 'today' } };

export const TodayOnTrack: Story = {
  name: 'Today · mid-trip',
  args: { initialTab: 'today' },
  parameters: { budget: { demo: true } },
};

export const TodayNearLimit: Story = {
  name: 'Today · near the limit',
  args: { initialTab: 'today' },
  parameters: {
    budget: {
      initial: {
        trips: [freshTrip],
        activeTripId: freshTrip.id,
        spends: [
          makeSpend({ date: '2026-05-03', amount: 9_200, tag: 'food', note: 'Tasting menu' }),
        ],
      },
    },
  },
};

export const TodayOver: Story = {
  name: 'Today · overspent',
  args: { initialTab: 'today' },
  parameters: {
    budget: {
      initial: {
        trips: [freshTrip],
        activeTripId: freshTrip.id,
        spends: [
          makeSpend({ date: '2026-05-03', amount: 12_500, tag: 'activities', note: 'Concert' }),
        ],
      },
    },
  },
};

export const Days: Story = {
  name: 'Days',
  args: { initialTab: 'days' },
  parameters: { budget: { demo: true } },
};
export const Summary: Story = {
  name: 'Summary',
  args: { initialTab: 'summary' },
  parameters: { budget: { demo: true } },
};
export const SummaryEmpty: Story = {
  name: 'Summary · nothing yet',
  args: { initialTab: 'summary' },
};
export const Settings: Story = {
  name: 'Settings',
  args: { initialTab: 'settings' },
  parameters: { budget: { demo: true } },
};

/** The standalone modal screens. */
export const CreateTrip: StoryObj<typeof CreateTripScreen> = {
  name: 'Create trip',
  render: () => <CreateTripScreen onDone={fn()} />,
};

export const LogSpend: StoryObj<typeof LogSpendScreen> = {
  name: 'Log spend',
  parameters: { budget: { demo: true } },
  render: () => <LogSpendScreen onDone={fn()} />,
};

export const DayDetail: StoryObj<typeof DayScreen> = {
  name: 'Day detail (overspent day)',
  parameters: { budget: { demo: true } },
  render: () => <DayScreen date="2026-05-02" onAddSpend={fn()} onOpenSpend={fn()} />,
};
