/**
 * Plain-language explanations of what the allowance engine just did, shown on the Today screen.
 * Pure functions so the wording is unit-tested and identical on every client.
 * @module lib/messages
 */
import { formatMoney, type DayPlan, type TripPlan } from '@tbc/core';

/** A message ready to render in an `<Alert>`. */
export interface DayMessage {
  variant: 'info' | 'success' | 'warning' | 'destructive';
  title: string;
  description?: string;
}

/**
 * Explain the state of one day.
 * @param plan - Whole-trip plan (needed for the overspend policy and remaining days).
 * @param day - The day to describe (usually today).
 * @returns A message, or `null` when there is nothing worth saying.
 */
export function describeDay(plan: TripPlan, day: DayPlan): DayMessage | null {
  const { currency, overspendPolicy } = plan.trip;
  const money = (n: number) => formatMoney(Math.abs(n), currency);

  if (day.remaining < 0) {
    const over = -day.remaining;
    const daysAfter = plan.days.length - day.index - 1;
    if (daysAfter === 0) {
      return {
        variant: 'destructive',
        title: `You're ${money(over)} over your last day`,
        description: 'The trip is now over budget.',
      };
    }
    return {
      variant: 'destructive',
      title:
        day.spent === 0
          ? `Earlier overspending uses up today`
          : `You're ${money(over)} over today's limit`,
      description:
        overspendPolicy === 'cascade'
          ? `It comes off tomorrow's allowance, and rolls on until it is paid back.`
          : `It is spread over the remaining ${daysAfter} ${daysAfter === 1 ? 'day' : 'days'} (about ${money(Math.ceil(over / daysAfter))} a day).`,
    };
  }
  if (day.status === 'near-limit') {
    return {
      variant: 'warning',
      title:
        day.available === 0
          ? 'Nothing left to spend today'
          : `Only ${money(day.remaining)} left today`,
      description: 'Anything more comes out of tomorrow.',
    };
  }
  if (day.carryIn > 0 && day.phase !== 'future') {
    return { variant: 'success', title: `Includes ${money(day.carryIn)} saved from earlier days` };
  }
  return null;
}

/**
 * Header subtitle for the Today screen.
 * @param plan - Trip plan.
 */
export function tripSubtitle(plan: TripPlan): string {
  const n = plan.days.length;
  if (plan.phase === 'upcoming') return `Starts soon · ${n} days`;
  if (plan.phase === 'finished') return `Finished · ${n} days`;
  const day = (plan.today?.index ?? 0) + 1;
  return `Day ${day} of ${n} · ${plan.daysLeft} ${plan.daysLeft === 1 ? 'day' : 'days'} left`;
}
