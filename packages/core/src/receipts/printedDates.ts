/**
 * Finding the purchase date (and time) printed on a bill.
 *
 * Receipts print dates in every imaginable way — `05.10.2026`, `2026-10-05`, `5 Oct 2026`,
 * `5. okt. 2026`, `10/05/26`. This module reads them all, flags the genuinely ambiguous ones
 * (`04/05/2026`) instead of guessing silently, and ignores dates that are not the purchase day
 * (expiry, due date, best-before).
 * @module receipts/printedDates
 */
import { type ISODate, isISODate } from '../dates';
import { DATE_EXCLUDE_WORDS, DATE_HINT_WORDS, MONTHS, fold, wordRe } from './locale';

/** One date found in one row. */
export interface DateHit {
  date: ISODate;
  /** The other reading when day and month could be swapped. */
  ambiguousWith?: ISODate;
  /** Offsets inside the row. */
  start: number;
  end: number;
  /** Text as printed. */
  raw: string;
}

/** Hints that sharpen date reading. */
export interface DateReadingHints {
  /** Read `04/05/2026` as April 5th (US style). Default: day first. Only applies to `/`. */
  monthFirst?: boolean;
  /** Days that make sense for a purchase (e.g. the trip, up to today). Settles `04/05/2026` when only one reading fits. */
  plausible?: { from: ISODate; to: ISODate };
}

/** Result of {@link findPrintedDate}. */
export interface DateFinding {
  /** Chosen purchase day. */
  date?: ISODate;
  /** `true` when day/month order could not be settled. */
  ambiguous: boolean;
  /** Other plausible days (the swapped reading, a second printed date). */
  alternatives: ISODate[];
  /** `HH:MM` printed next to the date. */
  time?: string;
  /** The rows with dates and times blanked out, so their digits are not mistaken for amounts. */
  cleanedRows: string[];
}

const HINT_RE = wordRe(DATE_HINT_WORDS);
const EXCLUDE_RE = wordRe(DATE_EXCLUDE_WORDS);

const MONTH_LOOKUP = new Map<string, number>();
for (const [num, names] of Object.entries(MONTHS))
  for (const n of names) MONTH_LOOKUP.set(n, Number(num));
const MONTH_ALT = [...MONTH_LOOKUP.keys()].sort((a, b) => b.length - a.length).join('|');

const pad = (n: number) => String(n).padStart(2, '0');

/** Build an ISO date if it is real and in 2000–2099. */
function mk(y: number, m: number, d: number): ISODate | null {
  const iso = `${y}-${pad(m)}-${pad(d)}`;
  return y >= 2000 && y <= 2099 && isISODate(iso) ? iso : null;
}
const fullYear = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));

/** A regex match whose left edge is not glued to a digit (or, optionally, a letter). */
interface Found {
  index: number;
  text: string;
  g: string[];
}
function find(re: RegExp, s: string, noLetterBefore = false): Found[] {
  const out: Found[] = [];
  re.lastIndex = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    const before = m.index > 0 ? (s[m.index - 1] ?? '') : '';
    if (/\d/.test(before) || (noLetterBefore && /[a-z]/.test(before))) continue;
    out.push({ index: m.index, text: m[0], g: m.slice(1) as string[] });
  }
  return out;
}

/**
 * Find every date in one row, leftmost first. Overlapping readings are resolved in favour of the
 * most specific pattern (ISO, then month names, then numeric).
 * @param row - Row text as printed.
 * @param hints - Reading hints.
 */
export function datesInRow(row: string, hints: DateReadingHints = {}): DateHit[] {
  const folded = fold(row);
  const hits: DateHit[] = [];
  const push = (f: Found, date: ISODate | null, ambiguousWith?: ISODate) => {
    if (!date) return;
    const start = f.index;
    const end = start + f.text.length;
    if (hits.some((h) => start < h.end && end > h.start)) return;
    hits.push({
      date,
      start,
      end,
      raw: row.slice(start, end),
      ...(ambiguousWith ? { ambiguousWith } : {}),
    });
  };

  // 2026-10-05 · 2026/10/05 · 2026.10.05
  for (const f of find(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?!\d)/g, folded))
    push(f, mk(Number(f.g[0]), Number(f.g[1]), Number(f.g[2])));

  // 5 Oct 2026 · 5. okt. 2026 · 05-Oct-26 · 5th of October 2026
  const dayName = new RegExp(
    `(\\d{1,2})(?:st|nd|rd|th)?[-\\s./]*(?:of\\s+)?(${MONTH_ALT})(?![a-z])[-\\s./,']*(\\d{4})(?!\\d)`,
    'g',
  );
  for (const f of find(dayName, folded))
    push(f, mk(Number(f.g[2]), MONTH_LOOKUP.get(f.g[1]!)!, Number(f.g[0])));
  const dayNameShort = new RegExp(`(\\d{1,2})-(${MONTH_ALT})-(\\d{2})(?!\\d)`, 'g');
  for (const f of find(dayNameShort, folded))
    push(f, mk(fullYear(f.g[2]!), MONTH_LOOKUP.get(f.g[1]!)!, Number(f.g[0])));

  // October 5, 2026
  const nameDay = new RegExp(
    `(${MONTH_ALT})(?![a-z])\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})(?!\\d)`,
    'g',
  );
  for (const f of find(nameDay, folded, true))
    push(f, mk(Number(f.g[2]), MONTH_LOOKUP.get(f.g[0]!)!, Number(f.g[1])));

  // 05.10.2026 · 5/10/26 · "5. 10. 2026"
  const numeric = (f: Found, a: string, b: string, y: string, sep: string) => {
    const year = fullYear(y);
    const dayFirst = mk(year, Number(b), Number(a));
    const monthFirst = mk(year, Number(a), Number(b));
    // Dots and dashes are day-first everywhere that uses them; only slashes are genuinely ambiguous.
    if (sep !== '/' || !dayFirst || !monthFirst || dayFirst === monthFirst) {
      push(f, dayFirst ?? monthFirst);
      return;
    }
    const us = hints.monthFirst === true;
    push(f, us ? monthFirst : dayFirst, us ? dayFirst : monthFirst);
  };
  for (const f of find(/(\d{1,2})\s?([./-])\s?(\d{1,2})\s?\2\s?(\d{4})(?!\d)/g, folded))
    numeric(f, f.g[0]!, f.g[2]!, f.g[3]!, f.g[1]!);
  for (const f of find(/(\d{1,2})([./-])(\d{1,2})\2(\d{2})(?!\d)/g, folded))
    numeric(f, f.g[0]!, f.g[2]!, f.g[3]!, f.g[1]!);

  return hits.sort((a, b) => a.start - b.start);
}

/** Times (`HH:MM`, optional seconds and AM/PM) in a row, as 24-hour `HH:MM`. */
function timesInRow(row: string): Array<{ time: string; start: number; end: number }> {
  const out: Array<{ time: string; start: number; end: number }> = [];
  for (const f of find(
    /(\d{1,2}):([0-5]\d)(?::[0-5]\d)?(?:\s?([ap])\.?m\b\.?)?(?!\d)/g,
    fold(row),
  )) {
    let h = Number(f.g[0]);
    const meridiem = f.g[2];
    if (meridiem === 'p' && h < 12) h += 12;
    if (meridiem === 'a' && h === 12) h = 0;
    if (h <= 23)
      out.push({ time: `${pad(h)}:${f.g[1]}`, start: f.index, end: f.index + f.text.length });
  }
  return out;
}

function blank(s: string, spans: ReadonlyArray<readonly [number, number]>): string {
  let out = s;
  for (const [a, b] of spans) out = out.slice(0, a) + ' '.repeat(b - a) + out.slice(b);
  return out;
}

interface Candidate extends DateHit {
  row: number;
  /** The reading that was rejected because it falls outside the plausible window. */
  rejected?: ISODate;
  score: number;
}

/**
 * Pick the purchase date and time out of a bill.
 *
 * Candidates are scored: a `Datum` / `Date` / `Fecha` word on or next to the row, a time on the same
 * row, an unambiguous reading and falling inside the plausible window all add points. Dates
 * introduced by `valid until`, `Ablauf`, `rok` and friends are ignored.
 * @param rows - OCR rows (see `rowsFromOcr`).
 * @param hints - Reading hints.
 */
export function findPrintedDate(
  rows: readonly string[],
  hints: DateReadingHints = {},
): DateFinding {
  const cands: Candidate[] = [];
  const times = rows.map(timesInRow);
  const spans: Array<Array<readonly [number, number]>> = rows.map(() => []);

  rows.forEach((row, i) => {
    let prevEnd = 0;
    for (const h of datesInRow(row, hints)) {
      spans[i]!.push([h.start, h.end]);
      const context = fold(row.slice(prevEnd, h.start));
      prevEnd = h.end;
      if (EXCLUDE_RE.test(context)) continue;

      const cand: Candidate = { ...h, row: i, score: 0 };
      const { plausible } = hints;
      if (h.ambiguousWith && plausible) {
        const inFirst = h.date >= plausible.from && h.date <= plausible.to;
        const inOther = h.ambiguousWith >= plausible.from && h.ambiguousWith <= plausible.to;
        if (inFirst !== inOther) {
          cand.rejected = inOther ? h.date : h.ambiguousWith;
          if (inOther) cand.date = h.ambiguousWith;
          delete cand.ambiguousWith;
        }
      }
      cands.push(cand);
    }
  });

  rows.forEach((_, i) => times[i]!.forEach((t) => spans[i]!.push([t.start, t.end])));
  const cleanedRows = rows.map((r, i) => blank(r, spans[i]!));
  const firstTime = times.flat()[0]?.time;

  if (cands.length === 0) {
    return {
      ambiguous: false,
      alternatives: [],
      ...(firstTime ? { time: firstTime } : {}),
      cleanedRows,
    };
  }

  for (const c of cands) {
    const here = fold(rows[c.row] ?? '');
    const next = fold(`${rows[c.row - 1] ?? ''} ${rows[c.row + 1] ?? ''}`);
    if (HINT_RE.test(here)) c.score += 2;
    else if (HINT_RE.test(next)) c.score += 1;
    if (times[c.row]!.length > 0) c.score += 1;
    if (!c.ambiguousWith) c.score += 1;
    const w = hints.plausible;
    if (w && c.date >= w.from && c.date <= w.to) c.score += 1;
  }
  const best = cands.reduce((a, b) => (b.score > a.score ? b : a));

  const alternatives = new Set<ISODate>();
  if (best.ambiguousWith) alternatives.add(best.ambiguousWith);
  if (best.rejected) alternatives.add(best.rejected);
  for (const c of cands) alternatives.add(c.date);
  alternatives.delete(best.date);

  const time =
    times[best.row]?.[0]?.time ??
    times[best.row - 1]?.[0]?.time ??
    times[best.row + 1]?.[0]?.time ??
    firstTime;

  return {
    date: best.date,
    ambiguous: best.ambiguousWith !== undefined,
    alternatives: [...alternatives],
    ...(time ? { time } : {}),
    cleanedRows,
  };
}
