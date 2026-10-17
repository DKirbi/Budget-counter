/**
 * Test / Storybook helpers for rendering screens with a real (in-memory) store.
 * @module testing
 */
import { type BudgetData, type BudgetStore } from '@tbc/core';
import { BudgetProvider } from '@tbc/core/react';
import { DEMO_TODAY, createTestStore } from '@tbc/core/testing';
import { renderUI } from '@tbc/ui-native/testing';
import * as React from 'react';

export { DEMO_TODAY, createTestStore } from '@tbc/core/testing';

/** Options for {@link renderWithStore}. */
export interface RenderWithStoreOptions {
  /** Start with the Lisbon demo data (day 3 of 7). */
  demo?: boolean;
  /** Custom seed data. */
  initial?: Partial<BudgetData>;
  /** Use an existing store (to assert on state after the render). */
  store?: BudgetStore;
  /** Frozen "today". Defaults to {@link DEMO_TODAY}. */
  today?: string;
}

/**
 * Render UI inside a `BudgetProvider` with a fresh in-memory store.
 * @returns RNTL's result plus the `store`, so tests can read state after interacting.
 * @example
 * const { store } = await renderWithStore(<MiniApp />, { demo: true });
 * expect(store.getState().spends).toHaveLength(7);
 */
export async function renderWithStore(
  ui: React.ReactElement,
  options: RenderWithStoreOptions = {},
) {
  const store = options.store ?? createTestStore({ demo: options.demo, initial: options.initial });
  const result = await renderUI(
    <BudgetProvider store={store} today={options.today ?? DEMO_TODAY}>
      {ui}
    </BudgetProvider>,
  );
  return { ...result, store };
}
