import { categorize, merchantKey, suggestSplit } from './categorize';
import { RECEIPT_FIXTURES, fixtureOcr } from './fixtures';
import { parseReceipt } from './parse';
import { RECEIPT_SCHEMA_VERSION, type ReceiptData } from './types';

const base = (over: Partial<ReceiptData> = {}): ReceiptData => ({
  schemaVersion: RECEIPT_SCHEMA_VERSION,
  source: 'ocr',
  items: [],
  confidence: 1,
  ...over,
});

describe('merchantKey', () => {
  it.each([
    ['SPAR SLOVENIJA d.o.o.', 'spar slovenija'],
    ['Spar Slovenija', 'spar slovenija'],
    ['Gasthaus Zum Löwen GmbH', 'gasthaus zum lowen'],
    ['BAR LA BODEGUITA S.L.', 'bar la bodeguita'],
    ['Lidl 0412', 'lidl'],
    ["Joe's Diner", 'joe s diner'],
    ['TK Maxx Ltd', 'tk maxx'],
    ['S.P.A.R.', 's p a r'],
  ])('%s → %s', (name, key) => {
    expect(merchantKey(name)).toBe(key);
  });
  it('is empty without a name', () => {
    expect(merchantKey(undefined)).toBe('');
    expect(merchantKey('')).toBe('');
  });
  it('never strips the only token', () => {
    expect(merchantKey('GmbH')).toBe('gmbh');
  });
});

describe('categorize', () => {
  it.each(RECEIPT_FIXTURES.map((f) => [f.id, f] as const))('classifies fixture %s', (_id, f) => {
    expect(categorize(parseReceipt(fixtureOcr(f))).tag).toBe(f.expect.tag);
  });

  it('prefers a rule the user taught over keywords', () => {
    const data = base({ merchant: 'SPAR SLOVENIJA d.o.o.' });
    expect(categorize(data).tag).toBe('groceries');
    const ruled = categorize(data, { [merchantKey('SPAR SLOVENIJA d.o.o.')]: 'food' });
    expect(ruled).toMatchObject({ tag: 'food', source: 'user-rule' });
  });

  it('uses the category most line items point to when the merchant says nothing', () => {
    const data = base({
      merchant: 'Kiosk 12',
      items: [
        { description: 'Pizza slice', amount: 500 },
        { description: 'Beer', amount: 400 },
        { description: 'Postcard', amount: 100 },
      ],
      total: 1000,
    });
    const r = categorize(data);
    expect(r).toMatchObject({ tag: 'food', source: 'items' });
    expect(r.itemTags).toEqual(['food', 'food', 'shopping']);
  });

  it('falls back to other with low confidence', () => {
    const r = categorize(base({ merchant: 'Xyzzy' }));
    expect(r).toMatchObject({ tag: 'other', source: 'default' });
    expect(r.confidence).toBeLessThan(0.5);
  });

  it('classifies without a merchant name', () => {
    expect(categorize(base()).tag).toBe('other');
  });
});

describe('suggestSplit', () => {
  const items = [
    { description: 'Milk', amount: 300 },
    { description: 'Bread', amount: 200 },
    { description: 'Souvenir magnet', amount: 500 },
  ];
  it('splits a mixed basket whose lines add up', () => {
    const parts = suggestSplit({ items, total: 1000 }, 'groceries', [
      undefined,
      undefined,
      'shopping',
    ]);
    expect(parts).toEqual([
      { tag: 'groceries', amount: 500 },
      { tag: 'shopping', amount: 500 },
    ]);
  });
  it('keeps the parts summing to the total', () => {
    const parts = suggestSplit({ items, total: 1000 }, 'groceries', [
      undefined,
      undefined,
      'shopping',
    ])!;
    expect(parts.reduce((s, p) => s + p.amount, 0)).toBe(1000);
  });
  it('does not split when lines do not add up (tip, rounding, misread)', () => {
    expect(
      suggestSplit({ items, total: 1100 }, 'groceries', [undefined, undefined, 'shopping']),
    ).toBeUndefined();
  });
  it('does not split when the minor category is small', () => {
    const small = [
      { description: 'a', amount: 950 },
      { description: 'b', amount: 50 },
    ];
    expect(
      suggestSplit({ items: small, total: 1000 }, 'food', [undefined, 'shopping']),
    ).toBeUndefined();
  });
  it('does not split a single category or a single item', () => {
    expect(
      suggestSplit({ items, total: 1000 }, 'food', [undefined, undefined, undefined]),
    ).toBeUndefined();
    expect(suggestSplit({ items: [items[0]!], total: 300 }, 'food', ['shopping'])).toBeUndefined();
  });
  it('is part of categorize()', () => {
    const data = base({ merchant: 'Spar', items, total: 1000 });
    const r = categorize({
      ...data,
      items: [items[0]!, items[1]!, { description: 'Souvenir magnet', amount: 500 }],
    });
    expect(r.suggestedSplit).toEqual([
      { tag: 'groceries', amount: 500 },
      { tag: 'shopping', amount: 500 },
    ]);
  });
});
