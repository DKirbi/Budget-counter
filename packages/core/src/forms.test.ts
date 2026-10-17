import {
  unassignedAmount,
  validateSpendForm,
  validateTripForm,
  type SpendFormValues,
  type TripFormValues,
} from './forms';

const validTrip: TripFormValues = {
  name: '  Lisbon  ',
  currency: 'EUR',
  budget: '700',
  startDate: '2026-05-01',
  days: 7,
  overspendPolicy: 'cascade',
};

describe('validateTripForm', () => {
  it('converts typed values to a domain input', () => {
    const r = validateTripForm(validTrip);
    expect(r).toEqual({
      ok: true,
      value: {
        name: 'Lisbon',
        currency: 'EUR',
        totalBudget: 70_000,
        startDate: '2026-05-01',
        endDate: '2026-05-07',
        overspendPolicy: 'cascade',
      },
    });
  });

  it('accepts comma decimals', () => {
    const r = validateTripForm({ ...validTrip, budget: '450,50' });
    expect(r.ok && r.value.totalBudget).toBe(45_050);
  });

  it.each([
    [{ name: '   ' }, 'name', 'Give your trip a name'],
    [{ name: 'x'.repeat(61) }, 'name', 'Keep the name under 60 characters'],
    [{ budget: '' }, 'budget', 'Enter an amount, like 450 or 450.50'],
    [{ budget: 'lots' }, 'budget', 'Enter an amount, like 450 or 450.50'],
    [{ budget: '0' }, 'budget', 'Budget must be more than zero'],
    [{ days: 0 }, 'days', 'A trip needs at least 1 day'],
    [{ days: 366 }, 'days', 'Up to 365 days'],
    [{ days: 2.5 }, 'days', 'Whole days only'],
    [{ startDate: '2026-02-30' }, 'startDate', 'Pick a valid start date'],
  ])('rejects %j', (patch, field, message) => {
    const r = validateTripForm({ ...validTrip, ...patch });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[field]).toBe(message);
  });

  it('reports several problems at once', () => {
    const r = validateTripForm({ ...validTrip, name: '', budget: 'x' });
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(['budget', 'name']);
  });
});

const ctx = { currency: 'EUR', startDate: '2026-05-01', endDate: '2026-05-07' } as const;
const single: SpendFormValues = {
  amount: '12,50',
  tag: 'food',
  note: ' Lunch ',
  date: '2026-05-03',
  split: false,
  parts: [],
};

describe('validateSpendForm — single spend', () => {
  it('produces one tagged part', () => {
    expect(validateSpendForm(single, ctx)).toEqual({
      ok: true,
      value: { date: '2026-05-03', note: 'Lunch', parts: [{ amount: 1_250, tag: 'food' }] },
    });
  });

  it('omits an empty note', () => {
    const r = validateSpendForm({ ...single, note: '   ' }, ctx);
    expect(r.ok && r.value.note).toBeUndefined();
  });

  it.each([
    [{ amount: '' }, 'amount'],
    [{ amount: '0' }, 'amount'],
    [{ amount: 'abc' }, 'amount'],
    [{ date: '2026-04-30' }, 'date'],
    [{ date: '2026-05-08' }, 'date'],
    [{ note: 'n'.repeat(121) }, 'note'],
  ])('rejects %j', (patch, field) => {
    const r = validateSpendForm({ ...single, ...patch }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[field]).toBeTruthy();
  });
});

describe('validateSpendForm — split payments', () => {
  const split: SpendFormValues = {
    ...single,
    amount: '40',
    split: true,
    parts: [
      { amount: '25', tag: 'food' },
      { amount: '15', tag: 'groceries' },
    ],
  };

  it('accepts parts that add up exactly', () => {
    const r = validateSpendForm(split, ctx);
    expect(r.ok && r.value.parts).toEqual([
      { amount: 2_500, tag: 'food' },
      { amount: 1_500, tag: 'groceries' },
    ]);
  });

  it('tells the user how much is left to assign', () => {
    const r = validateSpendForm(
      {
        ...split,
        parts: [
          { amount: '25', tag: 'food' },
          { amount: '10', tag: 'other' },
        ],
      },
      ctx,
    );
    expect(!r.ok && r.errors.parts).toBe('€5.00 left to assign');
  });

  it('tells the user when parts exceed the total', () => {
    const r = validateSpendForm(
      {
        ...split,
        parts: [
          { amount: '25', tag: 'food' },
          { amount: '20', tag: 'other' },
        ],
      },
      ctx,
    );
    expect(!r.ok && r.errors.parts).toBe('Parts are €5.00 over the total');
  });

  it('needs at least two parts', () => {
    const r = validateSpendForm({ ...split, parts: [{ amount: '40', tag: 'food' }] }, ctx);
    expect(!r.ok && r.errors.parts).toBe('Split into at least two parts');
  });

  it('flags empty or invalid parts individually', () => {
    const r = validateSpendForm(
      {
        ...split,
        parts: [
          { amount: '', tag: 'food' },
          { amount: '40', tag: 'other' },
        ],
      },
      ctx,
    );
    expect(!r.ok && r.errors['parts.0.amount']).toBe('Enter an amount');
  });
});

describe('unassignedAmount', () => {
  it('is total minus parts, and null while the total is invalid', () => {
    expect(unassignedAmount('40', [{ amount: '25', tag: 'food' }], 'EUR')).toBe(1_500);
    expect(unassignedAmount('40', [{ amount: '45', tag: 'food' }], 'EUR')).toBe(-500);
    expect(unassignedAmount('', [], 'EUR')).toBeNull();
    expect(unassignedAmount('40', [{ amount: 'x', tag: 'food' }], 'EUR')).toBe(4_000);
  });
});
