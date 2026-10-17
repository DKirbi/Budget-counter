/**
 * Stepper — "− value +" control for small integers (trip length, day offset). Chosen over a date
 * picker for the MVP: it works identically on native and web, and one-thumb operation matters more
 * than calendar browsing for a 1–30 day trip.
 * @module primitives/stepper
 */
import { Minus, Plus } from 'lucide-react-native';
import * as React from 'react';
import { Platform, View } from 'react-native';
import { cn } from '../lib/cn';
import { Button } from './button';
import { Icon } from './icon';
import { Text } from './text';

/** Props for {@link Stepper}. */
export interface StepperProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Noun used in labels, e.g. "days" -> "Decrease days". */
  label: string;
  /** Custom text for the current value, e.g. `7 days`. */
  format?: (value: number) => string;
  className?: string;
  testID?: string;
}

/**
 * Integer stepper with accessible increment/decrement actions.
 * @example
 * <Stepper label="days" value={days} onValueChange={setDays} min={1} max={90} format={(n) => `${n} days`} />
 */
export function Stepper({
  value,
  onValueChange,
  min = 0,
  max = 999,
  step = 1,
  label,
  format,
  className,
  testID,
}: StepperProps) {
  const set = (next: number) => onValueChange(Math.max(min, Math.min(max, next)));
  const text = format ? format(value) : String(value);
  // Native: one "adjustable" element (swipe up/down); the +/- buttons are then reachable as custom actions only.
  // Web: `role="slider"` may not contain focusable buttons (nested-interactive), so expose a plain labelled group.
  const semantics =
    Platform.OS === 'web'
      ? ({ role: 'group', 'aria-label': label } as const)
      : ({
          accessible: true,
          accessibilityRole: 'adjustable',
          accessibilityLabel: label,
          accessibilityValue: { min, max, now: value, text },
          accessibilityActions: [{ name: 'increment' }, { name: 'decrement' }],
          onAccessibilityAction: (e: { nativeEvent: { actionName: string } }) =>
            set(value + (e.nativeEvent.actionName === 'increment' ? step : -step)),
        } as const);
  return (
    <View
      {...semantics}
      testID={testID}
      className={cn(
        'flex-row items-center justify-between rounded-lg border border-input bg-card p-1',
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        accessibilityLabel={`Decrease ${label}`}
        disabled={value <= min}
        onPress={() => set(value - step)}
        testID={testID ? `${testID}-decrease` : undefined}
      >
        <Icon as={Minus} size={20} />
      </Button>
      <Text variant="numeric" aria-live="polite" testID={testID ? `${testID}-value` : undefined}>
        {text}
      </Text>
      <Button
        variant="ghost"
        size="icon"
        accessibilityLabel={`Increase ${label}`}
        disabled={value >= max}
        onPress={() => set(value + step)}
        testID={testID ? `${testID}-increase` : undefined}
      >
        <Icon as={Plus} size={20} />
      </Button>
    </View>
  );
}
