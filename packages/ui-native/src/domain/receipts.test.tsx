import { fireEvent, screen } from '@testing-library/react-native';
import type { TimelineDay } from '@tbc/core';
import * as React from 'react';
import { makeIssue, makeReceipt, makeSpend } from '../testing-core';
import { renderUI } from '../testing';
import { ReceiptIssueCard } from './receipt-issue-card';
import { ReceiptPhoto } from './receipt-photo';
import { ReceiptRow } from './receipt-row';
import { ReceiptTimeline } from './receipt-timeline';
import { ScanResultRow } from './scan-result-row';

const dateIssue = makeIssue({
  dateChoices: [
    { date: '2026-04-28', label: 'Bill date · 28 Apr' },
    { date: '2026-05-03', label: 'Today' },
  ],
});

describe('ReceiptRow', () => {
  it('shows shop, time, category and amount; taps report the id', async () => {
    const onPress = jest.fn();
    const receipt = makeReceipt({ id: 'r1' });
    await renderUI(
      <ReceiptRow receipt={receipt} amount={1_250} currency="EUR" onPress={onPress} />,
    );
    expect(screen.getByText('Pastelaria Central')).toBeOnTheScreen();
    expect(screen.getByText('09:41 · Food & drink')).toBeOnTheScreen();
    expect(screen.getByText('€12.50')).toBeOnTheScreen();
    expect(screen.queryByText('Needs you')).toBeNull();
    await fireEvent.press(screen.getByTestId('receipt-row-r1'));
    expect(onPress).toHaveBeenCalledWith('r1');
  });

  it('flags bills that wait for the user, are not counted, are split or were read by AI', async () => {
    const attention = makeReceipt({ id: 'a', status: 'needs-attention' }, { source: 'ai' });
    await renderUI(
      <>
        <ReceiptRow receipt={attention} amount={1_250} currency="EUR" split />
        <ReceiptRow
          receipt={makeReceipt({ id: 'b', status: 'archived' })}
          amount={500}
          currency="EUR"
        />
      </>,
    );
    expect(screen.getByText('Needs you')).toBeOnTheScreen();
    expect(screen.getByText('Split')).toBeOnTheScreen();
    expect(screen.getByText('AI')).toBeOnTheScreen();
    expect(screen.getByText('Not counted')).toBeOnTheScreen();
    expect(screen.getByTestId('receipt-row-a').props.accessibilityLabel).toBe(
      'Pastelaria Central, Food & drink, €12.50, Needs you, split, read by AI',
    );
  });

  it('copes with a missing shop, amount and day', async () => {
    const receipt = makeReceipt({ id: 'x', date: null }, { merchant: undefined, time: undefined });
    await renderUI(<ReceiptRow receipt={receipt} amount={null} currency="EUR" showDate />);
    expect(screen.getByText('Unknown shop')).toBeOnTheScreen();
    expect(screen.getByText('—')).toBeOnTheScreen();
    expect(screen.getByTestId('receipt-row-x')).toBeDisabled();
    expect(screen.getByTestId('receipt-row-x').props.accessibilityLabel).toContain(
      'amount unknown',
    );
  });

  it('shows the day in lists that have no day header', async () => {
    await renderUI(
      <ReceiptRow
        receipt={makeReceipt({ date: '2026-05-02' })}
        amount={100}
        currency="EUR"
        showDate
      />,
    );
    expect(screen.getByText('2026-05-02 · 09:41 · Food & drink')).toBeOnTheScreen();
  });
});

describe('ReceiptIssueCard', () => {
  it('offers the days to choose from and marks the chosen one', async () => {
    const onChooseDate = jest.fn();
    await renderUI(
      <ReceiptIssueCard issue={dateIssue} selectedDate="2026-05-03" onChooseDate={onChooseDate} />,
    );
    expect(screen.getByTestId('issue-DATE_NOT_TODAY').props.role).toBe('alert');
    expect(screen.getByText('This bill is from 28 Apr')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('issue-DATE_NOT_TODAY-date-2026-04-28'));
    expect(onChooseDate).toHaveBeenCalledWith('2026-04-28');
    expect(screen.getByLabelText('File under Today')).toBeOnTheScreen();
  });

  it('never shows "this is fine" next to date choices, only when the answer is legitimate', async () => {
    const onAcknowledge = jest.fn();
    const { rerender } = await renderUI(
      <ReceiptIssueCard issue={dateIssue} onChooseDate={jest.fn()} onAcknowledge={onAcknowledge} />,
    );
    expect(screen.queryByTestId('issue-DATE_NOT_TODAY-ack')).toBeNull();

    rerender(
      <ReceiptIssueCard
        issue={makeIssue({ code: 'DUPLICATE', title: 'Looks like a bill you already scanned' })}
        onAcknowledge={onAcknowledge}
      />,
    );
    await fireEvent.press(screen.getByTestId('issue-DUPLICATE-ack'));
    expect(onAcknowledge).toHaveBeenCalledWith('DUPLICATE');
    expect(screen.getByText('Count it anyway')).toBeOnTheScreen();

    rerender(
      <ReceiptIssueCard
        issue={makeIssue({ code: 'NO_TOTAL', acknowledgeable: false })}
        onAcknowledge={onAcknowledge}
      />,
    );
    expect(screen.queryByTestId('issue-NO_TOTAL-ack')).toBeNull();
  });

  it('offers other trips and, for out-of-trip bills, keeping a digital copy', async () => {
    const onChooseTrip = jest.fn();
    const onKeepAsCopy = jest.fn();
    await renderUI(
      <ReceiptIssueCard
        issue={makeIssue({
          code: 'DATE_OUTSIDE_TRIP',
          acknowledgeable: false,
          tripChoices: [{ tripId: 'rome', label: 'Rome (10–14 Jun)' }],
        })}
        onChooseTrip={onChooseTrip}
        onKeepAsCopy={onKeepAsCopy}
      />,
    );
    await fireEvent.press(screen.getByTestId('issue-DATE_OUTSIDE_TRIP-trip-rome'));
    expect(onChooseTrip).toHaveBeenCalledWith('rome');
    await fireEvent.press(screen.getByTestId('issue-DATE_OUTSIDE_TRIP-keep'));
    expect(onKeepAsCopy).toHaveBeenCalledTimes(1);
  });

  it('collapses resolved and informational issues to a quiet line without buttons', async () => {
    await renderUI(
      <>
        <ReceiptIssueCard issue={{ ...dateIssue, resolved: true }} onChooseDate={jest.fn()} />
        <ReceiptIssueCard
          issue={makeIssue({
            code: 'MULTIPLE_DATES',
            severity: 'info',
            title: 'Two dates printed',
          })}
          onKeepAsCopy={jest.fn()}
        />
      </>,
    );
    expect(screen.getByTestId('issue-DATE_NOT_TODAY').props.role).toBeUndefined();
    expect(screen.getByTestId('issue-MULTIPLE_DATES').props.role).toBeUndefined();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByTestId('issue-DATE_NOT_TODAY')).toBeOnTheScreen();
    expect(screen.getByTestId('issue-MULTIPLE_DATES')).toBeOnTheScreen();
  });
});

describe('ReceiptTimeline', () => {
  const entry = (id: string, amount: number, time: string, split = false) => ({
    receipt: makeReceipt({ id }, { time, merchant: `Shop ${id}` }),
    spends: split
      ? [makeSpend({ amount: amount - 100 }), makeSpend({ amount: 100, tag: 'groceries' })]
      : [makeSpend({ amount })],
    amount,
  });
  const days: TimelineDay[] = [
    {
      date: '2026-05-03',
      total: 3_000,
      entries: [entry('a', 2_000, '19:02', true), entry('b', 1_000, '08:15')],
    },
    { date: '2026-05-02', total: 500, entries: [entry('c', 500, '12:00')] },
  ];

  it('groups bills by the day printed on them, with the day total', async () => {
    const onOpenReceipt = jest.fn();
    await renderUI(
      <ReceiptTimeline
        days={days}
        currency="EUR"
        today="2026-05-03"
        onOpenReceipt={onOpenReceipt}
      />,
    );
    expect(screen.getByTestId('timeline-day-2026-05-03')).toBeOnTheScreen();
    expect(screen.getByTestId('timeline-day-2026-05-02')).toBeOnTheScreen();
    expect(screen.getByLabelText('Sun 3 May, today, €30.00 in 2 bills')).toBeOnTheScreen();
    expect(screen.getByLabelText('Sat 2 May, €5.00 in 1 bill')).toBeOnTheScreen();
    expect(screen.getByText('Split')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('receipt-row-c'));
    expect(onOpenReceipt).toHaveBeenCalledWith('c');
  });

  it('renders nothing but the container for an empty timeline', async () => {
    await renderUI(<ReceiptTimeline days={[]} currency="EUR" />);
    expect(screen.getByTestId('timeline')).toBeOnTheScreen();
    expect(screen.queryByTestId(/^timeline-day-/)).toBeNull();
  });
});

describe('ReceiptPhoto', () => {
  it('explains when the bill was typed in', async () => {
    await renderUI(<ReceiptPhoto />);
    expect(screen.getByText('Entered by hand — no photo.')).toBeOnTheScreen();
  });

  it('shows the photo with a description, and a note when the file vanished', async () => {
    await renderUI(<ReceiptPhoto uri="file:///bill.jpg" label="Pastelaria" />);
    const image = screen.getByLabelText('Photo of the bill from Pastelaria');
    expect(image).toBeOnTheScreen();
    await fireEvent(image, 'error');
    expect(screen.getByText('The photo is no longer on this device.')).toBeOnTheScreen();
  });
});

describe('ScanResultRow', () => {
  it.each([
    ['reading', 'Reading…'],
    ['filed', 'Filed · 28 Apr'],
    ['attention', 'Needs you · 28 Apr'],
    ['failed', 'Could not read · 28 Apr'],
  ] as const)('describes the %s state', async (state, caption) => {
    await renderUI(
      <ScanResultRow
        state={state}
        title="Taxi"
        detail={state === 'reading' ? undefined : '28 Apr'}
        amount={state === 'failed' ? null : 3_000}
        testID="row"
      />,
    );
    expect(screen.getByText(caption)).toBeOnTheScreen();
    expect(screen.getByTestId('row').props.accessibilityLabel).toContain('Taxi');
  });

  it('is only tappable when there is something to open', async () => {
    const onPress = jest.fn();
    await renderUI(
      <>
        <ScanResultRow state="attention" title="A" onPress={onPress} testID="open" />
        <ScanResultRow state="failed" title="B" testID="closed" />
      </>,
    );
    await fireEvent.press(screen.getByTestId('open'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('closed')).toBeDisabled();
  });
});
