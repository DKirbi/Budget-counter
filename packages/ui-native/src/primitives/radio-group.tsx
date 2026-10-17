/**
 * RadioGroup + RadioCard.
 * `RadioCard` is a selectable card with title and description — clearer than a bare radio dot when
 * each option needs explaining (e.g. the two overspend policies).
 * @module primitives/radio-group
 */
import * as RadioGroupPrimitive from '@rn-primitives/radio-group';
import * as React from 'react';
import { View } from 'react-native';
import { cn } from '../lib/cn';
import { Text } from './text';

/** Group container (role `radiogroup`). */
export function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root className={cn('gap-2', className)} {...props} />;
}

/** The round indicator on its own. */
export function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      className={cn(
        'aspect-square h-5 w-5 items-center justify-center rounded-full border border-input bg-card',
        props.disabled && 'opacity-50',
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="h-2.5 w-2.5 rounded-full bg-primary" />
    </RadioGroupPrimitive.Item>
  );
}

/** Props for {@link RadioCard}. */
export interface RadioCardProps extends Omit<
  React.ComponentProps<typeof RadioGroupPrimitive.Item>,
  'children'
> {
  title: string;
  description?: string;
  /** Whether this card's value is the group's current value (needed to draw the selected border). */
  selected: boolean;
}

/**
 * Selectable option card. Must live inside a {@link RadioGroup}.
 * @example
 * <RadioCard value="cascade" selected={policy === 'cascade'} title="Cascade" description="Overspend comes off tomorrow." />
 */
export function RadioCard({ title, description, selected, className, ...props }: RadioCardProps) {
  return (
    <RadioGroupPrimitive.Item
      className={cn(
        'min-h-touch flex-row items-start gap-3 rounded-xl border p-3',
        selected ? 'border-primary bg-accent' : 'border-border bg-card',
        props.disabled && 'opacity-50',
        className,
      )}
      {...props}
    >
      <View
        className={cn(
          'mt-0.5 h-5 w-5 items-center justify-center rounded-full border',
          selected ? 'border-primary' : 'border-input',
        )}
      >
        {selected ? <View className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="small" className="leading-5">
          {title}
        </Text>
        {description ? <Text variant="muted">{description}</Text> : null}
      </View>
    </RadioGroupPrimitive.Item>
  );
}
