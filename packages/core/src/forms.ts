/**
 * Form validation shared by every client.
 *
 * Inputs are what a person actually typed (strings), outputs are domain inputs in minor units.
 * Validation lives here — not in components — so the React Native app, the future web app and
 * the tests all enforce exactly the same rules and show exactly the same messages.
 * @module forms
 */
import { z } from 'zod';
import { type ISODate, addDays, isISODate } from './dates';
import { CURRENCY_CODES, type CurrencyCode, type Minor, formatMoney, parseAmount } from './money';
import type { OverspendPolicy, SpendTag, TripInput } from './types';

/** Successful or failed validation. `errors` is keyed by field path (`amount`, `parts.1.amount`). */
export type ValidationResult<T> =
  { ok: true; value: T } | { ok: false; errors: Record<string, string> };

const TAGS = ['food', 'groceries', 'transport', 'stay', 'activities', 'shopping', 'other'] as const;
const POLICIES = ['cascade', 'redistribute'] as const;

/** Convert a zod error into the flat `{ path: message }` map forms expect (first message per path wins). */
function toErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    out[key] ??= issue.message;
  }
  return out;
}

/* ----------------------------------------------------------------------- trip */

/** Raw values of the "new trip" form. */
export interface TripFormValues {
  name: string;
  currency: CurrencyCode;
  /** Budget as typed, e.g. `"450,50"`. */
  budget: string;
  startDate: ISODate;
  /** Trip length in days. */
  days: number;
  overspendPolicy: OverspendPolicy;
}

const tripFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Give your trip a name')
      .max(60, 'Keep the name under 60 characters'),
    currency: z.enum(CURRENCY_CODES),
    budget: z.string(),
    startDate: z.string().refine(isISODate, 'Pick a valid start date'),
    days: z
      .number()
      .int('Whole days only')
      .min(1, 'A trip needs at least 1 day')
      .max(365, 'Up to 365 days'),
    overspendPolicy: z.enum(POLICIES),
  })
  .superRefine((v, ctx) => {
    const minor = parseAmount(v.budget, v.currency);
    if (minor === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['budget'],
        message: 'Enter an amount, like 450 or 450.50',
      });
    } else if (minor <= 0) {
      ctx.addIssue({ code: 'custom', path: ['budget'], message: 'Budget must be more than zero' });
    }
  });

/**
 * Validate the "new trip" form and convert it to a {@link TripInput}.
 * @param values - Raw form values.
 */
export function validateTripForm(values: TripFormValues): ValidationResult<TripInput> {
  const parsed = tripFormSchema.safeParse(values);
  if (!parsed.success) return { ok: false, errors: toErrors(parsed.error) };
  const v = parsed.data;
  return {
    ok: true,
    value: {
      name: v.name,
      currency: v.currency,
      totalBudget: parseAmount(v.budget, v.currency) as Minor,
      startDate: v.startDate,
      endDate: addDays(v.startDate, v.days - 1),
      overspendPolicy: v.overspendPolicy,
    },
  };
}

/* ---------------------------------------------------------------------- spend */

/** One line of a split payment as typed. */
export interface SpendPartValues {
  amount: string;
  tag: SpendTag;
}

/** Raw values of the "log spend" form. */
export interface SpendFormValues {
  /** Amount as typed. In split mode this is the total charged (e.g. the card payment). */
  amount: string;
  tag: SpendTag;
  note: string;
  date: ISODate;
  /** When true, `parts` divide `amount` into tagged pieces. */
  split: boolean;
  parts: SpendPartValues[];
}

/** Trip facts the spend form needs for validation and messages. */
export interface SpendFormContext {
  currency: CurrencyCode;
  startDate: ISODate;
  endDate: ISODate;
}

/** Validated result: one or more tagged parts on a single date. A plain spend has exactly one part. */
export interface SpendFormOutput {
  date: ISODate;
  note?: string;
  parts: { amount: Minor; tag: SpendTag }[];
}

const spendFormSchema = z.object({
  amount: z.string(),
  tag: z.enum(TAGS),
  note: z.string().trim().max(120, 'Keep notes under 120 characters'),
  date: z.string().refine(isISODate, 'Pick a valid date'),
  split: z.boolean(),
  parts: z.array(z.object({ amount: z.string(), tag: z.enum(TAGS) })),
});

/**
 * Validate the "log spend" form.
 *
 * Rules: the amount must be positive; the date must fall inside the trip; in split mode there must be
 * at least two parts, each positive, and together they must add up exactly to the total.
 * @param values - Raw form values.
 * @param ctx - Currency and trip range.
 */
export function validateSpendForm(
  values: SpendFormValues,
  ctx: SpendFormContext,
): ValidationResult<SpendFormOutput> {
  const parsed = spendFormSchema.safeParse(values);
  if (!parsed.success) return { ok: false, errors: toErrors(parsed.error) };
  const v = parsed.data;
  const errors: Record<string, string> = {};

  const total = parseAmount(v.amount, ctx.currency);
  if (total === null) errors.amount = 'Enter an amount, like 12 or 12.50';
  else if (total <= 0) errors.amount = 'Amount must be more than zero';

  if (v.date < ctx.startDate || v.date > ctx.endDate) errors.date = 'Pick a day inside the trip';

  let parts: SpendFormOutput['parts'] = [];
  if (!v.split) {
    if (total !== null && total > 0) parts = [{ amount: total, tag: v.tag }];
  } else {
    if (v.parts.length < 2) errors.parts = 'Split into at least two parts';
    const parsedParts = v.parts.map((p, i) => {
      const amount = parseAmount(p.amount, ctx.currency);
      if (amount === null || amount <= 0) errors[`parts.${i}.amount`] = 'Enter an amount';
      return { amount: amount ?? 0, tag: p.tag };
    });
    const assigned = parsedParts.reduce((s, p) => s + p.amount, 0);
    if (total !== null && total > 0 && !errors.parts && v.parts.length >= 2) {
      const diff = total - assigned;
      if (diff > 0) errors.parts = `${formatMoney(diff, ctx.currency)} left to assign`;
      else if (diff < 0)
        errors.parts = `Parts are ${formatMoney(-diff, ctx.currency)} over the total`;
    }
    parts = parsedParts;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { date: v.date, note: v.note || undefined, parts } };
}

/**
 * How much of a split total is still unassigned (negative when parts exceed the total).
 * Drives the live "€3.50 left to assign" indicator.
 * @returns Minor units, or `null` while the total is not a valid amount.
 */
export function unassignedAmount(
  total: string,
  parts: SpendPartValues[],
  currency: string,
): Minor | null {
  const t = parseAmount(total, currency);
  if (t === null) return null;
  const assigned = parts.reduce((s, p) => s + (parseAmount(p.amount, currency) ?? 0), 0);
  return t - assigned;
}
