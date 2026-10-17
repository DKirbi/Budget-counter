/**
 * Tabs + SegmentedControl.
 * `Tabs*` is the shadcn API (list of triggers, content panels). `SegmentedControl` is the compact
 * "pick one of N" control used for theme, currency-style choices and the overspend policy.
 * @module primitives/tabs
 */
import * as TabsPrimitive from '@rn-primitives/tabs';
import * as React from 'react';
import { cn } from '../lib/cn';
import { Text, TextClassContext } from './text';

/** Tab root; controlled via `value` / `onValueChange`. */
export const Tabs = TabsPrimitive.Root;

/** Row that holds the triggers. */
export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('flex h-11 flex-row items-center rounded-lg bg-muted p-1', className)}
      {...props}
    />
  );
}

/** A single tab button. Highlights itself when it matches the root value. */
export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const { value } = TabsPrimitive.useRootContext();
  const active = props.value === value;
  return (
    <TextClassContext.Provider
      value={cn('text-sm font-medium', active ? 'text-foreground' : 'text-muted-foreground')}
    >
      <TabsPrimitive.Trigger
        className={cn(
          'h-full flex-1 flex-row items-center justify-center rounded-md px-3',
          active && 'bg-card shadow-sm',
          props.disabled && 'opacity-50',
          className,
        )}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

/** Panel shown while its `value` is active. */
export function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn(className)} {...props} />;
}

/** One option of a {@link SegmentedControl}. */
export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  testID?: string;
}

/** Props for {@link SegmentedControl}. */
export interface SegmentedControlProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  /** Announced by screen readers as the group name. */
  accessibilityLabel?: string;
  className?: string;
  testID?: string;
}

/**
 * Compact single-choice control.
 * @example
 * <SegmentedControl value={theme} onValueChange={setTheme} accessibilityLabel="Theme"
 *   options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
 */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  accessibilityLabel,
  className,
  testID,
}: SegmentedControlProps<T>) {
  return (
    <Tabs value={value} onValueChange={(v) => onValueChange(v as T)} testID={testID}>
      <TabsList accessibilityLabel={accessibilityLabel} className={className}>
        {options.map((o) => (
          // A segmented control has no panels; Radix would point `aria-controls` at a missing id (invalid ARIA).
          <TabsTrigger
            key={o.value}
            value={o.value}
            testID={o.testID ?? `segment-${o.value}`}
            {...({ 'aria-controls': undefined } as object)}
          >
            <Text>{o.label}</Text>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
