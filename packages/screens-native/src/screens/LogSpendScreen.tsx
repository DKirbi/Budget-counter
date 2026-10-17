/**
 * LogSpendScreen — record (or edit) a spend in as few taps as possible.
 *
 * The amount field is focused first; category is one tap; note and day are optional. A card payment
 * can be split into several tagged parts that must add up exactly to the total. A live hint shows
 * what the day will look like after saving, so overspending is a decision, not a surprise.
 * @module screens/LogSpendScreen
 */
import {
  type SpendFormValues,
  type SpendTag,
  addDays,
  clampDate,
  diffDays,
  formatDayLabel,
  formatMoney,
  parseAmount,
  previewSpend,
  toInputString,
  unassignedAmount,
  validateSpendForm,
} from '@tbc/core';
import {
  useActivePlan,
  useActiveTrip,
  useBudget,
  useBudgetActions,
  useToday,
} from '@tbc/core/react';
import {
  Alert,
  AmountInput,
  Badge,
  Button,
  ConfirmDialog,
  Field,
  Icon,
  Input,
  Screen,
  ScreenHeader,
  Stepper,
  Switch,
  TagPicker,
  Text,
} from '@tbc/ui-native';
import { Plus, Trash2, X } from 'lucide-react-native';
import * as React from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { createResolver } from '../lib/resolver';

/** Props for {@link LogSpendScreen}. */
export interface LogSpendScreenProps {
  /** When set, edits that spend instead of creating a new one. */
  spendId?: string;
  /** Day to preselect when creating. Clamped into the trip. */
  initialDate?: string;
  /** Called after saving or deleting. */
  onDone: () => void;
}

/**
 * Create / edit spend form.
 * @example
 * <LogSpendScreen initialDate="2026-05-03" onDone={() => router.back()} />
 */
export function LogSpendScreen({ spendId, initialDate, onDone }: LogSpendScreenProps) {
  const trip = useActiveTrip();
  const plan = useActivePlan();
  const today = useToday();
  const actions = useBudgetActions();
  const existing = useBudget((s) => (spendId ? s.spends.find((x) => x.id === spendId) : undefined));
  const editing = !!existing;
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const defaultDate = trip
    ? clampDate(existing?.date ?? initialDate ?? today, trip.startDate, trip.endDate)
    : today;
  const ctx = trip
    ? { currency: trip.currency, startDate: trip.startDate, endDate: trip.endDate }
    : null;

  const { control, handleSubmit, watch, setValue, formState } = useForm<SpendFormValues>({
    defaultValues: {
      amount: existing && trip ? toInputString(existing.amount, trip.currency) : '',
      tag: existing?.tag ?? 'food',
      note: existing?.note ?? '',
      date: defaultDate,
      split: false,
      parts: [],
    },
    resolver: createResolver<SpendFormValues>((v) => validateSpendForm(v, ctx!), ['parts']),
  });
  const { fields, replace, append, remove } = useFieldArray({ control, name: 'parts' });
  const { errors } = formState;
  const [amount, date, split, tag, parts] = watch(['amount', 'date', 'split', 'tag', 'parts']);

  if (!trip || !plan || !ctx) {
    return (
      <Screen testID="screen-log-spend">
        <ScreenHeader title="Add spend" />
        <Alert variant="info" title="Create a trip first" description="Spends belong to a trip." />
      </Screen>
    );
  }
  if (spendId && !existing) {
    return (
      <Screen testID="screen-log-spend">
        <ScreenHeader title="Edit spend" />
        <Alert
          variant="destructive"
          title="Spend not found"
          description="It may have been deleted."
        />
      </Screen>
    );
  }

  const total = parseAmount(amount, trip.currency);
  const preview = !editing && total && total > 0 ? previewSpend(plan, date, total) : null;
  const left = split ? unassignedAmount(amount, parts, trip.currency) : null;
  const dayIndex = diffDays(trip.startDate, date);
  const lastIndex = diffDays(trip.startDate, trip.endDate);

  const save = handleSubmit((values) => {
    const result = validateSpendForm(values, ctx);
    if (!result.ok) return;
    const { date: d, note, parts: out } = result.value;
    if (editing && existing) {
      const [only] = out;
      actions.updateSpend(existing.id, { amount: only!.amount, tag: only!.tag, note, date: d });
    } else {
      actions.logSpend({ tripId: trip.id, date: d, note, parts: out });
    }
    onDone();
  });

  const toggleSplit = (on: boolean) => {
    setValue('split', on);
    replace(
      on
        ? [
            { amount: '', tag },
            { amount: '', tag: 'other' },
          ]
        : [],
    );
  };

  return (
    <Screen edges={['bottom']} testID="screen-log-spend">
      <ScreenHeader title={editing ? 'Edit spend' : 'Add spend'} subtitle={trip.name} />

      <Controller
        control={control}
        name="amount"
        render={({ field }) => (
          <Field label={split ? 'Total charged' : 'Amount'} error={errors.amount?.message}>
            <AmountInput
              autoFocus
              accessibilityLabel={split ? 'Total charged' : 'Amount'}
              value={field.value}
              onChangeText={field.onChange}
              currency={trip.currency}
              invalid={!!errors.amount}
              testID="spend-amount"
            />
          </Field>
        )}
      />

      {preview ? (
        <Alert
          testID="spend-preview"
          variant={
            preview.status === 'over'
              ? 'destructive'
              : preview.status === 'near-limit'
                ? 'warning'
                : 'info'
          }
          title={
            preview.remaining < 0
              ? `${formatMoney(-preview.remaining, trip.currency)} over the limit for ${formatDayLabel(date)}`
              : `${formatMoney(preview.remaining, trip.currency)} left on ${formatDayLabel(date)} after this`
          }
        />
      ) : null}

      {!split ? (
        <Field label="Category">
          <Controller
            control={control}
            name="tag"
            render={({ field }) => <TagPicker value={field.value} onValueChange={field.onChange} />}
          />
        </Field>
      ) : null}

      <Controller
        control={control}
        name="note"
        render={({ field }) => (
          <Field label="Note (optional)" error={errors.note?.message}>
            <Input
              accessibilityLabel="Note"
              placeholder="What was it?"
              value={field.value}
              onChangeText={field.onChange}
              testID="spend-note"
            />
          </Field>
        )}
      />

      <Field label="Day" error={errors.date?.message}>
        <Stepper
          label="day"
          testID="spend-day"
          min={0}
          max={lastIndex}
          value={dayIndex}
          onValueChange={(i) => setValue('date', addDays(trip.startDate, i))}
          format={() => `${formatDayLabel(date)}${date === today ? ' · today' : ''}`}
        />
      </Field>

      {!editing ? (
        <View className="flex-row items-center justify-between rounded-xl border border-border bg-card p-3">
          <View className="flex-1 pr-3">
            <Text variant="small" className="leading-5">
              Split this payment
            </Text>
            <Text variant="caption">One card payment, several categories.</Text>
          </View>
          <Switch
            checked={split}
            onCheckedChange={toggleSplit}
            accessibilityLabel="Split this payment"
            testID="split-switch"
          />
        </View>
      ) : null}

      {split ? (
        <View className="gap-3" testID="split-parts">
          {fields.map((f, i) => (
            <View key={f.id} className="gap-2 rounded-xl border border-border bg-card p-3">
              <View className="flex-row items-center gap-2">
                <Text variant="small" className="flex-1">
                  Part {i + 1}
                </Text>
                {fields.length > 2 ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    accessibilityLabel={`Remove part ${i + 1}`}
                    onPress={() => remove(i)}
                    testID={`remove-part-${i}`}
                  >
                    <Icon as={X} size={20} />
                  </Button>
                ) : null}
              </View>
              <Controller
                control={control}
                name={`parts.${i}.amount`}
                render={({ field }) => (
                  <Field label="Amount" error={errors.parts?.[i]?.amount?.message}>
                    <Input
                      accessibilityLabel={`Part ${i + 1} amount`}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      value={field.value}
                      onChangeText={field.onChange}
                      invalid={!!errors.parts?.[i]?.amount}
                      testID={`part-${i}-amount`}
                    />
                  </Field>
                )}
              />
              <Controller
                control={control}
                name={`parts.${i}.tag`}
                render={({ field }) => (
                  <TagPicker
                    compact
                    testIDPrefix={`part-${i}-tag`}
                    value={field.value as SpendTag}
                    onValueChange={field.onChange}
                  />
                )}
              />
            </View>
          ))}
          <View className="flex-row items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onPress={() => append({ amount: '', tag: 'other' })}
              testID="add-part"
            >
              <Icon as={Plus} size={16} />
              <Text>Add part</Text>
            </Button>
            {left !== null ? (
              <Badge testID="split-left" variant={left === 0 ? 'success' : 'warning'}>
                <Text>
                  {left === 0
                    ? 'All assigned'
                    : left > 0
                      ? `${formatMoney(left, trip.currency)} left to assign`
                      : `${formatMoney(-left, trip.currency)} too much`}
                </Text>
              </Badge>
            ) : null}
          </View>
          {errors.parts?.root?.message ? (
            <Text role="alert" className="text-sm text-destructive" testID="parts-error">
              {errors.parts.root.message}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View className="gap-3">
        <Button onPress={save} testID="save-spend">
          <Text>{editing ? 'Save changes' : 'Save spend'}</Text>
        </Button>
        {editing ? (
          <Button variant="outline" onPress={() => setConfirmDelete(true)} testID="delete-spend">
            <Icon as={Trash2} size={20} className="text-destructive" />
            <Text className="text-destructive">Delete spend</Text>
          </Button>
        ) : null}
      </View>

      <ConfirmDialog
        testID="confirm-delete-spend"
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        destructive
        title="Delete this spend?"
        description="Today's balance will be recalculated."
        confirmLabel="Delete"
        onConfirm={() => {
          if (existing) actions.removeSpend(existing.id);
          setConfirmDelete(false);
          onDone();
        }}
      />
    </Screen>
  );
}
