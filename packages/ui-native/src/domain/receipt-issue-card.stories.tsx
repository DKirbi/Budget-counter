import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { makeIssue } from '@tbc/core/testing';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Controlled } from '../storybook';
import { ReceiptIssueCard } from './receipt-issue-card';

/**
 * Something odd about a scanned bill, and the ways to settle it. Date problems offer the days to pick from, a bill
 * from another trip offers that trip, and a shaky reading offers "looks right". Settled issues collapse to one line.
 */
const meta = {
  title: 'Domain/ReceiptIssueCard',
  component: ReceiptIssueCard,
  args: {
    issue: makeIssue({
      dateChoices: [
        { date: '2026-04-28', label: 'Bill date · 28 Apr' },
        { date: '2026-05-03', label: 'Today' },
      ],
    }),
    onChooseDate: fn(),
    onAcknowledge: fn(),
    onChooseTrip: fn(),
    onKeepAsCopy: fn(),
  },
} satisfies Meta<typeof ReceiptIssueCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OddDate: Story = {
  render: (args) => (
    <Controlled<string | null> value={null}>
      {(date, setDate) => (
        <ReceiptIssueCard
          {...args}
          selectedDate={date}
          onChooseDate={(d) => {
            args.onChooseDate?.(d);
            setDate(d);
          }}
        />
      )}
    </Controlled>
  ),
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByTestId('issue-DATE_NOT_TODAY-date-2026-04-28'),
    );
    await expect(args.onChooseDate).toHaveBeenCalledWith('2026-04-28');
  },
};

export const Duplicate: Story = {
  args: {
    issue: makeIssue({
      code: 'DUPLICATE',
      title: 'Looks like a bill you already scanned',
      detail: 'Pastelaria Central, 2 May, €12.50 is already on the timeline.',
    }),
  },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByTestId('issue-DUPLICATE-ack'));
    await expect(args.onAcknowledge).toHaveBeenCalledWith('DUPLICATE');
  },
};

export const OtherTrip: Story = {
  args: {
    issue: makeIssue({
      code: 'DATE_OUTSIDE_TRIP',
      title: 'This bill is from before the trip',
      detail: '12 Mar is outside Lisbon long weekend (1–7 May). It fits another trip.',
      acknowledgeable: false,
      tripChoices: [{ tripId: 'rome', label: 'Rome (10–14 Mar)' }],
    }),
  },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByTestId('issue-DATE_OUTSIDE_TRIP-trip-rome'));
    await expect(args.onChooseTrip).toHaveBeenCalledWith('rome');
  },
};

export const Resolved: Story = {
  args: { issue: makeIssue({ resolved: true, title: 'Filed under 28 Apr' }) },
};
export const Info: Story = {
  args: {
    issue: makeIssue({
      code: 'MULTIPLE_DATES',
      severity: 'info',
      title: 'Two dates are printed on this bill',
      detail: 'We used the purchase date, 2 May, not the 9 May “valid until”.',
    }),
  },
};
