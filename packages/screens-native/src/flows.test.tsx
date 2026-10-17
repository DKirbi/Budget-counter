/**
 * End-to-end user flows, driven through the real screens, real store and real allowance engine —
 * only the router is replaced (MiniApp). Each `describe` is a named flow (F1…F10) that is mirrored
 * 1:1 by a Storybook play function and a Maestro YAML; see docs/TESTING.md for the matrix.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { computeTripPlan } from '@tbc/core';
import { makeSpend, makeTrip } from '@tbc/core/testing';
import * as React from 'react';
import { MiniApp } from './MiniApp';
import { renderWithStore } from './testing';

const press = (id: string) => fireEvent.press(screen.getByTestId(id));
const type = (id: string, text: string) => fireEvent.changeText(screen.getByTestId(id), text);
const text = (id: string) => within(screen.getByTestId(id));

/** Type an amount, pick a tag, save. */
async function logSpend(amount: string, tag: string, note?: string) {
  await press('add-spend');
  await type('spend-amount', amount);
  await press(`tag-${tag}`);
  if (note) await type('spend-note', note);
  await press('save-spend');
}

describe('F1 · First run: empty state → create a trip', () => {
  it('walks a new user from nothing to a daily allowance', async () => {
    const { store } = await renderWithStore(<MiniApp />);
    expect(screen.getByTestId('empty-no-trip')).toBeOnTheScreen();

    await press('create-trip-cta');
    await type('trip-name', 'Lisbon');
    await type('trip-budget', '700');
    expect(screen.getByTestId('per-day-preview')).toHaveTextContent('€100.00');
    await press('create-trip-submit');

    // Lands on Today with the ring showing the full first-day allowance.
    await waitFor(() => expect(screen.getByTestId('allowance-ring')).toBeOnTheScreen());
    expect(screen.getByTestId('allowance-ring-amount')).toHaveTextContent('€100.00');
    expect(store.getState().trips[0]).toMatchObject({
      name: 'Lisbon',
      totalBudget: 70_000,
      currency: 'EUR',
      overspendPolicy: 'cascade',
      startDate: '2026-05-03',
      endDate: '2026-05-09',
    });
  });

  it('honours currency, length and start-day choices', async () => {
    const { store } = await renderWithStore(<MiniApp />);
    await press('create-trip-cta');
    await type('trip-name', 'Tokyo');
    await press('currency-JPY');
    await type('trip-budget', '210000');
    await press('trip-days-increase'); // 8
    await press('trip-days-increase'); // 9
    await press('trip-days-increase'); // 10
    await press('trip-start-increase'); // tomorrow
    expect(screen.getByTestId('trip-start-value')).toHaveTextContent('Tomorrow');
    expect(screen.getByTestId('per-day-preview')).toHaveTextContent(/21,000/);
    await press('create-trip-submit');
    await waitFor(() => expect(store.getState().trips).toHaveLength(1));
    expect(store.getState().trips[0]).toMatchObject({
      currency: 'JPY',
      totalBudget: 210_000,
      startDate: '2026-05-04',
      endDate: '2026-05-13',
    });
  });
});

describe('F2 · Validation: create-trip errors are explained, then fixed', () => {
  it('shows every problem at once and clears them when the form is valid', async () => {
    const { store } = await renderWithStore(<MiniApp />);
    await press('create-trip-cta');
    await press('create-trip-submit');

    expect(await screen.findByText('Give your trip a name')).toBeOnTheScreen();
    expect(screen.getByText('Enter an amount, like 450 or 450.50')).toBeOnTheScreen();
    expect(store.getState().trips).toHaveLength(0);

    await type('trip-name', 'Porto');
    await type('trip-budget', '0');
    await press('create-trip-submit');
    expect(await screen.findByText('Budget must be more than zero')).toBeOnTheScreen();

    await type('trip-budget', '450,50'); // European decimal comma
    await press('create-trip-submit');
    await waitFor(() => expect(store.getState().trips).toHaveLength(1));
    expect(store.getState().trips[0]?.totalBudget).toBe(45_050);
  });
});

describe('F3 · Log a spend: balance updates immediately', () => {
  it('subtracts the spend, lists it under Today and keeps the ring in sync', async () => {
    const { store } = await renderWithStore(<MiniApp />, { demo: true });
    // Demo day 3: 20 000 carried… day 1 saved 0? see plan below.
    const before = computeTripPlan(
      store.getState().trips[0]!,
      store.getState().spends,
      '2026-05-03',
    ).today!;

    await logSpend('12,50', 'food', 'Espresso');

    await waitFor(() => expect(screen.getByText('Espresso')).toBeOnTheScreen());
    const after = computeTripPlan(
      store.getState().trips[0]!,
      store.getState().spends,
      '2026-05-03',
    ).today!;
    expect(after.remaining).toBe(before.remaining - 1_250);
    expect(screen.getByTestId('allowance-ring')).toHaveAccessibilityValue({ now: after.spent });
    expect(store.getState().spends).toHaveLength(8);
    expect(store.getState().spends.at(-1)).toMatchObject({
      amount: 1_250,
      tag: 'food',
      note: 'Espresso',
      date: '2026-05-03',
    });
  });

  it('rejects an empty amount and keeps the form open', async () => {
    const { store } = await renderWithStore(<MiniApp />, { demo: true });
    await press('add-spend');
    await press('save-spend');
    expect(await screen.findByText('Enter an amount, like 12 or 12.50')).toBeOnTheScreen();
    expect(store.getState().spends).toHaveLength(7);
  });

  it('previews the effect before saving, including going over', async () => {
    await renderWithStore(<MiniApp />, {
      initial: {
        trips: [makeTrip({ startDate: '2026-05-03', endDate: '2026-05-09' })],
        activeTripId: 'trip-1',
      },
    });
    await press('add-spend');
    await type('spend-amount', '20');
    expect(text('spend-preview').getByText(/€80\.00 left on/)).toBeOnTheScreen();
    await type('spend-amount', '130');
    expect(text('spend-preview').getByText(/€30\.00 over the limit/)).toBeOnTheScreen();
  });
});

describe('F4 · Overspend cascades into tomorrow', () => {
  it("turns Today red, explains it, and lowers tomorrow's allowance", async () => {
    const trip = makeTrip({ startDate: '2026-05-03', endDate: '2026-05-09' });
    const { store } = await renderWithStore(<MiniApp />, {
      initial: { trips: [trip], activeTripId: trip.id },
    });

    await logSpend('125', 'activities', 'Concert');

    await waitFor(() => expect(screen.getByTestId('day-message')).toBeOnTheScreen());
    expect(text('day-message').getByText("You're €25.00 over today's limit")).toBeOnTheScreen();
    expect(text('day-message').getByText(/tomorrow's allowance/)).toBeOnTheScreen();
    expect(screen.getByText('Over by')).toBeOnTheScreen();
    expect(screen.getByTestId('allowance-ring-amount')).toHaveTextContent('€25.00');

    const tomorrow = computeTripPlan(
      store.getState().trips[0]!,
      store.getState().spends,
      '2026-05-03',
    ).days[1]!;
    expect(tomorrow).toMatchObject({ carryIn: -2_500, available: 7_500 });

    // Days tab shows the debt on tomorrow's card.
    await press('tab-days');
    expect(
      within(screen.getByTestId('day-card-2026-05-04')).getByText('Debt carried in'),
    ).toBeOnTheScreen();
  });
});

describe('F5 · Switch the overspend rule to "spread it out"', () => {
  it('changes how the same overspend affects the following days', async () => {
    const trip = makeTrip({ startDate: '2026-05-03', endDate: '2026-05-09' });
    const { store } = await renderWithStore(<MiniApp />, {
      initial: {
        trips: [trip],
        activeTripId: trip.id,
        spends: [makeSpend({ date: '2026-05-03', amount: 16_000 })],
      },
    });

    await press('tab-settings');
    await press('settings-policy-redistribute');
    expect(store.getState().trips[0]?.overspendPolicy).toBe('redistribute');

    const plan = computeTripPlan(store.getState().trips[0]!, store.getState().spends, '2026-05-03');
    expect(plan.days[1]).toMatchObject({ carryIn: 0, base: 9_000, available: 9_000 });

    await press('tab-today');
    expect(text('day-message').getByText(/spread over the remaining 6 days/)).toBeOnTheScreen();
  });
});

describe('F6 · Split a card payment into tagged parts', () => {
  it('requires the parts to add up, then saves separate spends', async () => {
    const { store } = await renderWithStore(<MiniApp />, { demo: true });
    await press('add-spend');
    await type('spend-amount', '40');
    await press('split-switch');
    expect(screen.getByTestId('split-parts')).toBeOnTheScreen();
    expect(screen.getByTestId('split-left')).toHaveTextContent('€40.00 left to assign');

    await type('part-0-amount', '25');
    await press('part-0-tag-food');
    await type('part-1-amount', '10');
    await press('part-1-tag-groceries');
    expect(screen.getByTestId('split-left')).toHaveTextContent('€5.00 left to assign');

    await press('save-spend');
    expect(await screen.findByTestId('parts-error')).toHaveTextContent('€5.00 left to assign');
    expect(store.getState().spends).toHaveLength(7); // nothing saved yet

    await type('part-1-amount', '15');
    expect(screen.getByTestId('split-left')).toHaveTextContent('All assigned');
    await press('save-spend');

    await waitFor(() => expect(store.getState().spends).toHaveLength(9));
    const [a, b] = store.getState().spends.slice(-2);
    expect([a?.amount, a?.tag, b?.amount, b?.tag]).toEqual([2_500, 'food', 1_500, 'groceries']);
    expect(a?.splitGroupId).toBeTruthy();
    expect(a?.splitGroupId).toBe(b?.splitGroupId);
    expect(screen.getAllByText('Split')).toHaveLength(2);
  });

  it('lets you add and remove parts', async () => {
    await renderWithStore(<MiniApp />, { demo: true });
    await press('add-spend');
    await press('split-switch');
    expect(screen.queryByTestId('remove-part-0')).toBeNull(); // two parts minimum
    await press('add-part');
    expect(screen.getByTestId('part-2-amount')).toBeOnTheScreen();
    await press('remove-part-2');
    expect(screen.queryByTestId('part-2-amount')).toBeNull();
  });
});

describe('F7 · Edit and delete a spend', () => {
  it('edits amount and category from the Today list', async () => {
    const { store } = await renderWithStore(<MiniApp />, { demo: true });
    const target = store.getState().spends.find((s) => s.note === 'Lunch')!;

    await press(`spend-row-${target.id}`);
    expect(screen.getByText('Edit spend')).toBeOnTheScreen();
    expect(screen.getByTestId('spend-amount').props.value).toBe('18.00');
    await type('spend-amount', '22.40');
    await press('tag-groceries');
    await press('save-spend');

    await waitFor(() =>
      expect(store.getState().spends.find((s) => s.id === target.id)).toMatchObject({
        amount: 2_240,
        tag: 'groceries',
      }),
    );
    expect(await screen.findByText('€22.40')).toBeOnTheScreen();
  });

  it('asks for confirmation before deleting, and cancel changes nothing', async () => {
    const { store } = await renderWithStore(<MiniApp />, { demo: true });
    const target = store.getState().spends.find((s) => s.note === 'Tram 28')!;

    await press(`spend-row-${target.id}`);
    await press('delete-spend');
    expect(await screen.findByText('Delete this spend?')).toBeOnTheScreen();
    await press('confirm-delete-spend-cancel');
    expect(store.getState().spends).toHaveLength(7);

    await press('delete-spend');
    await press('confirm-delete-spend-confirm');
    await waitFor(() => expect(store.getState().spends).toHaveLength(6));
    expect(screen.queryByText('Tram 28')).toBeNull();
  });
});

describe('F8 · Explore days and log against another day', () => {
  it('opens a past day from the Days tab and logs a forgotten spend there', async () => {
    const { store } = await renderWithStore(<MiniApp />, { demo: true });
    await press('tab-days');
    await press('day-card-2026-05-01');
    expect(screen.getByTestId('screen-day')).toBeOnTheScreen();
    expect(screen.getByText('Pastéis de nata')).toBeOnTheScreen();

    await press('add-spend-day');
    await type('spend-amount', '3');
    await press('save-spend');
    await waitFor(() => expect(store.getState().spends).toHaveLength(8));
    expect(store.getState().spends.at(-1)?.date).toBe('2026-05-01');
  });

  it('moves the date with the day stepper and blocks leaving the trip', async () => {
    await renderWithStore(<MiniApp />, { demo: true });
    await press('add-spend');
    expect(screen.getByTestId('spend-day-value')).toHaveTextContent(/today/);
    await press('spend-day-decrease');
    expect(screen.getByTestId('spend-day-value')).not.toHaveTextContent(/today/);
    await press('spend-day-decrease');
    expect(screen.getByLabelText('Decrease day')).toBeDisabled(); // first day of the trip
  });
});

describe('F9 · Summary reflects the trip', () => {
  it('shows totals, pace, breakdown and highlights for the demo trip', async () => {
    await renderWithStore(<MiniApp />, { demo: true });
    await press('tab-summary');

    expect(text('stat-spent').getByText('€271.00')).toBeOnTheScreen();
    expect(text('stat-remaining').getByText('€429.00')).toBeOnTheScreen();
    expect(text('stat-average').getByText('€90.33')).toBeOnTheScreen();
    expect(text('stat-projected').getByText('€632.31')).toBeOnTheScreen();
    expect(text('pace-alert').getByText('€29.00 ahead of plan')).toBeOnTheScreen();

    // Largest category first: food (€96.50) then activities (€95.00).
    expect(screen.getByTestId('category-food')).toBeOnTheScreen();
    expect(screen.getByTestId('category-activities')).toBeOnTheScreen();
    expect(screen.queryByTestId('category-stay')).toBeNull();

    expect(screen.getByTestId('best-day')).toHaveTextContent(/€15\.50 under/);
    expect(screen.getByTestId('worst-day')).toHaveTextContent(/€59\.00 over/);
    expect(screen.queryByTestId('streak')).toBeNull(); // the overspent day 2 broke the streak
  });

  it('tells a brand-new user there is nothing to summarise yet', async () => {
    await renderWithStore(<MiniApp />);
    await press('tab-summary');
    expect(screen.getByText('Nothing to summarise')).toBeOnTheScreen();
  });

  it('warns when the projected total exceeds the budget', async () => {
    const trip = makeTrip({ startDate: '2026-05-01', endDate: '2026-05-07' });
    await renderWithStore(<MiniApp />, {
      initial: {
        trips: [trip],
        activeTripId: trip.id,
        spends: [
          makeSpend({ date: '2026-05-01', amount: 30_000 }),
          makeSpend({ date: '2026-05-02', amount: 30_000 }),
        ],
      },
    });
    await press('tab-summary');
    expect(text('pace-alert').getByText(/behind plan/)).toBeOnTheScreen();
    expect(screen.getByTestId('stat-projected').props.accessibilityLabel).toContain('At this pace');
  });
});

describe('F10 · Settings: theme, trips, demo data, deleting', () => {
  it('changes and persists the theme preference', async () => {
    const { store } = await renderWithStore(<MiniApp />);
    await press('tab-settings');
    await press('theme-dark');
    expect(store.getState().settings.theme).toBe('dark');
    expect(screen.getByRole('tab', { name: 'Dark' })).toBeSelected();
  });

  it('loads demo data, switches between trips, and deletes one after confirming', async () => {
    const { store } = await renderWithStore(<MiniApp />);
    await press('tab-settings');
    await press('load-demo');
    expect(store.getState().trips).toHaveLength(1);
    await press('new-trip');
    await type('trip-name', 'Second');
    await type('trip-budget', '100');
    await press('create-trip-submit');
    await waitFor(() => expect(store.getState().trips).toHaveLength(2));

    const [first, second] = store.getState().trips;
    expect(store.getState().activeTripId).toBe(second!.id);
    await press('tab-settings');
    await press(`trip-item-${first!.id}`);
    expect(store.getState().activeTripId).toBe(first!.id);

    await press(`delete-trip-${first!.id}`);
    expect(
      await screen.findByText('All of its spends will be deleted too. This cannot be undone.'),
    ).toBeOnTheScreen();
    await press('confirm-delete-trip-confirm');
    await waitFor(() => expect(store.getState().trips).toHaveLength(1));
    expect(store.getState().spends).toHaveLength(0);
    expect(store.getState().activeTripId).toBe(second!.id);
  });

  it('erases everything only after confirmation', async () => {
    const { store } = await renderWithStore(<MiniApp />, { demo: true });
    await press('tab-settings');
    await press('reset-data');
    await press('confirm-reset-cancel');
    expect(store.getState().trips).toHaveLength(1);
    await press('reset-data');
    await press('confirm-reset-confirm');
    await waitFor(() => expect(store.getState().trips).toHaveLength(0));
  });
});
