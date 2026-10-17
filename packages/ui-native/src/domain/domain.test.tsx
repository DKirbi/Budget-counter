import { computeTripPlan, computeTripSummary, makeSpend, makeTrip } from './../testing-core';
import { fireEvent, screen } from '@testing-library/react-native';
import { Plane } from 'lucide-react-native';
import * as React from 'react';
import { Button, Text } from '../index';
import { renderUI } from '../testing';
import { AllowanceRing, ringFraction } from './allowance-ring';
import { AmountInput } from './amount-input';
import { CategoryBar } from './category-bar';
import { DayCard } from './day-card';
import { EmptyState } from './empty-state';
import { MoneyText } from './money-text';
import { SpendRow } from './spend-row';
import { StatTile } from './stat-tile';
import { TagIcon } from './tag-icon';
import { TagPicker } from './tag-picker';
import { WeekStrip } from './week-strip';
import { WidgetPreview } from './widget-preview';

const cls = (el: { props: { className?: string } }) => el.props.className ?? '';
const trip = makeTrip();
const plan = computeTripPlan(
  trip,
  [
    makeSpend({ date: '2026-05-01', amount: 4_000 }),
    makeSpend({ date: '2026-05-02', amount: 16_000 }),
    makeSpend({ date: '2026-05-03', amount: 9_000, tag: 'transport', note: 'Tram 28' }),
  ],
  '2026-05-03',
);

describe('MoneyText', () => {
  it('formats amounts and colours negatives when tone is auto', async () => {
    await renderUI(
      <>
        <MoneyText amount={1250} currency="EUR" testID="pos" tone="auto" />
        <MoneyText amount={-1250} currency="EUR" testID="neg" tone="auto" />
        <MoneyText amount={500} currency="EUR" signed testID="signed" />
      </>,
    );
    expect(screen.getByTestId('pos')).toHaveTextContent('€12.50');
    expect(cls(screen.getByTestId('neg'))).toContain('text-destructive');
    expect(cls(screen.getByTestId('pos'))).not.toContain('text-destructive');
    expect(screen.getByTestId('signed')).toHaveTextContent('+€5.00');
  });
});

describe('AllowanceRing', () => {
  it('reports the remaining amount to assistive tech and on screen', async () => {
    await renderUI(
      <AllowanceRing
        remaining={4_200}
        available={10_000}
        spent={5_800}
        currency="EUR"
        status="on-track"
        testID="ring"
      />,
    );
    const ring = screen.getByRole('progressbar', { name: "Today's allowance" });
    expect(ring).toHaveAccessibilityValue({ min: 0, max: 10_000, now: 5_800 });
    expect(screen.getByTestId('ring-amount')).toHaveTextContent('€42.00');
    expect(screen.getByText('Left today')).toBeOnTheScreen();
  });

  it('switches wording when over the limit', async () => {
    await renderUI(
      <AllowanceRing
        remaining={-1_500}
        available={10_000}
        spent={11_500}
        currency="EUR"
        status="over"
        testID="ring"
      />,
    );
    expect(screen.getByText('Over by')).toBeOnTheScreen();
    expect(screen.getByTestId('ring-amount')).toHaveTextContent('€15.00');
    expect(screen.getByRole('progressbar')).toHaveAccessibilityValue({
      text: "€15.00 over today's limit, €115.00 of €100.00 spent",
    });
  });

  it('ringFraction clamps and handles empty allowances', () => {
    expect(ringFraction(0, 100)).toBe(0);
    expect(ringFraction(50, 100)).toBe(0.5);
    expect(ringFraction(150, 100)).toBe(1);
    expect(ringFraction(10, 0)).toBe(1);
    expect(ringFraction(10, -5)).toBe(1);
  });
});

describe('SpendRow', () => {
  it('shows note, category and amount; taps report the id', async () => {
    const onPress = jest.fn();
    await renderUI(
      <SpendRow
        spend={makeSpend({ id: 's1', note: 'Tram 28', tag: 'transport', amount: 950 })}
        currency="EUR"
        onPress={onPress}
      />,
    );
    expect(screen.getByText('Tram 28')).toBeOnTheScreen();
    expect(screen.getByText('Transport')).toBeOnTheScreen();
    expect(screen.getByText('€9.50')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('spend-row-s1'));
    expect(onPress).toHaveBeenCalledWith('s1');
  });

  it('falls back to the category label without a note and flags split parts', async () => {
    await renderUI(
      <SpendRow
        spend={makeSpend({ id: 's2', note: undefined, tag: 'food', splitGroupId: 'g' })}
        currency="EUR"
      />,
    );
    expect(screen.getAllByText('Food & drink').length).toBeGreaterThan(0);
    expect(screen.getByText('Split')).toBeOnTheScreen();
    expect(screen.getByTestId('spend-row-s2')).toBeDisabled();
  });
});

describe('DayCard', () => {
  it('shows the status label and reports presses', async () => {
    const onPress = jest.fn();
    const day = plan.days[1]!; // 16 000 available, 16 000 spent -> nothing left -> near limit
    await renderUI(<DayCard day={day} currency="EUR" onPress={onPress} />);
    expect(day.status).toBe('near-limit');
    expect(screen.getByText('Near limit')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(`day-card-${day.date}`));
    expect(onPress).toHaveBeenCalledWith('2026-05-02');
  });

  it('shows money carried in from earlier days', async () => {
    await renderUI(<DayCard day={plan.days[1]!} currency="EUR" />);
    expect(screen.getByText('Carried in')).toBeOnTheScreen();
    expect(screen.getByText('+€60.00')).toBeOnTheScreen();
  });

  it('shows carried-in debt and the overspend in red', async () => {
    const indebted = {
      ...plan.days[2]!,
      carryIn: -2_000,
      available: 8_000,
      spent: 12_000,
      remaining: -4_000,
      status: 'over' as const,
    };
    await renderUI(<DayCard day={indebted} currency="EUR" />);
    expect(screen.getByText('Debt carried in')).toBeOnTheScreen();
    expect(screen.getByText('Over by')).toBeOnTheScreen();
    expect(screen.getByText('Over')).toBeOnTheScreen();
  });

  it('labels today', async () => {
    await renderUI(<DayCard day={plan.today!} currency="EUR" />);
    expect(screen.getByText('Today')).toBeOnTheScreen();
  });

  it('shows the planned amount instead of spent for future days', async () => {
    await renderUI(<DayCard day={plan.days[5]!} currency="EUR" />);
    expect(screen.getAllByText('Planned')).toHaveLength(2); // caption + status badge
    expect(screen.queryByText('Left')).toBeNull();
  });
});

describe('WeekStrip', () => {
  it('lists every day and selects on tap', async () => {
    const onSelect = jest.fn();
    await renderUI(<WeekStrip days={plan.days} selectedDate="2026-05-03" onSelect={onSelect} />);
    expect(screen.getByTestId('week-day-2026-05-03')).toBeChecked();
    expect(screen.getByTestId('week-day-2026-05-04')).not.toBeChecked();
    await fireEvent.press(screen.getByTestId('week-day-2026-05-05'));
    expect(onSelect).toHaveBeenCalledWith('2026-05-05');
  });
});

describe('StatTile / CategoryBar / EmptyState / TagIcon', () => {
  it('StatTile reads as one sentence', async () => {
    await renderUI(<StatTile label="Avg per day" value="€38.20" hint="over 3 days" testID="t" />);
    expect(screen.getByLabelText('Avg per day: €38.20, over 3 days')).toBeOnTheScreen();
  });

  it('CategoryBar shows share and amount', async () => {
    const spends = [
      makeSpend({ tag: 'food', amount: 3_000 }),
      makeSpend({ tag: 'transport', amount: 1_000 }),
    ];
    const summary = computeTripSummary(computeTripPlan(trip, spends, '2026-05-03'), spends);
    await renderUI(<CategoryBar total={summary.byTag[0]!} currency="EUR" />);
    expect(screen.getByText('75%')).toBeOnTheScreen();
    expect(screen.getByText('€30.00')).toBeOnTheScreen();
  });

  it('EmptyState renders its action', async () => {
    const onPress = jest.fn();
    await renderUI(
      <EmptyState
        icon={Plane}
        title="No trips yet"
        description="Plan one."
        action={
          <Button onPress={onPress}>
            <Text>Plan a trip</Text>
          </Button>
        }
      />,
    );
    expect(screen.getByRole('heading', { name: 'No trips yet' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Plan a trip' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('TagIcon tints by category', async () => {
    const { toJSON } = await renderUI(<TagIcon tag="stay" />);
    expect(JSON.stringify(toJSON())).toContain('bg-tag-stay/15');
  });
});

describe('AmountInput', () => {
  it('shows the currency symbol and reports typing', async () => {
    const onChangeText = jest.fn();
    await renderUI(
      <AmountInput
        value=""
        onChangeText={onChangeText}
        currency="EUR"
        accessibilityLabel="Amount"
      />,
    );
    expect(screen.getByText('€', { includeHiddenElements: true })).toBeOnTheScreen(); // decorative, hidden from a11y
    await fireEvent.changeText(screen.getByLabelText('Amount'), '12,50');
    expect(onChangeText).toHaveBeenCalledWith('12,50');
    expect(screen.getByLabelText('Amount')).toHaveProp('keyboardType', 'decimal-pad');
  });
});

describe('TagPicker', () => {
  it('selects a category and never deselects', async () => {
    const onValueChange = jest.fn();
    await renderUI(<TagPicker value="food" onValueChange={onValueChange} />);
    await fireEvent.press(screen.getByTestId('tag-transport'));
    expect(onValueChange).toHaveBeenCalledWith('transport');
    onValueChange.mockClear();
    await fireEvent.press(screen.getByTestId('tag-food')); // pressing the selected chip
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe('TagPicker (compact)', () => {
  it('drops the text labels but keeps accessible names and custom test ids', async () => {
    const onValueChange = jest.fn();
    await renderUI(
      <TagPicker compact testIDPrefix="part-0-tag" value="food" onValueChange={onValueChange} />,
    );
    expect(screen.queryByText('Transport')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Transport'));
    expect(onValueChange).toHaveBeenCalledWith('transport');
    expect(screen.getByTestId('part-0-tag-stay')).toBeOnTheScreen();
  });
});

describe('WidgetPreview', () => {
  it('2x2 shows the remaining amount; 4x2 adds upcoming days and the add button', async () => {
    const { rerender } = await renderUI(
      <WidgetPreview size="2x2" today={plan.today!} currency="EUR" tripName="Lisbon" testID="w" />,
    );
    expect(screen.getByLabelText(/Lisbon widget, .* left today/)).toBeOnTheScreen();
    expect(screen.queryByText('Add spend')).toBeNull();
    await rerender(
      <WidgetPreview
        size="4x2"
        today={plan.today!}
        upcoming={plan.days.slice(3)}
        currency="EUR"
        tripName="Lisbon"
        testID="w"
      />,
    );
    expect(screen.getByText('Add spend')).toBeOnTheScreen();
    expect(screen.getByText('Tue')).toBeOnTheScreen();
  });
});
