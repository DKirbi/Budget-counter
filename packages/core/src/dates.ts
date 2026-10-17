/**
 * Calendar-date helpers.
 *
 * Trips are planned in whole days, so every date in the domain is a plain `YYYY-MM-DD` string
 * (an {@link ISODate}). All arithmetic goes through UTC midnight, which makes results identical
 * in every time zone and immune to daylight-saving shifts.
 * @module dates
 */

/** A calendar day formatted `YYYY-MM-DD`. No time, no zone. */
export type ISODate = string;

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/**
 * Check that a string is a real calendar date (rejects `2026-02-30`).
 * @param value - Candidate string.
 * @returns `true` when `value` is a valid `YYYY-MM-DD` date.
 */
export function isISODate(value: string): value is ISODate {
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** Parse a valid {@link ISODate} to a UTC timestamp. Throws on invalid input. */
function toUtc(date: ISODate): number {
  if (!isISODate(date)) throw new RangeError(`Invalid ISO date: "${date}"`);
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

/**
 * Today's calendar date **in the device's local time zone**.
 * @param now - Injectable clock, defaults to `new Date()`.
 */
export function todayISO(now: Date = new Date()): ISODate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Add (or subtract) whole days.
 * @param date - Starting date.
 * @param days - Days to add; negative goes back.
 */
export function addDays(date: ISODate, days: number): ISODate {
  const dt = new Date(toUtc(date) + days * MS_PER_DAY);
  return dt.toISOString().slice(0, 10);
}

/**
 * Signed number of days from `a` to `b` (`b - a`).
 * @example diffDays('2026-05-01', '2026-05-04') // 3
 */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUtc(b) - toUtc(a)) / MS_PER_DAY);
}

/**
 * Number of days in an inclusive range.
 * @example daysInclusive('2026-05-01', '2026-05-01') // 1
 */
export function daysInclusive(start: ISODate, end: ISODate): number {
  return diffDays(start, end) + 1;
}

/**
 * Every date from `start` to `end`, inclusive.
 * @returns Empty array when `end` is before `start`.
 */
export function eachDay(start: ISODate, end: ISODate): ISODate[] {
  const n = daysInclusive(start, end);
  return n > 0 ? Array.from({ length: n }, (_, i) => addDays(start, i)) : [];
}

/**
 * Clamp a date into `[min, max]`.
 * @param date - Date to clamp.
 * @param min - Earliest allowed date.
 * @param max - Latest allowed date.
 */
export function clampDate(date: ISODate, min: ISODate, max: ISODate): ISODate {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

/**
 * Human label for a date, e.g. `Mon 4 May`. Uses `Intl` with an explicit UTC zone.
 * @param date - Date to format.
 * @param locale - BCP-47 locale, defaults to `en-GB`.
 */
export function formatDayLabel(date: ISODate, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(toUtc(date)));
}

/**
 * Compact weekday letter(s) for week strips, e.g. `Mon`.
 * @param date - Date to format.
 * @param locale - BCP-47 locale, defaults to `en-GB`.
 */
export function formatWeekday(date: ISODate, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(
    new Date(toUtc(date)),
  );
}

/** Day of month as a number (1–31). */
export function dayOfMonth(date: ISODate): number {
  return Number(date.slice(8, 10));
}
