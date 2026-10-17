/**
 * User flows F1–F10 as *living documentation*: each story replays a complete journey through the real screens with a
 * `play` function, step by step (see the Interactions panel). The same flows are asserted in Jest (`flows.test.tsx`)
 * and on a device with Maestro (`apps/mobile/.maestro/*.yaml`) — docs/TESTING.md has the matrix.
 *
 * Press **Replay** in the Interactions panel to watch a flow again; scrub the steps to inspect any moment.
 */
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { computeTripPlan } from '@tbc/core';
import { makeSpend, makeTrip, type StoryLoaded } from '@tbc/core/testing';
import { expect, screen, userEvent, waitFor, within } from 'storybook/test';
import { MiniApp } from './MiniApp';

const meta = {
  title: 'Flows/User journeys',
  component: MiniApp,
  parameters: { frame: 'phone', layout: 'centered', docs: { story: { height: '820px' } } },
} satisfies Meta<typeof MiniApp>;
export default meta;
type Story = StoryObj<typeof meta>;

type Ctx = { canvasElement: HTMLElement; loaded: Record<string, unknown> };
/** Tiny driver so flows read like a script. */
function driver({ canvasElement, loaded }: Ctx) {
  const canvas = within(canvasElement);
  const store = (loaded as unknown as StoryLoaded).store;
  return {
    canvas,
    store,
    id: (testId: string) => canvas.getByTestId(testId),
    tap: (testId: string) => userEvent.click(canvas.getByTestId(testId)),
    /** Replace the field's content (works for pre-filled inputs too). */
    fill: async (testId: string, text: string) => {
      const el = canvas.getByTestId(testId);
      await userEvent.clear(el);
      await userEvent.type(el, text);
    },
    plan: () => computeTripPlan(store.getState().trips[0]!, store.getState().spends, '2026-05-03'),
  };
}

const freshTrip = makeTrip({ startDate: '2026-05-03', endDate: '2026-05-09' });
const freshTripData = { trips: [freshTrip], activeTripId: freshTrip.id };

export const F1_FirstRun: Story = {
  name: 'F1 · First run: create a trip',
  play: async (ctx) => {
    const { canvas, store, id, tap, fill } = driver(ctx);
    await ctx.step('A new user sees the empty state', async () => {
      await expect(id('empty-no-trip')).toBeVisible();
    });
    await ctx.step('Fill in the trip: name and budget', async () => {
      await tap('create-trip-cta');
      await fill('trip-name', 'Lisbon');
      await fill('trip-budget', '700');
      await expect(id('per-day-preview')).toHaveTextContent('€100.00');
    });
    await ctx.step('Create it and land on Today with the full allowance', async () => {
      await tap('create-trip-submit');
      await waitFor(() => expect(canvas.getByTestId('allowance-ring')).toBeVisible());
      await expect(id('allowance-ring-amount')).toHaveTextContent('€100.00');
      await expect(store.getState().trips[0]).toMatchObject({
        name: 'Lisbon',
        totalBudget: 70_000,
        overspendPolicy: 'cascade',
      });
    });
  },
};

export const F2_Validation: Story = {
  name: 'F2 · Validation: errors explained, then fixed',
  play: async (ctx) => {
    const { canvas, store, tap, fill } = driver(ctx);
    await tap('create-trip-cta');
    await ctx.step('Submitting an empty form lists every problem at once', async () => {
      await tap('create-trip-submit');
      await expect(await canvas.findByText('Give your trip a name')).toBeVisible();
      await expect(canvas.getByText('Enter an amount, like 450 or 450.50')).toBeVisible();
      await expect(store.getState().trips).toHaveLength(0);
    });
    await ctx.step('A zero budget is rejected with its own message', async () => {
      await fill('trip-name', 'Porto');
      await fill('trip-budget', '0');
      await tap('create-trip-submit');
      await expect(await canvas.findByText('Budget must be more than zero')).toBeVisible();
    });
    await ctx.step('A European decimal comma is understood', async () => {
      await fill('trip-budget', '450,50');
      await tap('create-trip-submit');
      await waitFor(() => expect(store.getState().trips).toHaveLength(1));
      await expect(store.getState().trips[0]?.totalBudget).toBe(45_050);
    });
  },
};

export const F3_LogSpend: Story = {
  name: 'F3 · Log a spend: balance updates immediately',
  parameters: { budget: { demo: true } },
  play: async (ctx) => {
    const { canvas, store, id, tap, fill, plan } = driver(ctx);
    const before = plan().today!;
    await ctx.step('Open the log-spend screen and enter €12,50 for food', async () => {
      await tap('add-spend');
      await fill('spend-amount', '12,50');
      await tap('tag-food');
      await fill('spend-note', 'Espresso');
    });
    await ctx.step('Save: the row appears and the ring drops by exactly the amount', async () => {
      await tap('save-spend');
      await waitFor(() => expect(canvas.getByText('Espresso')).toBeVisible());
      await expect(plan().today!.remaining).toBe(before.remaining - 1_250);
      await expect(store.getState().spends).toHaveLength(8);
      await expect(id('allowance-ring')).toBeVisible();
    });
  },
};

export const F3b_PreviewBeforeSaving: Story = {
  name: 'F3b · Preview the effect before saving (including going over)',
  parameters: { budget: { initial: freshTripData } },
  play: async (ctx) => {
    const { id, tap, fill } = driver(ctx);
    await tap('add-spend');
    await fill('spend-amount', '20');
    await expect(within(id('spend-preview')).getByText(/€80\.00 left on/)).toBeVisible();
    await fill('spend-amount', '130');
    await expect(within(id('spend-preview')).getByText(/€30\.00 over the limit/)).toBeVisible();
  },
};

export const F4_OverspendCascades: Story = {
  name: 'F4 · Overspend cascades into tomorrow',
  parameters: { budget: { initial: freshTripData } },
  play: async (ctx) => {
    const { canvas, id, tap, fill, plan } = driver(ctx);
    await ctx.step('Log a €125 concert against a €100 day', async () => {
      await tap('add-spend');
      await fill('spend-amount', '125');
      await tap('tag-activities');
      await fill('spend-note', 'Concert');
      await tap('save-spend');
    });
    await ctx.step('Today turns red and says what happens next', async () => {
      await waitFor(() => expect(id('day-message')).toBeVisible());
      await expect(
        within(id('day-message')).getByText("You're €25.00 over today's limit"),
      ).toBeVisible();
      await expect(within(id('day-message')).getByText(/tomorrow's allowance/)).toBeVisible();
      await expect(canvas.getByText('Over by')).toBeVisible();
      await expect(id('allowance-ring-amount')).toHaveTextContent('€25.00');
    });
    await ctx.step("Tomorrow's card shows the debt carried in", async () => {
      await expect(plan().days[1]).toMatchObject({ carryIn: -2_500, available: 7_500 });
      await tap('tab-days');
      await expect(within(id('day-card-2026-05-04')).getByText('Debt carried in')).toBeVisible();
    });
  },
};

export const F5_SpreadItOut: Story = {
  name: 'F5 · Switch the overspend rule to "spread it out"',
  parameters: {
    budget: {
      initial: { ...freshTripData, spends: [makeSpend({ date: '2026-05-03', amount: 16_000 })] },
    },
  },
  play: async (ctx) => {
    const { store, id, tap, plan } = driver(ctx);
    await tap('tab-settings');
    await tap('settings-policy-redistribute');
    await expect(store.getState().trips[0]?.overspendPolicy).toBe('redistribute');
    await expect(plan().days[1]).toMatchObject({ carryIn: 0, base: 9_000, available: 9_000 });
    await tap('tab-today');
    await expect(
      within(id('day-message')).getByText(/spread over the remaining 6 days/),
    ).toBeVisible();
  },
};

export const F6_SplitPayment: Story = {
  name: 'F6 · Split a card payment into tagged parts',
  parameters: { budget: { demo: true } },
  play: async (ctx) => {
    const { canvas, store, id, tap, fill } = driver(ctx);
    await ctx.step('Enter €40 and switch on "Split"', async () => {
      await tap('add-spend');
      await fill('spend-amount', '40');
      await tap('split-switch');
      await expect(id('split-left')).toHaveTextContent('€40.00 left to assign');
    });
    await ctx.step('Assign €25 food + €10 groceries: €5 still unassigned', async () => {
      await fill('part-0-amount', '25');
      await tap('part-0-tag-food');
      await fill('part-1-amount', '10');
      await tap('part-1-tag-groceries');
      await expect(id('split-left')).toHaveTextContent('€5.00 left to assign');
    });
    await ctx.step('Saving is blocked until the parts add up', async () => {
      await tap('save-spend');
      await expect(await canvas.findByTestId('parts-error')).toHaveTextContent(
        '€5.00 left to assign',
      );
      await expect(store.getState().spends).toHaveLength(7);
    });
    await ctx.step(
      'Fix the second part → "All assigned" → saved as two linked spends',
      async () => {
        await fill('part-1-amount', '15');
        await expect(id('split-left')).toHaveTextContent('All assigned');
        await tap('save-spend');
        await waitFor(() => expect(store.getState().spends).toHaveLength(9));
        const [a, b] = store.getState().spends.slice(-2);
        await expect([a?.amount, a?.tag, b?.amount, b?.tag]).toEqual([
          2_500,
          'food',
          1_500,
          'groceries',
        ]);
        await expect(a?.splitGroupId).toBe(b?.splitGroupId);
        await expect(canvas.getAllByText('Split')).toHaveLength(2);
      },
    );
  },
};

export const F7_EditAndDelete: Story = {
  name: 'F7 · Edit and delete a spend',
  parameters: { budget: { demo: true } },
  play: async (ctx) => {
    const { canvas, store, id, tap, fill } = driver(ctx);
    const lunch = store.getState().spends.find((s) => s.note === 'Lunch')!;
    const tram = store.getState().spends.find((s) => s.note === 'Tram 28')!;
    await ctx.step('Open Lunch, change amount and category', async () => {
      await tap(`spend-row-${lunch.id}`);
      await expect(canvas.getByText('Edit spend')).toBeVisible();
      await expect(id('spend-amount')).toHaveValue('18.00');
      await fill('spend-amount', '22.40');
      await tap('tag-groceries');
      await tap('save-spend');
      await waitFor(() =>
        expect(store.getState().spends.find((s) => s.id === lunch.id)).toMatchObject({
          amount: 2_240,
          tag: 'groceries',
        }),
      );
      await expect(await canvas.findByText('€22.40')).toBeVisible();
    });
    await ctx.step('Deleting asks first; Cancel changes nothing', async () => {
      await tap(`spend-row-${tram.id}`);
      await tap('delete-spend');
      await expect(await screen.findByText('Delete this spend?')).toBeVisible();
      await userEvent.click(screen.getByTestId('confirm-delete-spend-cancel'));
      await expect(store.getState().spends).toHaveLength(7);
    });
    await ctx.step('Confirming removes it from the list', async () => {
      await tap('delete-spend');
      await userEvent.click(await screen.findByTestId('confirm-delete-spend-confirm'));
      await waitFor(() => expect(store.getState().spends).toHaveLength(6));
      await expect(canvas.queryByText('Tram 28')).toBeNull();
    });
  },
};

export const F8_OtherDays: Story = {
  name: 'F8 · Explore days and log against another day',
  parameters: { budget: { demo: true } },
  play: async (ctx) => {
    const { canvas, store, id, tap, fill } = driver(ctx);
    await ctx.step('Open a past day from the Days tab', async () => {
      await tap('tab-days');
      await tap('day-card-2026-05-01');
      await expect(id('screen-day')).toBeVisible();
      await expect(canvas.getByText('Pastéis de nata')).toBeVisible();
    });
    await ctx.step('Log a forgotten spend there', async () => {
      await tap('add-spend-day');
      await fill('spend-amount', '3');
      await tap('save-spend');
      await waitFor(() => expect(store.getState().spends).toHaveLength(8));
      await expect(store.getState().spends.at(-1)?.date).toBe('2026-05-01');
    });
  },
};

export const F8b_DayStepper: Story = {
  name: 'F8b · The day stepper stays inside the trip',
  parameters: { budget: { demo: true } },
  play: async (ctx) => {
    const { canvas, id, tap } = driver(ctx);
    await tap('add-spend');
    await expect(id('spend-day-value')).toHaveTextContent(/today/);
    await tap('spend-day-decrease');
    await expect(id('spend-day-value')).not.toHaveTextContent(/today/);
    await tap('spend-day-decrease');
    await expect(canvas.getByLabelText('Decrease day')).toHaveAttribute('aria-disabled', 'true');
  },
};

export const F9_Summary: Story = {
  name: 'F9 · Summary reflects the trip',
  parameters: { budget: { demo: true } },
  play: async (ctx) => {
    const { id, tap } = driver(ctx);
    await tap('tab-summary');
    await expect(within(id('stat-spent')).getByText('€271.00')).toBeVisible();
    await expect(within(id('stat-remaining')).getByText('€429.00')).toBeVisible();
    await expect(within(id('stat-average')).getByText('€90.33')).toBeVisible();
    await expect(within(id('stat-projected')).getByText('€632.31')).toBeVisible();
    await expect(within(id('pace-alert')).getByText('€29.00 ahead of plan')).toBeVisible();
    await expect(id('category-food')).toBeVisible();
    await expect(id('best-day')).toHaveTextContent(/€15\.50 under/);
    await expect(id('worst-day')).toHaveTextContent(/€59\.00 over/);
  },
};

export const F10_Settings: Story = {
  name: 'F10 · Settings: theme, trips, demo data, delete',
  play: async (ctx) => {
    const { store, tap, fill } = driver(ctx);
    await ctx.step('Pick the dark theme', async () => {
      await tap('tab-settings');
      await tap('theme-dark');
      await expect(store.getState().settings.theme).toBe('dark');
    });
    await ctx.step('Load demo data, add a second trip', async () => {
      await tap('load-demo');
      await tap('new-trip');
      await fill('trip-name', 'Second');
      await fill('trip-budget', '100');
      await tap('create-trip-submit');
      await waitFor(() => expect(store.getState().trips).toHaveLength(2));
    });
    await ctx.step('Switch back to the first trip and delete it after confirming', async () => {
      const [first, second] = store.getState().trips;
      await tap('tab-settings');
      await tap(`trip-item-${first!.id}`);
      await expect(store.getState().activeTripId).toBe(first!.id);
      await tap(`delete-trip-${first!.id}`);
      await expect(
        await screen.findByText('All of its spends will be deleted too. This cannot be undone.'),
      ).toBeVisible();
      await userEvent.click(screen.getByTestId('confirm-delete-trip-confirm'));
      await waitFor(() => expect(store.getState().trips).toHaveLength(1));
      await expect(store.getState().activeTripId).toBe(second!.id);
    });
  },
};
