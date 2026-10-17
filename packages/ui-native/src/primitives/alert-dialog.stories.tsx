import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import * as React from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { ConfirmDialog } from './alert-dialog';
import { Button } from './button';
import { Text } from './text';

/**
 * `ConfirmDialog` wraps Radix/rn-primitives AlertDialog. Destructive confirmations always say what will be lost and
 * put **Cancel first** (the safe choice is the easy one).
 */
const meta = {
  title: 'Primitives/ConfirmDialog',
  component: ConfirmDialog,
  args: {
    open: false,
    onOpenChange: fn(),
    onConfirm: fn(),
    title: 'Delete this spend?',
    description: 'This cannot be undone.',
    confirmLabel: 'Delete',
    destructive: true,
    testID: 'confirm',
  },
  render: function Render(args) {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        <Button variant="outline" onPress={() => setOpen(true)} testID="open-dialog">
          <Text>Delete…</Text>
        </Button>
        <ConfirmDialog {...args} open={open} onOpenChange={setOpen} />
      </>
    );
  },
} satisfies Meta<typeof ConfirmDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ConfirmFlow: Story = {
  play: async ({ canvasElement, args }) => {
    // The dialog renders in a portal at the document root, so query the whole body.
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvasElement).getByTestId('open-dialog'));
    await expect(await body.findByText('Delete this spend?')).toBeVisible();
    await userEvent.click(body.getByTestId('confirm-cancel'));
    await waitFor(() => expect(body.queryByText('Delete this spend?')).toBeNull());
    await expect(args.onConfirm).not.toHaveBeenCalled();

    await userEvent.click(within(canvasElement).getByTestId('open-dialog'));
    await userEvent.click(await body.findByTestId('confirm-confirm'));
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
  },
};
