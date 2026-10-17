import {
  CURRENCIES,
  currencySymbol,
  formatMoney,
  getCurrency,
  parseAmount,
  splitEvenly,
  toInputString,
} from './money';

describe('parseAmount', () => {
  it.each([
    ['12', 'EUR', 1200],
    ['12.5', 'EUR', 1250],
    ['12,50', 'EUR', 1250],
    ['0.5', 'EUR', 50],
    ['.5', 'EUR', 50],
    [',5', 'EUR', 50],
    ['12.', 'EUR', 1200],
    ['1 234,5', 'EUR', 123450],
    ['1,234.50', 'EUR', 123450],
    ['1.234,50', 'EUR', 123450],
    ['1,234', 'EUR', 123400],
    ["1'234.10", 'CHF', 123410],
    ['1500', 'JPY', 1500],
    ['1,500', 'JPY', 1500],
  ])('parses %j (%s) -> %d', (input, currency, expected) => {
    expect(parseAmount(input, currency)).toBe(expected);
  });

  it.each([
    [''],
    ['   '],
    ['abc'],
    ['-5'],
    ['1.2.3'],
    ['12.5.5'],
    ['1e5'],
    ['0.125'],
    ['12,34,56'],
  ])('rejects %j', (input) => {
    expect(parseAmount(input, 'EUR')).toBeNull();
  });

  it('reads a trailing group of three digits as thousands, never as decimals', () => {
    expect(parseAmount('12.345', 'EUR')).toBe(1_234_500);
    expect(parseAmount('12.555', 'EUR')).toBe(1_255_500);
  });

  it('rejects more decimals than the currency allows', () => {
    expect(parseAmount('12.5', 'JPY')).toBeNull();
    expect(parseAmount('12.345,6', 'EUR')).toBe(1_234_560);
    expect(parseAmount('12,5678', 'EUR')).toBeNull();
  });

  it('rejects amounts beyond safe integer range', () => {
    expect(parseAmount('9'.repeat(30), 'EUR')).toBeNull();
  });
});

describe('formatMoney', () => {
  it('formats with currency symbol and decimals', () => {
    expect(formatMoney(1250, 'EUR')).toBe('€12.50');
    expect(formatMoney(-1250, 'EUR')).toBe('-€12.50');
    expect(formatMoney(1500, 'JPY')).toMatch(/1,500/);
  });
  it('supports compact whole amounts and forced signs', () => {
    expect(formatMoney(1200, 'EUR', { compact: true })).toBe('€12');
    expect(formatMoney(1250, 'EUR', { compact: true })).toBe('€12.50');
    expect(formatMoney(500, 'EUR', { signed: true })).toBe('+€5.00');
    expect(formatMoney(0, 'EUR', { signed: true })).toBe('€0.00');
  });
});

describe('currency helpers', () => {
  it('every listed currency has a code and non-negative decimals', () => {
    for (const c of CURRENCIES) {
      expect(c.code).toHaveLength(3);
      expect(c.decimals).toBeGreaterThanOrEqual(0);
    }
  });
  it('falls back to 2 decimals for unknown codes', () => {
    expect(getCurrency('XYZ').decimals).toBe(2);
  });
  it('toInputString round-trips through parseAmount', () => {
    expect(toInputString(1250, 'EUR')).toBe('12.50');
    expect(toInputString(1500, 'JPY')).toBe('1500');
    expect(parseAmount(toInputString(98765, 'EUR'), 'EUR')).toBe(98765);
  });
});

describe('splitEvenly', () => {
  it('distributes the remainder to the earliest shares', () => {
    expect(splitEvenly(100, 3)).toEqual([34, 33, 33]);
    expect(splitEvenly(10, 5)).toEqual([2, 2, 2, 2, 2]);
    expect(splitEvenly(0, 4)).toEqual([0, 0, 0, 0]);
  });
  it('handles negatives symmetrically', () => {
    expect(splitEvenly(-100, 3)).toEqual([-34, -33, -33]);
  });
  it('always sums to the total and shares differ by at most 1 (property check)', () => {
    for (let total = -250; total <= 250; total += 7) {
      for (let parts = 1; parts <= 12; parts++) {
        const shares = splitEvenly(total, parts);
        expect(shares.reduce((a, b) => a + b, 0)).toBe(total);
        expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
      }
    }
  });
  it('rejects invalid part counts', () => {
    expect(() => splitEvenly(10, 0)).toThrow(RangeError);
    expect(() => splitEvenly(10, 1.5)).toThrow(RangeError);
  });
});

describe('currencySymbol', () => {
  it('returns the display symbol or the code when there is none', () => {
    expect(currencySymbol('EUR')).toBe('€');
    expect(currencySymbol('USD')).toMatch(/\$/);
    expect(currencySymbol('CHF')).toBe('CHF');
  });
});
