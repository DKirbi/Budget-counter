/**
 * Money handling.
 *
 * All amounts in the domain are **integers in minor units** (cents, pence, yen). Floating point
 * never touches a balance, so `0.1 + 0.2` style drift cannot appear in the allowance engine.
 * @module money
 */

/** Integer amount in minor units, e.g. `1250` = 12.50 EUR. */
export type Minor = number;

/** Static currency metadata. `decimals` is the ISO 4217 minor-unit exponent. */
export interface Currency {
  /** ISO 4217 code. */
  code: string;
  /** Display name. */
  name: string;
  /** Number of minor-unit digits (2 for EUR, 0 for JPY). */
  decimals: number;
}

/** Currencies offered in the MVP. Extend freely — nothing else in the codebase hard-codes a code. */
export const CURRENCIES = [
  { code: 'EUR', name: 'Euro', decimals: 2 },
  { code: 'USD', name: 'US dollar', decimals: 2 },
  { code: 'GBP', name: 'Pound sterling', decimals: 2 },
  { code: 'CHF', name: 'Swiss franc', decimals: 2 },
  { code: 'CZK', name: 'Czech koruna', decimals: 2 },
  { code: 'PLN', name: 'Polish złoty', decimals: 2 },
  { code: 'HUF', name: 'Hungarian forint', decimals: 2 },
  { code: 'SEK', name: 'Swedish krona', decimals: 2 },
  { code: 'NOK', name: 'Norwegian krone', decimals: 2 },
  { code: 'DKK', name: 'Danish krone', decimals: 2 },
  { code: 'CAD', name: 'Canadian dollar', decimals: 2 },
  { code: 'AUD', name: 'Australian dollar', decimals: 2 },
  { code: 'JPY', name: 'Japanese yen', decimals: 0 },
] as const satisfies readonly Currency[];

/** Union of supported ISO codes. */
export type CurrencyCode = (typeof CURRENCIES)[number]['code'];

/** Tuple of codes, handy for `z.enum`. */
export const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as unknown as [
  CurrencyCode,
  ...CurrencyCode[],
];

/**
 * Look up currency metadata.
 * @param code - ISO code. Unknown codes fall back to 2 decimals so formatting never throws.
 */
export function getCurrency(code: string): Currency {
  return CURRENCIES.find((c) => c.code === code) ?? { code, name: code, decimals: 2 };
}

/**
 * Format minor units for display, e.g. `1250, 'EUR'` -> `€12.50`.
 * @param amount - Integer minor units (may be negative).
 * @param currency - ISO code.
 * @param opts - `locale` (default `en-GB`), `signed` to force a leading `+` on positives,
 *   `compact` to drop `.00` on whole amounts.
 */
export function formatMoney(
  amount: Minor,
  currency: string,
  opts: { locale?: string; signed?: boolean; compact?: boolean } = {},
): string {
  const { decimals } = getCurrency(currency);
  const value = amount / 10 ** decimals;
  const whole = opts.compact === true && Number.isInteger(value);
  const fd = whole ? 0 : decimals;
  const formatted = new Intl.NumberFormat(opts.locale ?? 'en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: fd,
    maximumFractionDigits: fd,
    signDisplay: opts.signed ? 'exceptZero' : 'auto',
  }).format(value);
  return formatted;
}

/**
 * The symbol used for a currency, e.g. `EUR -> "€"`, `CHF -> "CHF"`.
 * @param code - ISO code.
 * @param locale - BCP-47 locale, defaults to `en-GB`.
 */
export function currencySymbol(code: string, locale = 'en-GB'): string {
  const parts = new Intl.NumberFormat(locale, { style: 'currency', currency: code }).formatToParts(
    0,
  );
  return parts.find((p) => p.type === 'currency')?.value ?? code;
}

/**
 * Parse what a person typed into minor units.
 *
 * Accepts `12`, `12.5`, `12,50`, `1 234,5`, `1,234.50` and `1.234,50`. A trailing group of exactly
 * three digits after a separator (`1,234`) is read as thousands, never as decimals, because no
 * supported currency has three decimal places.
 * @param input - Raw text from an input field.
 * @param currency - ISO code (decides how many decimals are legal).
 * @returns Integer minor units, or `null` when the text is not a valid non-negative amount.
 */
export function parseAmount(input: string, currency: string): Minor | null {
  const { decimals } = getCurrency(currency);
  const s = input.trim().replace(/[\s\u00a0']/g, '');
  if (s === '') return null;

  const PLAIN = /^\d+$/;
  const GROUPED = /^[1-9]\d{0,2}([.,]\d{3})+$/;
  let intRaw = s;
  let frac = '';
  if (!PLAIN.test(s) && !GROUPED.test(s)) {
    const idx = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
    if (idx === -1) return null;
    intRaw = s.slice(0, idx) || '0';
    frac = s.slice(idx + 1);
    if (!PLAIN.test(intRaw) && !GROUPED.test(intRaw)) return null;
    if (frac !== '' && !PLAIN.test(frac)) return null;
  }
  if (frac.length > decimals) return null;
  const n = Number(`${intRaw.replace(/[.,]/g, '')}${frac.padEnd(decimals, '0')}`);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * Render minor units as the plain string an input field should show, e.g. `1250 -> "12.50"`.
 * @param amount - Integer minor units.
 * @param currency - ISO code.
 */
export function toInputString(amount: Minor, currency: string): string {
  const { decimals } = getCurrency(currency);
  return (amount / 10 ** decimals).toFixed(decimals);
}

/**
 * Split an integer into `parts` shares that differ by at most one unit and sum exactly to `total`.
 * The remainder goes to the earliest shares, so a 100-cent budget over 3 days is `[34, 33, 33]`.
 * @param total - Integer to split (may be negative).
 * @param parts - Number of shares, must be >= 1.
 */
export function splitEvenly(total: Minor, parts: number): Minor[] {
  if (!Number.isInteger(parts) || parts < 1)
    throw new RangeError('parts must be a positive integer');
  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const base = Math.floor(abs / parts);
  const extra = abs - base * parts;
  return Array.from({ length: parts }, (_, i) => sign * (base + (i < extra ? 1 : 0)));
}
