/**
 * Navigation smoke tests against the REAL Expo Router route files (app/**).
 * Screens themselves are covered in packages/screens-native; this proves the wiring:
 * tabs, modals, params, deep links, and that persisted data survives a restart.
 */
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { appStore } from '../src/store';

const press = (id: string) => fireEvent.press(screen.getByTestId(id));
const changeText = (id: string, value: string) =>
  fireEvent.changeText(screen.getByTestId(id), value);

beforeEach(() => {
  appStore.getState().actions.reset();
  appStore.getState().actions.setTheme('system');
});

describe('app navigation', () => {
  it('shows the empty state, then opens the new-trip modal', async () => {
    renderRouter('./app');
    expect(await screen.findByTestId('empty-no-trip')).toBeOnTheScreen();
    await press('create-trip-cta');
    expect(await screen.findByTestId('screen-create-trip')).toBeOnTheScreen();
    expect(screen).toHavePathname('/trip/new');
  });

  it('creates a trip and returns to Today', async () => {
    renderRouter('./app');
    await press('create-trip-cta');
    await changeText('trip-name', 'Ljubljana');
    await changeText('trip-budget', '350');
    await press('create-trip-submit');
    await waitFor(() => expect(screen).toHavePathname('/'));
    expect(await screen.findByTestId('allowance-ring')).toBeOnTheScreen();
    expect(screen.getByTestId('allowance-ring-amount')).toHaveTextContent('€50.00');
  });

  it('logs a spend through the modal route and pops back', async () => {
    renderRouter('./app');
    await press('create-trip-cta');
    await changeText('trip-name', 'Bled');
    await changeText('trip-budget', '700');
    await press('create-trip-submit');
    await screen.findByTestId('allowance-ring');

    await press('add-spend');
    expect(screen).toHavePathname('/spend/new');
    await changeText('spend-amount', '25');
    await changeText('spend-note', 'Cream cake');
    await press('save-spend');

    await waitFor(() => expect(screen).toHavePathname('/'));
    expect(await screen.findByText('Cream cake')).toBeOnTheScreen();
    expect(screen.getByTestId('allowance-ring-amount')).toHaveTextContent('€75.00');
  });

  it('switches tabs and opens a day detail with params', async () => {
    renderRouter('./app');
    await press('tab-settings');
    await press('load-demo');
    await press('tab-days');
    expect(await screen.findByTestId('screen-days')).toBeOnTheScreen();
    const day = appStore.getState().trips[0]!.startDate;
    await press(`day-card-${day}`);
    expect(await screen.findByTestId('screen-day')).toBeOnTheScreen();
    expect(screen).toHavePathname(`/day/${day}`);
  });

  it('supports deep links to a spend editor', async () => {
    renderRouter('./app');
    await press('tab-settings');
    await press('load-demo');
    const spend = appStore.getState().spends[0]!;
    renderRouter('./app', { initialUrl: `/spend/${spend.id}` });
    expect(await screen.findByText('Edit spend')).toBeOnTheScreen();
  });

  it('shows the not-found page for unknown links', async () => {
    renderRouter('./app', { initialUrl: '/nope/nothing' });
    expect(await screen.findByText('Page not found')).toBeOnTheScreen();
  });
});

describe('persistence', () => {
  it('data written to AsyncStorage rehydrates a fresh store', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    const { createBudgetStore, seedDemoTrip, todayISO } = require('@tbc/core');
    // expo-router's testing-library installs fake timers, so wait with RNTL's `waitFor`, never `setTimeout`.
    const first = createBudgetStore({ storage: AsyncStorage, name: 'persistence-probe' });
    await waitFor(() => expect(first.persist.hasHydrated()).toBe(true));
    seedDemoTrip(first.getState().actions, todayISO());
    await waitFor(() =>
      expect(AsyncStorage.__INTERNAL_MOCK_STORAGE__['persistence-probe']).toContain('Lisbon'),
    );

    const second = createBudgetStore({ storage: AsyncStorage, name: 'persistence-probe' });
    await waitFor(() => expect(second.persist.hasHydrated()).toBe(true));
    expect(second.getState().trips).toHaveLength(1);
    expect(second.getState().spends).toHaveLength(7);
  });
});
