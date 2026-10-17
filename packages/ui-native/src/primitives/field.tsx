/**
 * Field — label + control + helper/error text, laid out consistently.
 * Errors render with `role="alert"` so they are announced when validation fails.
 * @module primitives/field
 */
import * as React from 'react';
import { View } from 'react-native';
import { cn } from '../lib/cn';
import { Label } from './label';
import { Text } from './text';

/** Props for {@link Field}. */
export interface FieldProps {
  label: string;
  /** Helper text, hidden while an error is shown. */
  description?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
  testID?: string;
}

/**
 * Form field wrapper.
 * @example
 * <Field label="Budget" error={errors.budget}><Input value={budget} onChangeText={setBudget} accessibilityLabel="Budget" /></Field>
 */
export function Field({ label, description, error, children, className, testID }: FieldProps) {
  return (
    <View className={cn('gap-1.5', className)} testID={testID}>
      <Label>{label}</Label>
      {children}
      {error ? (
        <Text
          role="alert"
          className="text-sm text-destructive"
          testID={testID ? `${testID}-error` : undefined}
        >
          {error}
        </Text>
      ) : description ? (
        <Text variant="caption">{description}</Text>
      ) : null}
    </View>
  );
}
