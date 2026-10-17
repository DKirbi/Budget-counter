/**
 * AllowanceRing — the hero of the Today screen: how much of today's available money is left.
 *
 * The ring fills as you spend; colour follows the day status (green → amber → red). The centre
 * shows what is left, or how far over you are, so the key number is readable at a glance.
 * @module domain/allowance-ring
 */
import { formatMoney, type DayStatus } from '@tbc/core';
import * as React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { cn } from '../lib/cn';
import { Text } from '../primitives/text';
import { useTheme } from '../theme/theme';

/** Props for {@link AllowanceRing}. */
export interface AllowanceRingProps {
  /** Money still available today (may be negative). */
  remaining: number;
  /** Everything that could be spent today: base allowance + carry-over. */
  available: number;
  /** Already spent today. */
  spent: number;
  currency: string;
  status: DayStatus;
  /** Outer diameter in dp. */
  size?: number;
  strokeWidth?: number;
  className?: string;
  testID?: string;
}

/** Fraction (0..1) of the available amount already spent. */
export function ringFraction(spent: number, available: number): number {
  if (spent <= 0) return 0;
  if (available <= 0) return 1;
  return Math.min(1, spent / available);
}

/**
 * Circular allowance gauge.
 * @example
 * <AllowanceRing remaining={4200} available={10000} spent={5800} currency="EUR" status="on-track" />
 */
export function AllowanceRing({
  remaining,
  available,
  spent,
  currency,
  status,
  size = 240,
  strokeWidth = 18,
  className,
  testID,
}: AllowanceRingProps) {
  const { colors } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = ringFraction(spent, available);
  const stroke =
    status === 'over'
      ? colors.destructive
      : status === 'near-limit'
        ? colors.warning
        : colors.primary;
  const over = remaining < 0;
  const summary = over
    ? `${formatMoney(-remaining, currency)} over today's limit`
    : `${formatMoney(remaining, currency)} left today`;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Today's allowance"
      aria-valuemin={0}
      aria-valuemax={Math.max(available, 0)}
      aria-valuenow={Math.min(Math.max(spent, 0), Math.max(available, 0))}
      aria-valuetext={`${summary}, ${formatMoney(spent, currency)} of ${formatMoney(available, currency)} spent`}
      testID={testID}
      className={cn('items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ position: 'absolute' }}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.muted}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {fraction > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={stroke}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference * fraction} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <View className="items-center gap-0.5 px-8">
        <Text variant="caption" className="uppercase tracking-wide">
          {over ? 'Over by' : 'Left today'}
        </Text>
        <Text
          className={cn(
            'text-4xl font-bold tabular-nums',
            over ? 'text-destructive' : 'text-foreground',
          )}
          testID={testID ? `${testID}-amount` : undefined}
        >
          {formatMoney(Math.abs(remaining), currency)}
        </Text>
        <Text variant="muted" testID={testID ? `${testID}-caption` : undefined}>
          of {formatMoney(Math.max(available, 0), currency)}
        </Text>
      </View>
    </View>
  );
}
