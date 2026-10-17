/**
 * Receipt data model.
 *
 * {@link ReceiptData} is the JSON "digital version" of a paper bill — the thing the OCR (or the
 * optional AI fallback, or the user) produces and that every later step (categorising, budgeting,
 * the timeline) reads. It is plain serialisable data with money in integer minor units.
 * @module receipts/types
 */
import type { ISODate } from '../dates';
import type { CurrencyCode, Minor } from '../money';
import type { SpendTag } from '../types';

/** Version of the {@link ReceiptData} JSON shape. Bump when fields change meaning. */
export const RECEIPT_SCHEMA_VERSION = 1 as const;

/** Pixel rectangle of a recognised line inside the photo. */
export interface OcrBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One line of recognised text. `box` is optional so plain-text fixtures work too. */
export interface OcrLine {
  text: string;
  box?: OcrBox;
}

/** What an on-device OCR engine hands to the parser. */
export interface OcrResult {
  /** Full text, lines separated by `\n`. */
  text: string;
  /** Recognised lines in reading order. May be empty when only `text` is known. */
  lines: OcrLine[];
}

/** Who produced a {@link ReceiptData}. */
export type ReceiptSource = 'ocr' | 'ai' | 'manual';

/** How the bill was paid. */
export type PaymentMethod = 'card' | 'cash';

/** One line item on the bill. */
export interface ReceiptItem {
  description: string;
  /** Units, when the bill prints them (`2 x Cola`). */
  quantity?: number;
  /** Price of one unit, minor units. */
  unitPrice?: Minor;
  /** Line total, minor units. Negative for discounts. */
  amount: Minor;
  /** Category suggested for this line. */
  tag?: SpendTag;
}

/**
 * The digital version of a bill. Every field except `items`, `source`, `confidence` and
 * `schemaVersion` is optional: the OCR may simply not find it, and the review screen asks.
 */
export interface ReceiptData {
  schemaVersion: typeof RECEIPT_SCHEMA_VERSION;
  source: ReceiptSource;
  /** Shop / restaurant name as printed (lightly cleaned). */
  merchant?: string;
  /** Tax / VAT identification number. */
  vatId?: string;
  /** Purchase day printed on the bill. */
  date?: ISODate;
  /** `true` when `date` could be read as day/month or month/day and we could not tell. */
  dateAmbiguous?: boolean;
  /** Other plausible days found on the bill (the swapped reading, a second printed date…). */
  dateAlternatives?: ISODate[];
  /** Local time `HH:MM`. */
  time?: string;
  currency?: CurrencyCode;
  /** Amount charged, minor units. */
  total?: Minor;
  subtotal?: Minor;
  tax?: Minor;
  tip?: Minor;
  items: ReceiptItem[];
  paymentMethod?: PaymentMethod;
  receiptNumber?: string;
  /** 0–1 heuristic of how much of the bill we understood. */
  confidence: number;
}

/** Where a receipt is in its life. */
export type ReceiptStatus =
  /** Saved in the inbox, but not counted against the budget yet — waiting for the user. */
  | 'needs-attention'
  /** Counted: one spend (or a split group) points at it. */
  | 'budgeted'
  /** Kept as a digital copy only; the user chose not to count it. */
  | 'archived';

/** A stored receipt: the JSON plus the user's decisions about it. */
export interface Receipt {
  id: string;
  /** Trip the receipt belongs to, or `null` when it is not attached to one. */
  tripId: string | null;
  status: ReceiptStatus;
  data: ReceiptData;
  /** Day the receipt is filed under on the timeline; `null` while unknown. */
  date: ISODate | null;
  /** Main category (the one used when the receipt is not split). */
  tag: SpendTag;
  /** Raw OCR text, kept so the parser can be re-run after an upgrade. */
  rawText: string;
  /** Local file URI of the photo, when it is kept on the device. */
  imageUri?: string;
  /** Issues the user explicitly accepted ("yes, this is the right date"). */
  acknowledged: IssueCode[];
  /** ISO timestamp of the scan. */
  scannedAt: string;
  /** ISO timestamp of the last change. */
  updatedAt: string;
}

/** Everything that can look odd about a scanned bill. */
export type IssueCode =
  | 'NO_TRIP'
  | 'NO_TOTAL'
  | 'NO_DATE'
  | 'DATE_FUTURE'
  | 'DATE_OUTSIDE_TRIP'
  | 'DATE_NOT_TODAY'
  | 'DATE_AMBIGUOUS'
  | 'MULTIPLE_DATES'
  | 'DUPLICATE'
  | 'CURRENCY_MISMATCH'
  | 'LOW_CONFIDENCE'
  | 'NO_MERCHANT'
  | 'ITEMS_MISMATCH';

/**
 * How loud an issue is.
 * - `info` — FYI, never blocks.
 * - `warning` — worth a look, never blocks.
 * - `decision` — the bill is not counted until the user decides.
 */
export type IssueSeverity = 'info' | 'warning' | 'decision';

/** A day the user can pick to resolve a date issue. */
export interface DateChoice {
  date: ISODate;
  /** Short label, e.g. `Bill date`, `Today`, `Nearest trip day`. */
  label: string;
}

/** A problem (or hint) found in a scanned bill. Always derived, never stored. */
export interface ReceiptIssue {
  code: IssueCode;
  severity: IssueSeverity;
  title: string;
  detail: string;
  /** `true` when "this is fine" is a legitimate answer (acknowledging resolves it). */
  acknowledgeable: boolean;
  /** `true` once the user's decisions settled it. Resolved issues are kept so the UI can show them. */
  resolved: boolean;
  /** Days the user may choose from, for date issues. */
  dateChoices?: DateChoice[];
  /** Other trips whose dates contain the bill's date, for `DATE_OUTSIDE_TRIP`. */
  tripChoices?: TripChoice[];
}

/** A trip the user may move a bill to. */
export interface TripChoice {
  tripId: string;
  label: string;
}

/** What the user decided while reviewing a bill. */
export interface ReceiptDecisions {
  /** Day to file the bill under (overrides the printed date). */
  date?: ISODate | null;
  /** Trip to attach the bill to (overrides the active trip). */
  tripId?: string | null;
  /** Issues accepted as-is. */
  acknowledged?: readonly IssueCode[];
  /** Amount in the trip's currency, when the bill is in another currency. */
  amountInTripCurrency?: Minor;
  /** Total typed by hand when the OCR could not read it. */
  total?: Minor;
}
