/**
 * "Is this bill odd?" — the checks that decide whether a scan can be filed silently or must ask.
 *
 * A bill is *odd* when it is from a different day than expected, from a day the trip does not cover,
 * from the future, has no readable date or total, looks like one already scanned, or is in another
 * currency. {@link analyzeReceipt} turns the parsed bill, the trip and what the user already decided
 * into a list of {@link ReceiptIssue}s. It is a pure function, so the same answer is available to the
 * scan screen, the review screen, tests and Storybook.
 * @module receipts/analyze
 */
import { type ISODate, addDays, diffDays, formatDayLabel } from '../dates';
import { type Minor, formatMoney } from '../money';
import type { Trip } from '../types';
import { merchantKey } from './categorize';
import { itemsMatchTotal, itemsSum } from './parse';
import type {
  DateChoice,
  IssueCode,
  Receipt,
  ReceiptData,
  ReceiptDecisions,
  ReceiptIssue,
  TripChoice,
} from './types';

/** Everything the checks need to know about the world. */
export interface AnalyzeContext {
  /** Current day (device time zone). */
  today: ISODate;
  /** Trip the bill would be counted against by default (the active trip). */
  trip: Trip | null;
  /** All trips, to suggest another trip that contains the bill's date. */
  trips: readonly Trip[];
  /** Bills already saved, for duplicate detection. */
  receipts: readonly Receipt[];
  /** Id of the receipt being reviewed, so it does not duplicate itself. */
  selfId?: string;
  /** A bill this many days old (or newer) is filed with a quiet note instead of a question. Default 1. */
  staleDays?: number;
  /** The user said "don't ask about older bills" for this session. */
  allowOlderDates?: boolean;
}

/** Confidence below which a parse needs a human glance. */
export const LOW_CONFIDENCE = 0.6;

/** Issue codes the AI fallback can plausibly improve (they are about *reading*, not about intent). */
const AI_HELPABLE: ReadonlySet<IssueCode> = new Set([
  'NO_TOTAL',
  'NO_DATE',
  'LOW_CONFIDENCE',
  'DATE_AMBIGUOUS',
  'ITEMS_MISMATCH',
  'NO_MERCHANT',
]);

/** Day label that adds the year when it is not the current one. */
function dayLabel(date: ISODate, today: ISODate): string {
  const base = formatDayLabel(date);
  return date.slice(0, 4) === today.slice(0, 4) ? base : `${base} ${date.slice(0, 4)}`;
}

/** The effective values after the user's decisions. */
export function effectiveValues(
  data: ReceiptData,
  decisions: ReceiptDecisions = {},
): { date: ISODate | undefined; total: Minor | undefined } {
  return {
    date: decisions.date ?? data.date,
    total: decisions.total ?? data.total,
  };
}

/** The trip a bill would be counted against, honouring an explicit choice. `null` = none. */
export function chosenTrip(ctx: AnalyzeContext, decisions: ReceiptDecisions = {}): Trip | null {
  if (decisions.tripId === undefined) return ctx.trip;
  if (decisions.tripId === null) return null;
  return ctx.trips.find((t) => t.id === decisions.tripId) ?? null;
}

/**
 * Is `a` the same purchase as saved receipt `b`?
 * Same shop, same day and same total — unless both print a receipt number and the numbers differ.
 */
function isDuplicate(
  data: ReceiptData,
  date: ISODate | undefined,
  total: Minor | undefined,
  other: Receipt,
): boolean {
  if (total === undefined || date === undefined) return false;
  const otherTotal = other.data.total;
  const otherDate = other.date ?? other.data.date;
  if (otherTotal !== total || otherDate !== date) return false;
  if (data.receiptNumber && other.data.receiptNumber)
    return data.receiptNumber === other.data.receiptNumber;
  const a = merchantKey(data.merchant);
  const b = merchantKey(other.data.merchant);
  if (a && b) return a === b;
  // No shop name on one side: fall back to the minute, if both print one.
  return !!data.time && data.time === other.data.time;
}

/**
 * Run every check.
 *
 * Severity decides what the app does: any unresolved `decision` stops the bill from being counted
 * until the user answers; `warning` and `info` are shown but never block.
 *
 * @param data - The parsed bill.
 * @param ctx - Today, trips, saved bills.
 * @param decisions - What the user already decided on the review screen.
 * @returns Issues, `decision`s first. Resolved issues stay in the list (with `resolved: true`) so the UI can show what was accepted.
 * @example
 * const issues = analyzeReceipt(data, { today, trip, trips: [trip], receipts: [] });
 * const blocked = issues.some((i) => i.severity === 'decision' && !i.resolved);
 */
export function analyzeReceipt(
  data: ReceiptData,
  ctx: AnalyzeContext,
  decisions: ReceiptDecisions = {},
): ReceiptIssue[] {
  const issues: ReceiptIssue[] = [];
  const acked = new Set<IssueCode>(decisions.acknowledged ?? []);
  const { today } = ctx;
  const staleDays = ctx.staleDays ?? 1;
  const trip = chosenTrip(ctx, decisions);
  const keepAsCopy = decisions.tripId === null;
  const { date, total } = effectiveValues(data, decisions);
  const dateChosen = decisions.date !== undefined;

  const add = (
    issue: Omit<ReceiptIssue, 'resolved' | 'acknowledgeable'> & {
      acknowledgeable?: boolean;
      resolved?: boolean;
    },
  ) => {
    const acknowledgeable = issue.acknowledgeable ?? false;
    issues.push({
      ...issue,
      acknowledgeable,
      resolved: issue.resolved ?? (acknowledgeable && acked.has(issue.code)),
    });
  };

  // ── where does it go? ──────────────────────────────────────────────────────────────────────
  if (!trip && !keepAsCopy) {
    add({
      code: 'NO_TRIP',
      severity: 'decision',
      title: 'No trip to count this against',
      detail: 'Create a trip first, or keep this bill as a digital copy that is not counted.',
    });
  }

  // ── total ──────────────────────────────────────────────────────────────────────────────────
  if (total === undefined || total <= 0) {
    add({
      code: 'NO_TOTAL',
      severity: 'decision',
      title: 'Could not read the total',
      detail: 'Type the amount from the bill, or let AI read the photo.',
    });
  }

  // ── date ───────────────────────────────────────────────────────────────────────────────────
  const todayChoice: DateChoice = { date: today, label: `Today · ${dayLabel(today, today)}` };
  if (date === undefined) {
    add({
      code: 'NO_DATE',
      severity: 'decision',
      title: 'No date found on this bill',
      detail: 'The timeline is built from the printed date. Pick the day it was issued.',
      dateChoices: [
        todayChoice,
        { date: addDays(today, -1), label: `Yesterday · ${dayLabel(addDays(today, -1), today)}` },
      ],
    });
  } else {
    if (date > today) {
      add({
        code: 'DATE_FUTURE',
        severity: 'decision',
        title: `Dated ${dayLabel(date, today)} — in the future`,
        detail:
          'A bill cannot be from tomorrow. The date may be misread, or the printer clock is off.',
        dateChoices: [
          todayChoice,
          ...alternativeChoices(data, today).filter((c) => c.date <= today),
        ],
      });
    } else if (trip && (date < trip.startDate || date > trip.endDate)) {
      const others: TripChoice[] = ctx.trips
        .filter((t) => t.id !== trip.id && date >= t.startDate && date <= t.endDate)
        .map((t) => ({
          tripId: t.id,
          label: `${t.name} (${dayLabel(t.startDate, today)} – ${dayLabel(t.endDate, today)})`,
        }));
      const nearest = date < trip.startDate ? trip.startDate : trip.endDate;
      add({
        code: 'DATE_OUTSIDE_TRIP',
        severity: 'decision',
        title: `Dated ${dayLabel(date, today)} — outside ${trip.name}`,
        detail: `${trip.name} runs ${dayLabel(trip.startDate, today)} – ${dayLabel(trip.endDate, today)}. Pick a day inside it, move the bill to another trip, or keep it as a digital copy.`,
        dateChoices: [{ date: nearest, label: `Nearest trip day · ${dayLabel(nearest, today)}` }],
        ...(others.length > 0 ? { tripChoices: others } : {}),
      });
    } else if (trip && !dateChosen) {
      const age = diffDays(date, today);
      if (age > 0) {
        // Catching up after the trip is expected, not odd.
        const quiet = age <= staleDays || ctx.allowOlderDates === true || today > trip.endDate;
        add({
          code: 'DATE_NOT_TODAY',
          severity: quiet ? 'info' : 'decision',
          title: age === 1 ? 'From yesterday' : `From ${age} days ago · ${dayLabel(date, today)}`,
          detail: quiet
            ? `Filed under ${dayLabel(date, today)}, the day printed on the bill.`
            : `This bill is dated ${dayLabel(date, today)}, not today. Keep that day, or file it under another one?`,
          acknowledgeable: true,
          resolved: quiet || acked.has('DATE_NOT_TODAY'),
          dateChoices: [{ date, label: `Bill date · ${dayLabel(date, today)}` }, todayChoice],
        });
      }
    }

    if (data.dateAmbiguous && !dateChosen) {
      add({
        code: 'DATE_AMBIGUOUS',
        severity: 'decision',
        title: 'The date can be read two ways',
        detail: `Printed as day/month or month/day. Is it ${dayLabel(date, today)}?`,
        acknowledgeable: true,
        dateChoices: [
          { date, label: dayLabel(date, today) },
          ...(data.dateAlternatives ?? [])
            .slice(0, 2)
            .map((d) => ({ date: d, label: dayLabel(d, today) })),
        ],
      });
    } else if ((data.dateAlternatives?.length ?? 0) > 0 && !dateChosen) {
      add({
        code: 'MULTIPLE_DATES',
        severity: 'info',
        title: 'More than one date on the bill',
        detail: `Using ${dayLabel(date, today)}; also printed: ${data.dateAlternatives!.map((d) => dayLabel(d, today)).join(', ')}.`,
        resolved: true,
        dateChoices: alternativeChoices(data, today),
      });
    }
  }

  // ── duplicate ──────────────────────────────────────────────────────────────────────────────
  const twin = ctx.receipts.find((r) => r.id !== ctx.selfId && isDuplicate(data, date, total, r));
  if (twin) {
    add({
      code: 'DUPLICATE',
      severity: 'decision',
      title: 'Looks like a bill you already scanned',
      detail: `Same shop, day and total${total !== undefined ? ` (${formatMoney(total, data.currency ?? 'EUR')})` : ''}.`,
      acknowledgeable: true,
    });
  }

  // ── currency ───────────────────────────────────────────────────────────────────────────────
  if (trip && data.currency && data.currency !== trip.currency && !keepAsCopy) {
    add({
      code: 'CURRENCY_MISMATCH',
      severity: 'decision',
      title: `Bill is in ${data.currency}, trip is in ${trip.currency}`,
      detail: `Enter what you paid in ${trip.currency} (from your card statement or an exchange rate).`,
      resolved: decisions.amountInTripCurrency !== undefined && decisions.amountInTripCurrency > 0,
    });
  }

  // ── reading quality ────────────────────────────────────────────────────────────────────────
  // A missing date/total is already its own question, and anything the user typed in has been looked at.
  const readAllKeyFields = data.date !== undefined && (data.total ?? 0) > 0;
  const userFilledIn = decisions.date !== undefined || decisions.total !== undefined;
  if (
    data.source !== 'manual' &&
    data.confidence < LOW_CONFIDENCE &&
    readAllKeyFields &&
    !userFilledIn
  ) {
    add({
      code: 'LOW_CONFIDENCE',
      severity: 'decision',
      title: 'Not sure the bill was read correctly',
      detail: 'Check the amount and day below, or let AI read the photo.',
      acknowledgeable: true,
    });
  }
  if (!data.merchant) {
    add({
      code: 'NO_MERCHANT',
      severity: 'warning',
      title: 'No shop name found',
      detail: 'Add one so the bill is easy to recognise on the timeline.',
    });
  }
  if (data.items.length > 0 && data.total !== undefined && !itemsMatchTotal(data)) {
    add({
      code: 'ITEMS_MISMATCH',
      severity: 'warning',
      title: 'Items do not add up to the total',
      detail: `Lines add up to ${formatMoney(itemsSum(data.items), data.currency ?? 'EUR')}, the bill says ${formatMoney(data.total, data.currency ?? 'EUR')}. Some lines may be missing.`,
      acknowledgeable: true,
    });
  }

  const rank = { decision: 0, warning: 1, info: 2 } as const;
  return issues.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

function alternativeChoices(data: ReceiptData, today: ISODate): DateChoice[] {
  return (data.dateAlternatives ?? []).map((d) => ({ date: d, label: dayLabel(d, today) }));
}

/**
 * Issues that still need an answer before the bill can be counted.
 * @param issues - Result of {@link analyzeReceipt}.
 */
export function blockingIssues(issues: readonly ReceiptIssue[]): ReceiptIssue[] {
  return issues.filter((i) => i.severity === 'decision' && !i.resolved);
}

/**
 * Could the AI fallback help? True when something blocking (or suspicious) is about *reading* the bill
 * rather than about what the user wants — a wrong-day bill will still be a wrong-day bill after AI.
 * @param issues - Result of {@link analyzeReceipt}.
 */
export function aiCouldHelp(issues: readonly ReceiptIssue[]): boolean {
  return issues.some((i) => AI_HELPABLE.has(i.code) && !i.resolved && i.severity !== 'info');
}

/** What the bill will be counted as, if it can be counted. */
export interface BudgetPlan {
  /** `true` when nothing blocks and a day, amount and trip are known. */
  canBudget: boolean;
  tripId: string | null;
  date: ISODate | null;
  amount: Minor | null;
  issues: ReceiptIssue[];
}

/**
 * Combine the checks with the numbers: can this bill be counted, and as what?
 * @param data - The parsed bill.
 * @param ctx - Today, trips, saved bills.
 * @param decisions - What the user already decided.
 */
export function planBudgeting(
  data: ReceiptData,
  ctx: AnalyzeContext,
  decisions: ReceiptDecisions = {},
): BudgetPlan {
  const issues = analyzeReceipt(data, ctx, decisions);
  const trip = chosenTrip(ctx, decisions);
  const { date, total } = effectiveValues(data, decisions);
  const foreign = !!trip && !!data.currency && data.currency !== trip.currency;
  const amount = foreign ? (decisions.amountInTripCurrency ?? null) : (total ?? null);
  const ok =
    !!trip &&
    date !== undefined &&
    amount !== null &&
    amount > 0 &&
    blockingIssues(issues).length === 0;
  return {
    canBudget: ok,
    tripId: trip?.id ?? null,
    date: date ?? null,
    amount,
    issues,
  };
}
