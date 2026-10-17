/**
 * Layout building blocks: Screen (safe-area + scrolling) and ScreenHeader.
 * @module layout
 */
import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { cn } from './lib/cn';
import { Text } from './primitives/text';

/** Props for {@link Screen}. */
export interface ScreenProps {
  children: React.ReactNode;
  /** Wrap children in a ScrollView. Default true. */
  scroll?: boolean;
  /** Which safe-area edges to pad. Tab screens usually omit `bottom`. */
  edges?: Edge[];
  className?: string;
  contentClassName?: string;
  testID?: string;
}

/**
 * Screen container: background, safe-area padding, optional scrolling with keyboard-friendly taps.
 * @example
 * <Screen edges={['top']}><ScreenHeader title="Today" /></Screen>
 */
export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  className,
  contentClassName,
  testID,
}: ScreenProps) {
  return (
    <SafeAreaView edges={edges} className={cn('flex-1 bg-background', className)} testID={testID}>
      {scroll ? (
        <ScrollView
          // Keyboard users must be able to focus a scrollable region that has no focusable content (WCAG 2.1.1).
          tabIndex={0}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName={cn('gap-6 px-4 pb-10 pt-4', contentClassName)}
        >
          {children}
        </ScrollView>
      ) : (
        <View className={cn('flex-1 gap-6 px-4 pt-4', contentClassName)}>{children}</View>
      )}
    </SafeAreaView>
  );
}

/** Props for {@link ScreenHeader}. */
export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-aligned slot, typically an icon button. */
  trailing?: React.ReactNode;
  className?: string;
}

/**
 * Page title row. The title is announced as a heading.
 * @example
 * <ScreenHeader title="Today" subtitle="Day 3 of 7 · Lisbon" trailing={<Button …/>} />
 */
export function ScreenHeader({ title, subtitle, trailing, className }: ScreenHeaderProps) {
  return (
    <View className={cn('flex-row items-start justify-between gap-3', className)}>
      <View className="flex-1 gap-1">
        <Text variant="h1">{title}</Text>
        {subtitle ? <Text variant="muted">{subtitle}</Text> : null}
      </View>
      {trailing}
    </View>
  );
}
