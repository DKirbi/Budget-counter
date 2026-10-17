/**
 * Global decorators + parameters.
 *
 * Every story is wrapped, outermost first, by:
 *  1. `withTheme`    — the toolbar's Light/Dark switch (same NativeWind colour-scheme API the phone uses),
 *  2. `withBudget`   — a fresh in-memory `BudgetStore` per story render, seeded from `parameters.budget`, plus fake
 *                      device services (OCR text per photo, camera/library, secret store, AI `fetch`) from `parameters.scan`,
 *  3. `withFrame`    — sizes the canvas like a phone screen or a card, from `parameters.frame`.
 */
import type { Decorator, Preview } from '@storybook/react-native-web-vite';
import { BudgetProvider } from '@tbc/core/react';
import {
  DEMO_TODAY,
  type FakeScanOptions,
  createFakeScanServices,
  createTestStore,
  type StoryLoaded,
  type TestStoreOptions,
} from '@tbc/core/testing';
import { ScanServicesProvider } from '@tbc/screens-native';
import { UIProvider } from '@tbc/ui-native';
import * as React from 'react';
import './storybook.css';

/** Per-story options, set with `parameters: { budget: {...}, frame: '...' }`. */
declare module 'storybook/internal/csf' {
  interface Parameters {
    /** Seed for the in-memory store. `demo: true` = the Lisbon trip, day 3 of 7. Default: empty app. */
    budget?: TestStoreOptions & { today?: string };
    /**
     * Behaviour of the fake scan services: which text each photo "reads" as, what the library returns, whether OCR
     * exists, what the AI service answers. Default: nothing readable, no photos, AI unreachable.
     */
    scan?: FakeScanOptions;
    /**
     * `phone` — 390×780 device frame (screens & flows), `card` — 360px wide surface (components),
     * `wide` — full width (token docs), `none` — no wrapper.
     */
    frame?: 'phone' | 'card' | 'wide' | 'none';
  }
}

/** Fixed metrics so the first paint is not empty (see `UIProvider.initialSafeAreaMetrics`). */
const SAFE_AREA = {
  frame: { x: 0, y: 0, width: 390, height: 780 },
  insets: { top: 24, left: 0, right: 0, bottom: 0 },
};

const withTheme: Decorator = (Story, context) => {
  const theme = (context.globals.theme as 'light' | 'dark') ?? 'light';
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  return (
    <UIProvider themePreference={theme} initialSafeAreaMetrics={SAFE_AREA}>
      {Story()}
    </UIProvider>
  );
};

const withBudget: Decorator = (Story, context) => {
  const { store, services } = context.loaded as StoryLoaded;
  return (
    <BudgetProvider store={store} today={context.parameters.budget?.today ?? DEMO_TODAY}>
      <ScanServicesProvider services={services}>{Story()}</ScanServicesProvider>
    </BudgetProvider>
  );
};

const FRAMES = {
  phone: {
    width: 390,
    height: 780,
    border: '1px solid hsl(var(--border))',
    borderRadius: 28,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  card: { width: 360, maxWidth: '100%', padding: 16 },
  wide: { width: '100%' },
  none: {},
} as const;

const withFrame: Decorator = (Story, context) => {
  const frame = context.parameters.frame ?? 'card';
  return (
    <div
      data-frame={frame}
      style={{
        background: 'hsl(var(--background))',
        color: 'hsl(var(--foreground))',
        ...FRAMES[frame],
      }}
    >
      {Story()}
    </div>
  );
};

const preview: Preview = {
  // Order matters: the first decorator is the innermost wrapper.
  decorators: [withFrame, withBudget, withTheme],
  loaders: [
    async ({ parameters }): Promise<StoryLoaded> => ({
      store: createTestStore(parameters.budget),
      services: createFakeScanServices(parameters.scan),
    }),
  ],
  tags: ['autodocs'],
  initialGlobals: { theme: 'light' },
  globalTypes: {
    theme: {
      description: 'Colour scheme (design tokens: semantic/light.json ↔ semantic/dark.json)',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        dynamicTitle: true,
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
        ],
      },
    },
  },
  parameters: {
    layout: 'centered',
    controls: { expanded: true, matchers: { date: /Date$/i } },
    backgrounds: { disabled: true },
    a11y: { test: 'error' },
    options: {
      storySort: {
        order: [
          'Introduction',
          'Foundations',
          ['Colors', 'Typography', 'Spacing & Radius', 'Elevation & Motion'],
          'Primitives',
          'Domain',
          'Screens',
          'Flows',
        ],
      },
    },
    docs: { toc: true },
  },
};

export default preview;
