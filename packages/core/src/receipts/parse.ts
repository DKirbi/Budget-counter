/**
 * The deterministic, offline receipt parser: OCR text in, {@link ReceiptData} out.
 *
 * It is a pile of small, boring heuristics rather than a model — that is the point. It runs in a few
 * milliseconds, works on a plane, never sends a bill anywhere, and when it is unsure it says so
 * (through `confidence` and the issues in `analyze.ts`) so the app can offer the AI fallback or a
 * manual fix instead of silently guessing.
 * @module receipts/parse
 */
import type { ISODate } from '../dates';
import { type CurrencyCode, type Minor, getCurrency } from '../money';
import { type AmountToken, detectCurrency, extractAmounts } from './amounts';
import {
  ADDRESS_WORDS,
  CARD_BRAND_WORDS,
  CARD_WORDS,
  CASH_FLOW_WORDS,
  CASH_WORDS,
  NOISE_WORDS,
  NOT_A_TOTAL_WORDS,
  SUBTOTAL_WORDS,
  TAX_WORDS,
  TIP_WORDS,
  TOTAL_WORDS,
  fold,
  wordRe,
} from './locale';
import { rowsFromOcr } from './ocr';
import { findPrintedDate } from './printedDates';
import {
  type OcrResult,
  type PaymentMethod,
  RECEIPT_SCHEMA_VERSION,
  type ReceiptData,
  type ReceiptItem,
} from './types';

/** Context that sharpens parsing. All optional; the parser works without any of it. */
export interface ParseHints {
  /** Currency to assume when the bill prints none. */
  tripCurrency?: CurrencyCode;
  /** Read `04/05/2026` as April 5th. */
  monthFirst?: boolean;
  /** Days that make sense for a purchase; settles ambiguous `04/05/2026`. */
  plausible?: { from: ISODate; to: ISODate };
}

const TOTAL_RE = wordRe(TOTAL_WORDS);
const SUBTOTAL_RE = wordRe(SUBTOTAL_WORDS);
const TAX_RE = wordRe(TAX_WORDS);
const NOT_TOTAL_RE = wordRe(NOT_A_TOTAL_WORDS);
const CASH_FLOW_RE = wordRe(CASH_FLOW_WORDS);
const CARD_RE = wordRe(CARD_WORDS);
const CARD_BRAND_RE = wordRe(CARD_BRAND_WORDS);
const CASH_RE = wordRe(CASH_WORDS);
const TIP_RE = wordRe(TIP_WORDS);
const NOISE_RE = wordRe(NOISE_WORDS);
const ADDRESS_RE = wordRe(ADDRESS_WORDS);
const STARTS_WITH_TOTAL =
  /^\s*(?:grand total|total|totale|totaal|totalt|summe|gesamt\w*|skupaj|ukupno|razem|celkem|importe|montant|osszesen|suma|za placilo|zu zahlen|to pay|amount due)(?![a-z])/;
const URL_RE = /@|www\.|https?:|\.(?:com|net|org|si|hr|de|it|fr|es|at|ch|cz|pl|hu|uk)\b/i;
const VAT_ID_RE =
  /(?:ddv|vat|uid|oib|ust|iva|tva|btw|nip|ico|dic|mva|moms|cif|nif)[^a-z0-9]{0,12}([a-z]{0,2}\d[\da-z ]{6,13}\d)/i;
const RECEIPT_NO_RE =
  /(?:racun|receipt|rechnung|beleg|bon|invoice|fattura|factura|recibo|uctenka|paragon|ticket|scontrino|check|faktura)[^a-z0-9]{0,6}(?:st|nr|no|num|number|numero|broj|br|#)?[^a-z0-9]{0,4}([a-z0-9][a-z0-9/-]{2,19})/i;

/** Number of letters in a string (any alphabet, no Unicode property escapes needed). */
export function letterCount(s: string): number {
  let n = 0;
  for (const ch of s) if (ch.toLowerCase() !== ch.toUpperCase()) n += 1;
  return n;
}

/**
 * Sum of line-item amounts.
 * @param items - Parsed items.
 */
export function itemsSum(items: readonly ReceiptItem[]): Minor {
  return items.reduce((s, i) => s + i.amount, 0);
}

interface Row {
  i: number;
  /** Row with dates/times blanked (used for numbers). */
  text: string;
  /** Row as printed (used for names). */
  orig: string;
  f: string;
  amounts: AmountToken[];
  total: boolean;
  sub: boolean;
  tax: boolean;
  cashFlow: boolean;
  tip: boolean;
}

const isLetter = (ch: string) => ch.toLowerCase() !== ch.toUpperCase();
const isAlnum = (ch: string) => isLetter(ch) || (ch >= '0' && ch <= '9');

/**
 * Trim characters that are not letters or digits from both ends of a string.
 * @param s - Text to trim.
 * @param keepEnd - Characters that may stay at the end (e.g. `.)%`).
 */
function trimEdges(s: string, keepEnd = ''): string {
  let a = 0;
  let b = s.length;
  while (a < b && !isAlnum(s[a]!)) a += 1;
  while (b > a && !isAlnum(s[b - 1]!) && !keepEnd.includes(s[b - 1]!)) b -= 1;
  return s.slice(a, b);
}

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/(\s+|[-/(&.])/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join('');
}

/** Strip decoration around a merchant name. */
function cleanMerchant(raw: string): string {
  let s = trimEdges(raw.replace(/\t+/g, ' ').replace(/\s+/g, ' '), '.)');
  if (s === s.toUpperCase() && s.length > 3) s = toTitleCase(s);
  return s.trim();
}

/**
 * Parse one item row, or return `null` if it is not one.
 * @param row - Classified row.
 * @param currency - Receipt currency (decides what a price looks like).
 * @param pending - A name-only row just above, for two-line items.
 */
function parseItemRow(
  row: Row,
  currency: CurrencyCode,
  pending: string | null,
): { item: ReceiptItem } | null {
  const decimals = getCurrency(currency).decimals;
  const text = row.text.replace(/\d+(?:[.,]\d+)?\s*%/g, ' ');
  const tokens = extractAmounts(text, currency).filter((t) => t.hasDecimals || decimals === 0);
  const last = tokens[tokens.length - 1];
  if (!last) return null;
  const trailer = fold(text.slice(last.end));
  if (
    !/^[\s\t]*(?:€|£|\$|¥|eur|euro|usd|gbp|chf|czk|pln|huf|sek|nok|dkk|cad|aud|jpy|kc|zl|ft|kr)?[\s\t]*[a-e*#]?[\s\t]*-?[\s\t]*$/.test(
      trailer,
    )
  )
    return null;

  let head = text.slice(0, last.start);
  let quantity: number | undefined;
  let unitPrice: Minor | undefined;

  // "Cola  2 x 2,50   5,00": the token before the last one, glued to a quantity and an "x".
  const prev = tokens[tokens.length - 2];
  if (prev) {
    const before = text.slice(0, prev.start);
    const m = /(\d+(?:[.,]\d+)?)\s*[x×*]\s*$/i.exec(before);
    if (m) {
      const q = Number(m[1]!.replace(',', '.'));
      if (q > 0 && Math.abs(Math.round(q * prev.value) - last.value) <= Math.ceil(q)) {
        quantity = q;
        unitPrice = prev.value;
        head = before.slice(0, m.index);
      }
    }
  }
  // Unit-price columns between the name and the line total are not part of the name
  // (offsets are valid here: `head` is still a prefix of `text`).
  let cut = head.length;
  for (const t of tokens.slice(0, -1).reverse()) {
    if (t.end > cut || !/^[\s\t€£$¥]*$/.test(head.slice(t.end, cut))) break;
    if (/[a-z]/i.test(text[t.end] ?? ' ')) break;
    cut = t.start;
  }
  head = head.slice(0, cut);

  // "2 x Cola   5,00"
  const lead = /^\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*/i.exec(head);
  if (lead && quantity === undefined) {
    quantity = Number(lead[1]!.replace(',', '.'));
    head = head.slice(lead[0].length);
    if (quantity > 0 && Number.isInteger(last.value / quantity)) unitPrice = last.value / quantity;
  }
  // "2 CAÑAS  1,80  3,60": a bare leading integer that explains the price jump.
  if (quantity === undefined && prev) {
    const bare = /^\s*(\d{1,2})\s+(?=\D)/.exec(head);
    if (bare && Number(bare[1]) * prev.value === last.value) {
      quantity = Number(bare[1]);
      unitPrice = prev.value;
      head = head.slice(bare[0].length);
    }
  }

  let description = trimEdges(
    head
      .replace(/[€£$¥]/g, ' ')
      .replace(/^\s*\d{3,}\s+/, '')
      .replace(/\t+/g, ' ')
      .replace(/\s+/g, ' '),
    '.)%',
  ).trim();
  if (letterCount(description) < 2 && pending) description = pending;
  if (letterCount(description) < 2) return null;

  return {
    item: {
      description,
      ...(quantity !== undefined ? { quantity } : {}),
      ...(unitPrice !== undefined ? { unitPrice } : {}),
      amount: last.value,
    },
  };
}

/**
 * Parse recognised bill text into the receipt JSON.
 *
 * @param ocr - Result of on-device OCR (or {@link ocrFromText} for plain text).
 * @param hints - Optional context: the trip currency, day/month preference and plausible days.
 * @returns A {@link ReceiptData} with `source: 'ocr'` and a 0–1 `confidence`. Never throws; a bill that
 *   cannot be read comes back with few fields and a low confidence.
 * @example
 * const data = parseReceipt(ocrFromText('SPAR\n05.10.2026 18:42\nMilch 1,29\nSKUPAJ 1,29 EUR'));
 * data.total // 129
 */
export function parseReceipt(ocr: OcrResult, hints: ParseHints = {}): ReceiptData {
  const origRows = rowsFromOcr(ocr);
  const fullText = origRows.join('\n');
  const printedCurrency = detectCurrency(fullText);
  const currency: CurrencyCode = printedCurrency ?? hints.tripCurrency ?? 'EUR';
  const decimals = getCurrency(currency).decimals;

  // US and Canadian bills put the month first (04/05/2026 = April 5th).
  const monthFirst = hints.monthFirst ?? (currency === 'USD' || currency === 'CAD');
  const found = findPrintedDate(origRows, {
    monthFirst,
    ...(hints.plausible ? { plausible: hints.plausible } : {}),
  });

  const rows: Row[] = found.cleanedRows.map((text, i) => {
    const f = fold(text);
    const startsTotal = STARTS_WITH_TOTAL.test(f);
    const sub = SUBTOTAL_RE.test(f);
    const total = TOTAL_RE.test(f) && !sub && !NOT_TOTAL_RE.test(f);
    return {
      i,
      text,
      orig: origRows[i] ?? text,
      f,
      amounts: extractAmounts(text, currency),
      total,
      sub,
      tax: TAX_RE.test(f) && !startsTotal,
      cashFlow: CASH_FLOW_RE.test(f),
      tip: TIP_RE.test(f),
    };
  });

  // ── merchant ────────────────────────────────────────────────────────────────────────────────
  let merchantRow = -1;
  let merchant: string | undefined;
  for (const r of rows.slice(0, 8)) {
    const o = r.orig;
    const letters = letterCount(o);
    const digits = (o.match(/\d/g) ?? []).length;
    if (letters < 3 || digits > letters * 0.5) continue;
    if (r.amounts.some((a) => a.hasDecimals)) continue;
    if (r.text !== o) continue; // contains a date or time
    if (NOISE_RE.test(r.f) || URL_RE.test(o) || VAT_ID_RE.test(r.f)) continue;
    if (ADDRESS_RE.test(r.f) && digits > 0) continue;
    if (r.total || r.sub || r.tax || r.cashFlow) continue;
    merchantRow = r.i;
    merchant = cleanMerchant(o.slice(0, 60));
    if (letterCount(merchant) >= 3) break;
    merchant = undefined;
    merchantRow = -1;
  }

  // ── where the items live ────────────────────────────────────────────────────────────────────
  const firstSummary = rows.findIndex((r) => (r.total || r.sub) && r.amounts.length > 0);
  const zoneEnd = firstSummary === -1 ? rows.length : firstSummary;

  const items: ReceiptItem[] = [];
  let pending: string | null = null;
  for (const r of rows.slice(merchantRow + 1, zoneEnd)) {
    if (r.tax || r.cashFlow || r.tip || r.total || r.sub) {
      pending = null;
      continue;
    }
    if (CARD_BRAND_RE.test(r.f) || NOISE_RE.test(r.f)) {
      pending = null;
      continue;
    }
    const parsed = parseItemRow(r, currency, pending);
    if (parsed) {
      items.push(parsed.item);
      pending = null;
    } else {
      pending =
        r.amounts.length === 0 && letterCount(r.text) >= 3
          ? r.text.replace(/\t+/g, ' ').replace(/\s+/g, ' ').trim()
          : null;
    }
  }
  const sum = itemsSum(items);

  // ── totals ──────────────────────────────────────────────────────────────────────────────────
  const priceLike = (row: Row): AmountToken[] => {
    const withDec = row.amounts.filter((a) => a.hasDecimals || decimals === 0);
    return withDec.length > 0 ? withDec : row.amounts.filter((a) => a.raw.length <= 6);
  };
  const maxOf = (row: Row): Minor | undefined => {
    const vals = priceLike(row)
      .map((a) => a.value)
      .filter((v) => v > 0);
    return vals.length ? Math.max(...vals) : undefined;
  };

  const totalCands = rows
    .filter((r) => r.total && !r.cashFlow)
    .map(maxOf)
    .filter((v): v is Minor => v !== undefined);
  let total: Minor | undefined;
  let totalIsFallback = false;
  if (totalCands.length > 0) {
    total = totalCands.includes(sum) && sum > 0 ? sum : Math.max(...totalCands);
  } else {
    const loose = rows
      .filter((r) => !r.tax && !r.cashFlow && !r.tip && !CARD_RE.test(r.f) && !NOISE_RE.test(r.f))
      .flatMap((r) => priceLike(r).map((a) => a.value))
      .filter((v) => v > 0);
    if (loose.length > 0) {
      total = Math.max(...loose);
      totalIsFallback = true;
    }
  }

  const subtotal = rows
    .filter((r) => r.sub)
    .map(maxOf)
    .find((v) => v !== undefined);
  const taxVals = rows
    .filter((r) => r.tax && r.amounts.length > 0)
    .map((r) => r.amounts.filter((a) => a.hasDecimals).at(-1)?.value)
    .filter((v): v is Minor => v !== undefined && v > 0);
  const taxSum = taxVals.reduce((a, b) => a + b, 0);
  const tax = taxSum > 0 && (total === undefined || taxSum < total) ? taxSum : undefined;
  const tip = rows
    .filter((r) => r.tip)
    .map(maxOf)
    .find((v) => v !== undefined);

  // ── payment, ids ────────────────────────────────────────────────────────────────────────────
  const payZone = rows.slice(firstSummary === -1 ? 0 : firstSummary);
  const card = payZone.some((r) => CARD_RE.test(r.f));
  const cash = payZone.some((r) => CASH_RE.test(r.f) || r.cashFlow);
  const paymentMethod: PaymentMethod | undefined = card ? 'card' : cash ? 'cash' : undefined;

  let vatId: string | undefined;
  let receiptNumber: string | undefined;
  for (const r of rows) {
    if (!vatId) {
      const m = VAT_ID_RE.exec(r.f);
      if (m) vatId = m[1]!.replace(/\s+/g, '').toUpperCase();
    }
    if (!receiptNumber) {
      const m = RECEIPT_NO_RE.exec(r.f);
      if (m && /\d/.test(m[1]!)) receiptNumber = m[1]!.toUpperCase();
    }
  }

  // ── confidence ──────────────────────────────────────────────────────────────────────────────
  const confidence = scoreConfidence(
    {
      ...(total !== undefined ? { total } : {}),
      ...(subtotal !== undefined ? { subtotal } : {}),
      ...(tax !== undefined ? { tax } : {}),
      ...(found.date ? { date: found.date } : {}),
      ...(found.ambiguous ? { dateAmbiguous: true } : {}),
      ...(merchant ? { merchant } : {}),
      items,
    },
    { totalIsFallback, currencyPrinted: printedCurrency !== undefined },
  );

  return {
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    source: 'ocr',
    ...(merchant ? { merchant } : {}),
    ...(vatId ? { vatId } : {}),
    ...(found.date ? { date: found.date } : {}),
    ...(found.ambiguous ? { dateAmbiguous: true } : {}),
    ...(found.alternatives.length > 0 ? { dateAlternatives: found.alternatives } : {}),
    ...(found.time ? { time: found.time } : {}),
    currency,
    ...(total !== undefined ? { total } : {}),
    ...(subtotal !== undefined ? { subtotal } : {}),
    ...(tax !== undefined ? { tax } : {}),
    ...(tip !== undefined ? { tip } : {}),
    items,
    ...(paymentMethod ? { paymentMethod } : {}),
    ...(receiptNumber ? { receiptNumber } : {}),
    confidence,
  };
}

/**
 * How much of a bill was understood, 0–1.
 *
 * Weights: total 0.30 (0.12 if it was only guessed as the largest amount), date 0.30 (0.15 if day/month
 * is ambiguous), shop name 0.20, line items 0.10 (+0.05 when they add up), printed currency 0.05.
 * Below `LOW_CONFIDENCE` (0.6) the app asks for a human glance.
 * @param d - The fields found.
 * @param opts - Whether the total was a fallback guess and whether a currency was actually printed.
 */
export function scoreConfidence(
  d: Pick<ReceiptData, 'items'> &
    Partial<
      Pick<ReceiptData, 'total' | 'subtotal' | 'tax' | 'date' | 'dateAmbiguous' | 'merchant'>
    >,
  opts: { totalIsFallback: boolean; currencyPrinted: boolean },
): number {
  const score =
    (d.total === undefined ? 0 : opts.totalIsFallback ? 0.12 : 0.3) +
    (d.date ? (d.dateAmbiguous ? 0.15 : 0.3) : 0) +
    (d.merchant ? 0.2 : 0) +
    (d.items.length > 0 ? 0.1 + (itemsMatchTotal(d) ? 0.05 : 0) : 0) +
    (opts.currencyPrinted ? 0.05 : 0);
  return Math.round(score * 100) / 100;
}

/**
 * Do the line items add up to what was charged?
 * @param data - Parsed receipt.
 * @returns `true` when there are items and their sum equals the total, the subtotal, or total − tax.
 */
export function itemsMatchTotal(
  data: Pick<ReceiptData, 'items' | 'total' | 'subtotal' | 'tax'>,
): boolean {
  if (data.items.length === 0 || data.total === undefined) return false;
  const s = itemsSum(data.items);
  return (
    s === data.total ||
    s === data.subtotal ||
    (data.tax !== undefined && s + data.tax === data.total)
  );
}
