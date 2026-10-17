/**
 * Test / Storybook helpers for rendering screens with a real (in-memory) store.
 * @module testing
 */
import { type BudgetData, type BudgetStore, type ScanServices } from '@tbc/core';
import { BudgetProvider } from '@tbc/core/react';
import { DEMO_TODAY, createFakeScanServices, createTestStore } from '@tbc/core/testing';
import { renderUI } from '@tbc/ui-native/testing';
import { act } from '@testing-library/react-native';
import * as React from 'react';
import { ScanServicesProvider } from './lib/services';

export {
  DEMO_TODAY,
  RECEIPT_FIXTURES,
  createFakeScanServices,
  createTestStore,
  fixtureImages,
  makeReceipt,
  simpleBillText,
} from '@tbc/core/testing';

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
  /** Scan services (OCR, camera, secrets, fetch). Defaults to an empty fake: nothing readable, no photos. */
  services?: ScanServices;
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
      <ScanServicesProvider services={options.services ?? createFakeScanServices()}>
        {ui}
      </ScanServicesProvider>
    </BudgetProvider>,
  );
  // Let mount-time promises (reading the saved AI key, asking whether OCR exists) settle inside act().
  await act(async () => {
    await Promise.resolve();
  });
  return { ...result, store };
}
