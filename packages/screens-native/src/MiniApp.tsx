/**
 * MiniApp — a router-free app shell: tab bar + modal stack built from the same screens the real
 * app uses.
 *
 * Production navigation is Expo Router (`apps/mobile/app`). This shell exists so that
 * (a) Jest can exercise complete user flows without native navigation, and
 * (b) Storybook can show and replay those same flows in a browser.
 * Screen titles, testIDs and tab labels intentionally match the real app so Maestro E2E flows read the same.
 * @module MiniApp
 */
import { Button, Text, cn } from '@tbc/ui-native';
import * as React from 'react';
import { View } from 'react-native';
import { BillsScreen } from './screens/BillsScreen';
import { CreateTripScreen } from './screens/CreateTripScreen';
import { DayScreen } from './screens/DayScreen';
import { DaysScreen } from './screens/DaysScreen';
import { LogSpendScreen } from './screens/LogSpendScreen';
import { ReceiptReviewScreen } from './screens/ReceiptReviewScreen';
import { ScanScreen } from './screens/ScanScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SummaryScreen } from './screens/SummaryScreen';
import { TodayScreen } from './screens/TodayScreen';

type Tab = 'today' | 'days' | 'bills' | 'summary' | 'settings';
type Route =
  | { name: 'day'; date: string }
  | { name: 'spend-new'; date?: string }
  | { name: 'spend-edit'; id: string }
  | { name: 'trip-new' }
  | { name: 'scan' }
  | { name: 'receipt'; id: string };

const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'days', label: 'Days' },
  { id: 'bills', label: 'Bills' },
  { id: 'summary', label: 'Summary' },
  { id: 'settings', label: 'Settings' },
];

/** Props for {@link MiniApp}. */
export interface MiniAppProps {
  /** Tab to start on. */
  initialTab?: Tab;
}

/**
 * Whole app in one component.
 * @example
 * <BudgetProvider store={store} today="2026-05-03"><MiniApp /></BudgetProvider>
 */
export function MiniApp({ initialTab = 'today' }: MiniAppProps) {
  const [tab, setTab] = React.useState<Tab>(initialTab);
  const [stack, setStack] = React.useState<Route[]>([]);
  const push = (r: Route) => setStack((s) => [...s, r]);
  const pop = () => setStack((s) => s.slice(0, -1));
  const top = stack[stack.length - 1];

  const openSpend = (date?: string) => push({ name: 'spend-new', date });
  const createTrip = () => push({ name: 'trip-new' });

  // A real stack navigator keeps the scan screen alive underneath a bill you opened from it, so the batch list
  // survives the round trip. Mirror that: keep it mounted (hidden) while a receipt is on top.
  const scanOnTop = top?.name === 'scan';
  const scanBelow = top?.name === 'receipt' && stack[stack.length - 2]?.name === 'scan';

  let body: React.ReactNode;
  if (scanOnTop) {
    body = null;
  } else if (top?.name === 'trip-new') {
    body = <CreateTripScreen onDone={() => setStack([])} />;
  } else if (top?.name === 'spend-new') {
    body = <LogSpendScreen initialDate={top.date} onDone={pop} />;
  } else if (top?.name === 'spend-edit') {
    body = <LogSpendScreen spendId={top.id} onDone={pop} />;
  } else if (top?.name === 'receipt') {
    body = <ReceiptReviewScreen receiptId={top.id} onDone={pop} />;
  } else if (top?.name === 'day') {
    body = (
      <DayScreen
        date={top.date}
        onAddSpend={openSpend}
        onOpenSpend={(id) => push({ name: 'spend-edit', id })}
      />
    );
  } else if (tab === 'today') {
    body = (
      <TodayScreen
        onAddSpend={openSpend}
        onOpenSpend={(id) => push({ name: 'spend-edit', id })}
        onOpenDay={(date) => push({ name: 'day', date })}
        onCreateTrip={createTrip}
      />
    );
  } else if (tab === 'days') {
    body = (
      <DaysScreen onOpenDay={(date) => push({ name: 'day', date })} onCreateTrip={createTrip} />
    );
  } else if (tab === 'bills') {
    body = (
      <BillsScreen
        onScan={() => push({ name: 'scan' })}
        onOpenReceipt={(id) => push({ name: 'receipt', id })}
        onCreateTrip={createTrip}
      />
    );
  } else if (tab === 'summary') {
    body = <SummaryScreen onCreateTrip={createTrip} />;
  } else {
    body = <SettingsScreen onCreateTrip={createTrip} />;
  }

  return (
    <View className="flex-1 bg-background" testID="mini-app">
      <View className="flex-1">
        {scanOnTop || scanBelow ? (
          <View key="scan" className={scanOnTop ? 'flex-1' : 'hidden'}>
            <ScanScreen
              onOpenReceipt={(id) => push({ name: 'receipt', id })}
              onDone={pop}
              onCreateTrip={createTrip}
            />
          </View>
        ) : null}
        {body ? (
          <View key="body" className="flex-1">
            {body}
          </View>
        ) : null}
      </View>
      {top ? (
        <View className="border-t border-border bg-card p-2">
          <Button variant="ghost" onPress={pop} testID="nav-back" accessibilityLabel="Back">
            <Text>Back</Text>
          </Button>
        </View>
      ) : (
        <View role="tablist" className="flex-row border-t border-border bg-card pb-2 pt-1">
          {TABS.map((t) => (
            <Button
              key={t.id}
              variant="ghost"
              role="tab"
              aria-selected={tab === t.id}
              onPress={() => setTab(t.id)}
              testID={`tab-${t.id}`}
              className={cn('h-12 flex-1', tab === t.id && 'bg-accent')}
            >
              <Text className={tab === t.id ? 'text-primary' : 'text-muted-foreground'}>
                {t.label}
              </Text>
            </Button>
          ))}
        </View>
      )}
    </View>
  );
}
