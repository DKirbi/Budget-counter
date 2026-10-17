/**
 * AmountInput — the big, thumb-friendly number field for logging money.
 * Shows the currency symbol, opens the decimal keypad and selects its text on focus so a correction
 * is one tap and a retype.
 * @module domain/amount-input
 */
import { currencySymbol } from '@tbc/core';
import * as React from 'react';
import { TextInput, View } from 'react-native';
import { cn } from '../lib/cn';
import { Text } from '../primitives/text';

/** Props for {@link AmountInput}. */
export interface AmountInputProps {
  value: string;
  onChangeText: (text: string) => void;
  currency: string;
  invalid?: boolean;
  autoFocus?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  className?: string;
}

/**
 * Large currency input.
 * @example
 * <AmountInput value={amount} onChangeText={setAmount} currency="EUR" accessibilityLabel="Amount" autoFocus />
 */
export const AmountInput = React.forwardRef<TextInput, AmountInputProps>(function AmountInput(
  {
    value,
    onChangeText,
    currency,
    invalid,
    autoFocus,
    accessibilityLabel = 'Amount',
    testID,
    className,
  },
  ref,
) {
  return (
    <View
      className={cn(
        'h-20 flex-row items-center justify-center gap-2 rounded-2xl border-2 bg-card px-4',
        invalid ? 'border-destructive' : 'border-input',
        className,
      )}
    >
      {/* Decorative: the input's own label already says "Amount" and the currency is announced with the value. */}
      <Text
        aria-hidden
        importantForAccessibility="no-hide-descendants"
        className="min-w-8 text-3xl font-semibold text-muted-foreground"
      >
        {currencySymbol(currency)}
      </Text>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholder="0.00"
        placeholderClassName="text-muted-foreground/60"
        keyboardType="decimal-pad"
        inputMode="decimal"
        selectTextOnFocus
        autoFocus={autoFocus}
        accessibilityLabel={accessibilityLabel}
        aria-invalid={invalid || undefined}
        testID={testID}
        className="min-w-24 flex-1 p-0 text-4xl font-bold tabular-nums text-foreground"
      />
    </View>
  );
});
