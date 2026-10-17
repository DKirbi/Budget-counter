import { RECEIPT_FIXTURES, fixtureOcr } from './fixtures';
import { detectCurrency, extractAmounts } from './amounts';
import { findPrintedDate } from './printedDates';
import { rowsFromOcr } from './ocr';
import { itemsMatchTotal, itemsSum, parseReceipt } from './parse';

describe('extractAmounts', () => {
  const v = (s: string, c = 'EUR') => extractAmounts(s, c).map((t) => t.value);
  it.each([
    ['Milk 1,29', [129]],
    ['Milk 1.29', [129]],
    ['Total 1.234,56', [123456]],
    ['Total 1,234.56', [123456]],
    ['Total 1 234,56', [123456]],
    ['Cola 2 x 2,50 5,00', [200, 250, 500]],
    ['Discount -0,30', [-30]],
    ['Discount 0,30-', [-30]],
    ['VAT 19% 5,88', [588]],
    ['EAN4006381333931 9,99', [999]],
  ])('%s', (row, expected) => {
    expect(v(row)).toEqual(expected);
  });

  it('knows yen has no decimals', () => {
    expect(v('ラーメン 1,200', 'JPY')).toEqual([1200]);
    expect(v('ラーメン 12.50', 'JPY')).toEqual([]);
  });
  it('marks decimals so ids are not mistaken for prices', () => {
    const [a, b] = extractAmounts('Tel 5678 Milk 1,29', 'EUR');
    expect(a!.hasDecimals).toBe(false);
    expect(b!.hasDecimals).toBe(true);
  });
});

describe('detectCurrency', () => {
  it.each([
    ['Total 5,00 €', 'EUR'],
    ['Total £5.00', 'GBP'],
    ['Total $5.00', 'USD'],
    ['Total C$5.00', 'CAD'],
    ['Total A$5.00', 'AUD'],
    ['Celkem 54,80 Kč', 'CZK'],
    ['Razem 12,00 zł', 'PLN'],
    ['Gesamtbetrag CHF 276.00', 'CHF'],
    ['TOTAL 12.00 SEK', 'SEK'],
  ])('%s → %s', (text, code) => {
    expect(detectCurrency(text)).toBe(code);
  });
  it('returns undefined when nothing is printed', () => {
    expect(detectCurrency('Total 5,00')).toBeUndefined();
  });
});

describe('findPrintedDate', () => {
  const d = (s: string, hints = {}) => findPrintedDate(s.split('\n'), hints);

  it.each([
    ['05.10.2026', '2026-10-05'],
    ['5.10.2026', '2026-10-05'],
    ['2026-10-05', '2026-10-05'],
    ['2026/10/05', '2026-10-05'],
    ['05-10-2026', '2026-10-05'],
    ['5. 10. 2026', '2026-10-05'],
    ['05.10.26', '2026-10-05'],
    ['5 Oct 2026', '2026-10-05'],
    ['5th October 2026', '2026-10-05'],
    ['October 5, 2026', '2026-10-05'],
    ['05-Oct-26', '2026-10-05'],
    ['4. Okt. 2026', '2026-10-04'],
    ['14. listopada 2026', undefined],
    ['3 mars 2026', '2026-03-03'],
    ['13/10/2026', '2026-10-13'],
  ])('%s → %s', (text, expected) => {
    const r = d(`Datum ${text}`);
    expect(r.date).toBe(expected);
    expect(r.ambiguous).toBe(false);
  });

  it('flags slash dates that read two ways', () => {
    const r = d('Fecha 04/05/2026');
    expect(r).toMatchObject({ date: '2026-05-04', ambiguous: true, alternatives: ['2026-04-05'] });
  });
  it('reads month-first for US hints', () => {
    const r = d('04/05/2026', { monthFirst: true });
    expect(r).toMatchObject({ date: '2026-04-05', ambiguous: true, alternatives: ['2026-05-04'] });
  });
  it('settles ambiguity with the plausible window', () => {
    const r = d('04/05/2026', { plausible: { from: '2026-05-01', to: '2026-05-07' } });
    expect(r).toMatchObject({ date: '2026-05-04', ambiguous: false, alternatives: ['2026-04-05'] });
    const swapped = d('04/05/2026', { plausible: { from: '2026-04-01', to: '2026-04-07' } });
    expect(swapped).toMatchObject({ date: '2026-04-05', ambiguous: false });
  });
  it('ignores impossible dates', () => {
    expect(d('31.02.2026').date).toBeUndefined();
    expect(d('99.99.2026').date).toBeUndefined();
    expect(d('05.10.1999').date).toBeUndefined();
  });
  it('ignores expiry / due dates', () => {
    const r = d('Datum 05.10.2026\nGültig bis 05.01.2027');
    expect(r.date).toBe('2026-10-05');
    expect(r.alternatives).toEqual([]);
    expect(d('best before 05.10.2026').date).toBeUndefined();
  });
  it('prefers the dated, timed row and lists other dates as alternatives', () => {
    const r = d('Order 01.10.2026\nDatum 05.10.2026 18:42');
    expect(r.date).toBe('2026-10-05');
    expect(r.alternatives).toEqual(['2026-10-01']);
  });
  it('reads times, including AM/PM', () => {
    expect(d('05.10.2026 18:42:11').time).toBe('18:42');
    expect(d('10/05/2026 07:58 AM').time).toBe('07:58');
    expect(d('10/05/2026 07:58 PM').time).toBe('19:58');
    expect(d('10/05/2026 12:10 AM').time).toBe('00:10');
    expect(d('no date here 25:99').time).toBeUndefined();
  });
  it('blanks dates and times so they never become amounts', () => {
    const r = d('Datum 05.10.2026 18:42 total 5,00');
    expect(extractAmounts(r.cleanedRows[0]!, 'EUR').map((t) => t.value)).toEqual([500]);
  });
});

describe('rowsFromOcr', () => {
  it('joins boxes on the same visual row and keeps top-to-bottom order', () => {
    const rows = rowsFromOcr({
      text: '',
      lines: [
        { text: '1,29', box: { x: 300, y: 102, width: 40, height: 20 } },
        { text: 'MILCH', box: { x: 10, y: 100, width: 80, height: 22 } },
        { text: 'SPAR', box: { x: 100, y: 10, width: 80, height: 30 } },
        { text: 'BROT', box: { x: 10, y: 140, width: 60, height: 22 } },
        { text: '2,10', box: { x: 300, y: 141, width: 40, height: 20 } },
      ],
    });
    expect(rows).toEqual(['SPAR', 'MILCH\t1,29', 'BROT\t2,10']);
  });
  it('splits plain text and turns wide gaps into tabs', () => {
    expect(rowsFromOcr({ text: 'A   1,00\n\nB 2,00', lines: [] })).toEqual(['A\t1,00', 'B 2,00']);
  });
});

describe.each(RECEIPT_FIXTURES.map((f) => [f.id, f] as const))('parseReceipt · %s', (_id, f) => {
  const data = parseReceipt(fixtureOcr(f));

  it('reads merchant, currency and total', () => {
    expect(data.merchant).toBe(f.expect.merchant);
    expect(data.currency).toBe(f.expect.currency);
    expect(data.total).toBe(f.expect.total);
  });
  it('reads the date and time', () => {
    expect(data.date).toBe(f.expect.date);
    expect(!!data.dateAmbiguous).toBe(!!f.expect.dateAmbiguous);
    expect(data.time).toBe(f.expect.time);
  });
  it('finds the line items and they add up', () => {
    expect(data.items).toHaveLength(f.expect.items);
    expect(itemsMatchTotal(data)).toBe(f.expect.itemsAddUp);
  });
  it('detects how it was paid', () => {
    expect(data.paymentMethod).toBe(f.expect.payment);
  });
  it('is confident', () => {
    expect(data.confidence).toBeGreaterThanOrEqual(0.75);
    expect(data.source).toBe('ocr');
    expect(data.schemaVersion).toBe(1);
  });
});

describe('parseReceipt details', () => {
  const si = parseReceipt(fixtureOcr(RECEIPT_FIXTURES[0]!));
  it('keeps discounts as negative items and quantity × unit price', () => {
    expect(si.items.map((i) => [i.description, i.quantity, i.unitPrice, i.amount])).toEqual([
      ['MLEKO 1L', undefined, undefined, 129],
      ['KRUH ČRNI', undefined, undefined, 210],
      ['JOGURT 0,5L', 2, 89, 178],
      ['PIVO LAŠKO 0,5L', undefined, undefined, 119],
      ['Popust', undefined, undefined, -30],
    ]);
    expect(itemsSum(si.items)).toBe(606);
  });
  it('reads VAT id, receipt number and tax', () => {
    expect(si.vatId).toBe('SI12345678');
    expect(si.receiptNumber).toBe('000123');
    expect(si.tax).toBe(57);
  });
  it('handles tip and subtotal', () => {
    const de = parseReceipt(fixtureOcr(RECEIPT_FIXTURES[1]!));
    expect(de).toMatchObject({
      subtotal: 3680,
      tip: 320,
      tax: 588,
      total: 4000,
      receiptNumber: '4711',
    });
    expect(de.items[0]).toMatchObject({
      description: 'Hefeweizen 0,5l',
      quantity: 2,
      unitPrice: 420,
      amount: 840,
    });
  });
  it('reads bare leading quantities when the maths fits', () => {
    const es = parseReceipt(fixtureOcr(RECEIPT_FIXTURES[5]!));
    expect(es.items[0]).toMatchObject({
      description: 'CAÑAS',
      quantity: 2,
      unitPrice: 180,
      amount: 360,
    });
  });
  it('uses plausibility hints to settle slash dates', () => {
    const it = RECEIPT_FIXTURES[2]!;
    const plain = parseReceipt(fixtureOcr(it));
    expect(plain.dateAmbiguous).toBe(true);
    const settled = parseReceipt(fixtureOcr(it), {
      plausible: { from: '2026-10-08', to: '2026-10-14' },
    });
    expect(settled.date).toBe('2026-10-12');
    expect(settled.dateAmbiguous).toBeUndefined();
    expect(settled.dateAlternatives).toEqual(['2026-12-10']);
  });
  it('assumes the trip currency when none is printed', () => {
    const data = parseReceipt(
      fixtureOcr({
        ...RECEIPT_FIXTURES[0]!,
        text: 'KIOSK\nDatum 05.10.2026\nSKUPAJ 12,00',
      } as never),
      {
        tripCurrency: 'PLN',
      },
    );
    expect(data.currency).toBe('PLN');
    expect(data.total).toBe(1200);
    expect(data.confidence).toBeLessThan(0.9);
  });
  it('falls back to the largest amount when no total keyword is printed, with lower confidence', () => {
    const data = parseReceipt({
      text: 'CAFE X\n05.10.2026\nKava 2,50\nTorta 4,20\n6,70',
      lines: [],
    });
    const keyworded = parseReceipt({
      text: 'CAFE X\n05.10.2026\nKava 2,50\nTorta 4,20\nSKUPAJ 6,70',
      lines: [],
    });
    expect(data.total).toBe(670);
    expect(data.confidence).toBeLessThan(keyworded.confidence);
  });
  it('never throws on garbage and reports low confidence', () => {
    for (const text of ['', '   \n\n', '%%%###', '12345 67890', 'only words here', '\t\t1,00']) {
      const d = parseReceipt({ text, lines: [] });
      expect(d.confidence).toBeLessThan(0.5);
      expect(d.items).toEqual([]);
    }
  });
  it('does not mistake "Kartoffeln" for a card payment item exclusion', () => {
    const d = parseReceipt({ text: 'MARKT\n05.10.2026\nKartoffeln\t2,99\nSumme\t2,99', lines: [] });
    expect(d.items).toHaveLength(1);
  });
  it('is deterministic', () => {
    const f = RECEIPT_FIXTURES[3]!;
    expect(parseReceipt(fixtureOcr(f))).toEqual(parseReceipt(fixtureOcr(f)));
  });
});
