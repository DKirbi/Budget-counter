/**
 * The scan pipeline: photo text → receipt JSON → category → checks → either "filed" or "needs you".
 *
 * `processScan` is the one function the scan screen calls per photo. It is pure (no I/O, no store),
 * so the same code path serves the app, the tests and Storybook. `commitScan` then writes the outcome
 * to the store: clean bills are counted immediately (if the user allows auto-confirm), odd ones are
 * saved to the inbox with their photo and wait for a decision.
 * @module receipts/pipeline
 */
import type { ISODate } from '../dates';
import type { BudgetActions } from '../store/budgetStore';
import type { Minor } from '../money';
import type { SplitPart, Trip } from '../types';
import { type BudgetPlan, aiCouldHelp, planBudgeting } from './analyze';
import { type Categorisation, type MerchantRules, categorize } from './categorize';
import { parseReceipt } from './parse';
import type { OcrResult, Receipt, ReceiptData, ReceiptDecisions, ReceiptIssue } from './types';

/** What the pipeline needs to know about the app's state. */
export interface ScanContext {
  today: ISODate;
  trip: Trip | null;
  trips: readonly Trip[];
  receipts: readonly Receipt[];
  merchantRules: MerchantRules;
  /** File clean bills without asking. */
  autoConfirm: boolean;
  /** See `AnalyzeContext.staleDays`. */
  staleDays?: number;
  /** See `AnalyzeContext.allowOlderDates`. */
  allowOlderDates?: boolean;
}

/** What happened to one scanned photo. */
export interface ScanOutcome {
  data: ReceiptData;
  category: Categorisation;
  plan: BudgetPlan;
  /** `auto`: clean — can be filed without asking. `review`: the user has something to decide. */
  mode: 'auto' | 'review';
  /** `true` when the AI fallback could plausibly fix what is wrong. */
  aiMayHelp: boolean;
  /** The spends that would be created (one part unless the user chooses the suggested split). */
  parts: SplitPart[];
}

/**
 * Days a purchase could plausibly have happened on, used to settle `04/05/2026`.
 * @param trip - Active trip, if any.
 * @param today - Current day.
 */
export function plausibleWindow(
  trip: Trip | null,
  today: ISODate,
): { from: ISODate; to: ISODate } | undefined {
  if (!trip) return undefined;
  const to = trip.endDate < today ? trip.endDate : today;
  return trip.startDate <= to ? { from: trip.startDate, to } : undefined;
}

/**
 * Evaluate an already-parsed bill (OCR, AI or hand-entered) against the app's state.
 * @param data - The receipt JSON.
 * @param ctx - App state.
 * @param decisions - What the user already decided on the review screen.
 */
export function evaluateScan(
  data: ReceiptData,
  ctx: ScanContext,
  decisions: ReceiptDecisions = {},
): ScanOutcome {
  const category = categorize(data, ctx.merchantRules);
  const plan = planBudgeting(
    data,
    {
      today: ctx.today,
      trip: ctx.trip,
      trips: ctx.trips,
      receipts: ctx.receipts,
      ...(ctx.staleDays !== undefined ? { staleDays: ctx.staleDays } : {}),
      ...(ctx.allowOlderDates !== undefined ? { allowOlderDates: ctx.allowOlderDates } : {}),
    },
    decisions,
  );
  const parts: SplitPart[] =
    plan.amount !== null && plan.amount > 0 ? [{ amount: plan.amount, tag: category.tag }] : [];
  return {
    data,
    category,
    plan,
    mode: ctx.autoConfirm && plan.canBudget ? 'auto' : 'review',
    aiMayHelp: aiCouldHelp(plan.issues),
    parts,
  };
}

/**
 * Parse and evaluate one photo's OCR text.
 * @param ocr - On-device OCR result.
 * @param ctx - App state.
 * @example
 * const outcome = processScan(await services.ocr.recognize(uri), ctx);
 * if (outcome.mode === 'auto') toast('Filed under ' + outcome.plan.date);
 */
export function processScan(ocr: OcrResult, ctx: ScanContext): ScanOutcome {
  const window = plausibleWindow(ctx.trip, ctx.today);
  const data = parseReceipt(ocr, {
    ...(ctx.trip ? { tripCurrency: ctx.trip.currency } : {}),
    ...(window ? { plausible: window } : {}),
  });
  return evaluateScan(data, ctx);
}

/**
 * Split suggestion that is safe to offer as an alternative to the single spend: the parts sum to the
 * amount that would be counted. `undefined` when none is suggested or a currency conversion is involved.
 * @param category - Result of `categorize`.
 * @param amount - What the bill would count for, minor units (`null` when unknown).
 */
export function offerableSplit(
  category: Categorisation,
  amount: Minor | null,
): SplitPart[] | undefined {
  const split = category.suggestedSplit;
  const sum = split?.reduce((n, p) => n + p.amount, 0);
  return split && amount !== null && sum === amount ? split : undefined;
}

/**
 * {@link offerableSplit} for a scan outcome.
 * @param outcome - Result of {@link evaluateScan}.
 */
export function offeredSplit(outcome: ScanOutcome): SplitPart[] | undefined {
  return offerableSplit(outcome.category, outcome.plan.amount);
}

/** What {@link commitScan} reports. */
export interface CommitResult {
  receipt: Receipt;
  /** `true` when the bill is already counted. */
  filed: boolean;
  /** Amount added to the budget (0 while the bill waits in the inbox), minor units. */
  amount: Minor;
}

/**
 * Write a scan outcome to the store.
 * - `auto` outcomes are counted straight away, as one spend.
 * - `review` outcomes are saved to the inbox with their photo, so nothing is lost if the app closes.
 *
 * @param actions - Store actions.
 * @param outcome - Result of {@link processScan}.
 * @param extra - Raw text and photo to keep with the receipt.
 */
export function commitScan(
  actions: Pick<BudgetActions, 'saveReceipt'>,
  outcome: ScanOutcome,
  extra: { rawText: string; imageUri?: string },
): CommitResult {
  const { plan, data, category, parts } = outcome;
  const filing = outcome.mode === 'auto' && plan.tripId && plan.date && parts.length > 0;
  const receipt = actions.saveReceipt({
    data,
    rawText: extra.rawText,
    ...(extra.imageUri ? { imageUri: extra.imageUri } : {}),
    tripId: plan.tripId,
    date: plan.date,
    tag: category.tag,
    acknowledged: plan.issues.filter((i) => i.resolved && i.acknowledgeable).map((i) => i.code),
    ...(filing ? { budget: { parts } } : {}),
  });
  const filed = receipt.status === 'budgeted';
  return { receipt, filed, amount: filed ? parts.reduce((n, p) => n + p.amount, 0) : 0 };
}

/** Totals for the "Done" summary after a batch of photos. */
export interface BatchSummary {
  filed: number;
  needAttention: number;
  /** Added to the budget by this batch, minor units. */
  amount: Minor;
}

/**
 * Summarise a batch of scans.
 * @param results - Per-photo results from {@link commitScan}.
 */
export function summarizeBatch(results: ReadonlyArray<CommitResult>): BatchSummary {
  return {
    filed: results.filter((r) => r.filed).length,
    needAttention: results.filter((r) => !r.filed).length,
    amount: results.reduce((n, r) => n + r.amount, 0),
  };
}

/**
 * Issues in a plan that still need an answer, in display order.
 * @param plan - Result of `planBudgeting`.
 */
export function openIssues(plan: BudgetPlan): ReceiptIssue[] {
  return plan.issues.filter((i) => i.severity === 'decision' && !i.resolved);
}
