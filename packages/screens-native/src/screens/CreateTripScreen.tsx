/**
 * CreateTripScreen — set up a trip: name, budget, currency, start, length and overspend rule.
 *
 * Validation is shared with the web app via `validateTripForm`; this component only renders fields
 * and shows the messages it returns. A live "about €x a day" preview makes the allowance concrete
 * before the trip exists.
 * @module screens/CreateTripScreen
 */
import {
  CURRENCIES,
  type CurrencyCode,
  type OverspendPolicy,
  type Trip,
  type TripFormValues,
  addDays,
  diffDays,
  formatDayLabel,
  formatMoney,
  parseAmount,
  validateTripForm,
} from '@tbc/core';
import { useBudgetActions, useToday } from '@tbc/core/react';
import {
  AmountInput,
  Button,
  Card,
  CardContent,
  Field,
  Input,
  RadioCard,
  RadioGroup,
  Screen,
  ScreenHeader,
  Stepper,
  Text,
  ToggleGroup,
  ToggleGroupItem,
} from '@tbc/ui-native';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { createResolver } from '../lib/resolver';
import { OVERSPEND_COPY } from '../lib/copy';

/** Props for {@link CreateTripScreen}. */
export interface CreateTripScreenProps {
  /** Called with the created trip (it is already active). */
  onDone: (trip: Trip) => void;
}

/**
 * New trip form.
 * @example
 * <CreateTripScreen onDone={() => router.replace('/')} />
 */
export function CreateTripScreen({ onDone }: CreateTripScreenProps) {
  const actions = useBudgetActions();
  const today = useToday();
  const { control, handleSubmit, watch, setValue, formState } = useForm<TripFormValues>({
    defaultValues: {
      name: '',
      currency: 'EUR',
      budget: '',
      startDate: today,
      days: 7,
      overspendPolicy: 'cascade',
    },
    resolver: createResolver<TripFormValues>(validateTripForm),
  });
  const { errors } = formState;
  const [budget, currency, days, startDate] = watch(['budget', 'currency', 'days', 'startDate']);

  const perDay = React.useMemo(() => {
    const minor = parseAmount(budget, currency);
    return minor && minor > 0 && days > 0 ? Math.floor(minor / days) : null;
  }, [budget, currency, days]);

  const submit = handleSubmit((values) => {
    const result = validateTripForm(values);
    if (result.ok) onDone(actions.createTrip(result.value));
  });

  return (
    <Screen edges={['bottom']} testID="screen-create-trip">
      <ScreenHeader title="New trip" subtitle="Your budget becomes a daily allowance." />

      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <Field label="Trip name" error={errors.name?.message}>
            <Input
              accessibilityLabel="Trip name"
              placeholder="Lisbon long weekend"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              invalid={!!errors.name}
              testID="trip-name"
              returnKeyType="next"
            />
          </Field>
        )}
      />

      <Controller
        control={control}
        name="budget"
        render={({ field }) => (
          <Field
            label="Total budget"
            description="For the whole trip, all spending included."
            error={errors.budget?.message}
          >
            <AmountInput
              accessibilityLabel="Total budget"
              value={field.value}
              onChangeText={field.onChange}
              currency={currency}
              invalid={!!errors.budget}
              testID="trip-budget"
            />
          </Field>
        )}
      />

      <Controller
        control={control}
        name="currency"
        render={({ field }) => (
          <Field label="Currency">
            <ToggleGroup
              type="single"
              value={field.value}
              onValueChange={(v) => v && field.onChange(v as CurrencyCode)}
              accessibilityLabel="Currency"
            >
              {CURRENCIES.map((c) => (
                <ToggleGroupItem
                  key={c.code}
                  value={c.code}
                  accessibilityLabel={c.name}
                  testID={`currency-${c.code}`}
                >
                  <Text>{c.code}</Text>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
        )}
      />

      <Field label="Starts" error={errors.startDate?.message}>
        <Stepper
          label="start day"
          testID="trip-start"
          min={0}
          max={365}
          value={Math.max(0, diffDays(today, startDate))}
          onValueChange={(offset) => setValue('startDate', addDays(today, offset))}
          format={(n) =>
            n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : formatDayLabel(addDays(today, n))
          }
        />
      </Field>

      <Controller
        control={control}
        name="days"
        render={({ field }) => (
          <Field label="Length" error={errors.days?.message}>
            <Stepper
              label="days"
              testID="trip-days"
              min={1}
              max={365}
              value={field.value}
              onValueChange={field.onChange}
              format={(n) => `${n} ${n === 1 ? 'day' : 'days'}`}
            />
          </Field>
        )}
      />

      <Controller
        control={control}
        name="overspendPolicy"
        render={({ field }) => (
          <Field label="If you overspend">
            <RadioGroup
              value={field.value}
              onValueChange={(v) => field.onChange(v as OverspendPolicy)}
              accessibilityLabel="Overspend rule"
            >
              {(Object.keys(OVERSPEND_COPY) as OverspendPolicy[]).map((p) => (
                <RadioCard
                  key={p}
                  value={p}
                  selected={field.value === p}
                  title={OVERSPEND_COPY[p].title}
                  description={OVERSPEND_COPY[p].description}
                  testID={`policy-${p}`}
                />
              ))}
            </RadioGroup>
          </Field>
        )}
      />

      <Card>
        <CardContent className="items-center gap-1">
          <Text variant="caption">Your daily allowance</Text>
          <Text testID="per-day-preview" className="text-3xl font-bold tabular-nums">
            {perDay === null ? '—' : formatMoney(perDay, currency)}
          </Text>
          <Text variant="caption">about, before carry-over</Text>
        </CardContent>
      </Card>

      <View>
        <Button onPress={submit} testID="create-trip-submit">
          <Text>Create trip</Text>
        </Button>
      </View>
    </Screen>
  );
}
