/**
 * MoneyText — formats minor units with the trip currency. Use it for every amount so rounding,
 * symbol and sign rules are identical everywhere.
 * @module domain/money-text
 */
import { formatMoney } from '@tbc/core';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../lib/cn';
import { Text, type TextProps } from '../primitives/text';

const moneyVariants = cva('font-semibold tabular-nums', {
  variants: {
    size: {
      sm: 'text-sm',
      base: 'text-base',
      lg: 'text-xl',
      xl: 'text-3xl',
      display: 'text-5xl font-bold',
    },
    tone: {
      default: 'text-foreground',
      muted: 'text-muted-foreground',
      positive: 'text-success',
      negative: 'text-destructive',
      /** Red when below zero, otherwise default. */
      auto: '',
    },
  },
  defaultVariants: { size: 'base', tone: 'default' },
});

/** Props for {@link MoneyText}. */
export type MoneyTextProps = Omit<TextProps, 'children' | 'variant'> &
  VariantProps<typeof moneyVariants> & {
    /** Integer minor units. */
    amount: number;
    /** ISO currency code. */
    currency: string;
    /** Prefix positive amounts with `+`. */
    signed?: boolean;
    /** Drop `.00` on whole amounts. */
    compact?: boolean;
  };

/**
 * Money label.
 * @example
 * <MoneyText amount={-1250} currency="EUR" tone="auto" size="lg" />  // "-€12.50" in red
 */
export function MoneyText({
  amount,
  currency,
  signed,
  compact,
  size,
  tone = 'default',
  className,
  ...props
}: MoneyTextProps) {
  const resolvedTone = tone === 'auto' ? (amount < 0 ? 'negative' : 'default') : tone;
  return (
    <Text className={cn(moneyVariants({ size, tone: resolvedTone }), className)} {...props}>
      {formatMoney(amount, currency, { signed, compact })}
    </Text>
  );
}
