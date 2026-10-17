/**
 * Reading money off a bill: amount tokens (`12,50`, `1.234,56`, `1 234.50`, `-1,20`) and currency markers.
 * Everything returns **integer minor units**; floats never appear.
 * @module receipts/amounts
 */
import { type CurrencyCode, type Minor, getCurrency, parseAmount } from '../money';
import { CURRENCY_SYMBOLS } from './locale';

/** An amount found inside a row of text. */
export interface AmountToken {
  /** Value in minor units; negative for discounts (`-1,20` or `1,20-`). */
  value: Minor;
  /** Text as printed, without the sign. */
  raw: string;
  /** Offset of the first digit in the row. */
  start: number;
  /** Offset after the last digit. */
  end: number;
  /** `true` when the token has a decimal part (`12,50`) — a strong sign it is a price, not a code. */
  hasDecimals: boolean;
}

/**
 * Digits with optional thousands groups, then optional 1–2 decimals. Groups are exactly three digits,
 * so `12,50` is read as 12.50 while `1,250` / `1.250` is read as one thousand two hundred fifty.
 */
const AMOUNT_RE = /\d{1,3}(?:[ \u00a0'.,]\d{3})+(?:[.,]\d{1,2})?(?!\d)|\d+(?:[.,]\d{1,2})?(?!\d)/g;

/**
 * Find every amount in a row, left to right. Percentages (`19 %`) and numbers glued to letters on
 * the left (`A12`, `EAN4006381333931`) are skipped.
 * @param row - One row of text (dates and times should already be blanked out).
 * @param currency - Decides how many decimals are legal (JPY has none).
 */
export function extractAmounts(row: string, currency: CurrencyCode | string): AmountToken[] {
  const out: AmountToken[] = [];
  AMOUNT_RE.lastIndex = 0;
  for (let m = AMOUNT_RE.exec(row); m; m = AMOUNT_RE.exec(row)) {
    const raw = m[0];
    const start = m.index;
    const end = start + raw.length;
    const prev = start > 0 ? (row[start - 1] ?? '') : '';
    // Part of a longer identifier or a decimal fragment: not a price.
    if (/[\d.,]/.test(prev) || (/[a-z]/i.test(prev) && /[a-z]/i.test(row[start - 2] ?? ' ')))
      continue;
    // Percentages are tax rates, not money.
    if (/^\s*%/.test(row.slice(end))) continue;
    const negative = prev === '-' || (row[end] === '-' && !/\d/.test(row[end + 1] ?? ''));
    const value = parseAmount(raw, currency);
    if (value === null) continue;
    out.push({
      value: negative ? -value : value,
      raw,
      start,
      end,
      hasDecimals: /[.,]\d{1,2}$/.test(raw) && getCurrency(currency).decimals > 0,
    });
  }
  return out;
}

/**
 * Detect the currency a bill is printed in from symbols and ISO codes.
 * @param text - Full OCR text.
 * @returns The most frequent supported currency, or `undefined` when nothing recognisable is printed.
 */
export function detectCurrency(text: string): CurrencyCode | undefined {
  const counts = new Map<CurrencyCode, number>();
  let rest = text;
  for (const [re, code] of CURRENCY_SYMBOLS) {
    const hits = rest.match(re);
    if (!hits) continue;
    counts.set(code, (counts.get(code) ?? 0) + hits.length);
    // Consume what matched so `C$` is not also counted as `$`.
    rest = rest.replace(re, ' ');
  }
  let best: CurrencyCode | undefined;
  let bestCount = 0;
  for (const [code, n] of counts) {
    if (n > bestCount) {
      best = code;
      bestCount = n;
    }
  }
  return best;
}
