/**
 * AlertDialog + ConfirmDialog.
 * Requires a `<PortalHost />` near the app root (provided by {@link UIProvider}).
 * `ConfirmDialog` is the batteries-included version used for destructive confirmations.
 * @module primitives/alert-dialog
 */
import * as AlertDialogPrimitive from '@rn-primitives/alert-dialog';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';
import { cn } from '../lib/cn';
import { FullWindowOverlay } from '../lib/full-window-overlay';
import { buttonTextVariants, buttonVariants } from './button';
import { Text, TextClassContext, type TextProps } from './text';

/** Dialog root; controlled with `open` / `onOpenChange`. */
export const AlertDialog = AlertDialogPrimitive.Root;
/** Element that opens the dialog when pressed. */
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
/** Renders children into the app's PortalHost. */
export const AlertDialogPortal = AlertDialogPrimitive.Portal;

/** Dimmed backdrop; also centres the content. */
export function AlertDialogOverlay({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <FullWindowOverlay>
      <AlertDialogPrimitive.Overlay
        className={cn(
          'absolute inset-0 z-50 items-center justify-center bg-black/60 p-6',
          className,
        )}
        {...props}
      >
        {children}
      </AlertDialogPrimitive.Overlay>
    </FullWindowOverlay>
  );
}

/** The dialog surface, mounted inside overlay + portal. */
export function AlertDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay>
        <AlertDialogPrimitive.Content
          className={cn(
            'z-50 w-full max-w-md gap-4 rounded-xl border border-border bg-card p-6 shadow-lg',
            className,
          )}
          {...props}
        />
      </AlertDialogOverlay>
    </AlertDialogPortal>
  );
}

/** Title + description block. */
export function AlertDialogHeader({ className, ...props }: ViewProps) {
  return <View className={cn('gap-2', className)} {...props} />;
}

/** Button row. */
export function AlertDialogFooter({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn('flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

/** Dialog heading. */
export function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      className={cn('text-lg font-semibold text-foreground', className)}
      {...props}
    />
  );
}

/** Explanatory text. */
export function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

/** Confirming button (styled as `default`, or pass `variant`-like classes via className). */
export function AlertDialogAction({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action>) {
  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant: 'default' })}>
      <AlertDialogPrimitive.Action className={cn(buttonVariants(), className)} {...props} />
    </TextClassContext.Provider>
  );
}

/** Dismissing button. */
export function AlertDialogCancel({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant: 'outline' })}>
      <AlertDialogPrimitive.Cancel
        className={cn(buttonVariants({ variant: 'outline' }), className)}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

/** Props for {@link ConfirmDialog}. */
export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Paint the confirm button red. Use for deletes. */
  destructive?: boolean;
  onConfirm: () => void;
  testID?: string;
}

/**
 * Yes/no confirmation.
 * @example
 * <ConfirmDialog open={open} onOpenChange={setOpen} destructive title="Delete this trip?"
 *   description="Its spends will be removed too." confirmLabel="Delete" onConfirm={remove} />
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  onConfirm,
  testID,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent testID={testID}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel testID={testID ? `${testID}-cancel` : undefined}>
            <Text>{cancelLabel}</Text>
          </AlertDialogCancel>
          <TextClassContext.Provider
            value={buttonTextVariants({ variant: destructive ? 'destructive' : 'default' })}
          >
            <AlertDialogPrimitive.Action
              className={cn(buttonVariants({ variant: destructive ? 'destructive' : 'default' }))}
              onPress={onConfirm}
              testID={testID ? `${testID}-confirm` : undefined}
            >
              <Text>{confirmLabel}</Text>
            </AlertDialogPrimitive.Action>
          </TextClassContext.Provider>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export type { TextProps };
