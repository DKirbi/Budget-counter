import {
  addDays,
  clampDate,
  dayOfMonth,
  daysInclusive,
  diffDays,
  eachDay,
  formatDayLabel,
  formatWeekday,
  isISODate,
  todayISO,
} from './dates';

describe('dates', () => {
  it('validates real calendar dates only', () => {
    expect(isISODate('2026-02-28')).toBe(true);
    expect(isISODate('2028-02-29')).toBe(true);
    expect(isISODate('2026-02-29')).toBe(false);
    expect(isISODate('2026-13-01')).toBe(false);
    expect(isISODate('26-01-01')).toBe(false);
    expect(isISODate('')).toBe(false);
  });

  it('adds days across month, year and leap boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('is unaffected by daylight-saving changes', () => {
    // EU clocks change on 2026-03-29 and 2026-10-25.
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2);
    expect(diffDays('2026-10-24', '2026-10-26')).toBe(2);
    expect(eachDay('2026-03-28', '2026-03-30')).toEqual(['2026-03-28', '2026-03-29', '2026-03-30']);
  });

  it('counts inclusive ranges', () => {
    expect(daysInclusive('2026-05-01', '2026-05-01')).toBe(1);
    expect(daysInclusive('2026-05-01', '2026-05-07')).toBe(7);
    expect(eachDay('2026-05-02', '2026-05-01')).toEqual([]);
  });

  it('clamps into range', () => {
    expect(clampDate('2026-04-01', '2026-05-01', '2026-05-07')).toBe('2026-05-01');
    expect(clampDate('2026-06-01', '2026-05-01', '2026-05-07')).toBe('2026-05-07');
    expect(clampDate('2026-05-03', '2026-05-01', '2026-05-07')).toBe('2026-05-03');
  });

  it('throws a clear error for invalid input', () => {
    expect(() => addDays('nope', 1)).toThrow(/Invalid ISO date/);
  });

  it('formats labels in UTC regardless of device zone', () => {
    expect(formatDayLabel('2026-05-04')).toMatch(/Mon.*4.*May/);
    expect(formatWeekday('2026-05-04')).toBe('Mon');
    expect(dayOfMonth('2026-05-04')).toBe(4);
  });

  it('todayISO uses local calendar components', () => {
    expect(todayISO(new Date(2026, 4, 3, 23, 59))).toBe('2026-05-03');
    expect(todayISO(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });
});
