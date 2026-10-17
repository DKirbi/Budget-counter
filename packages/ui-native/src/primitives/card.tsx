/**
 * Card — surface container with header / title / description / content / footer slots.
 * @module primitives/card
 */
import * as React from 'react';
import { View, type ViewProps } from 'react-native';
import { cn } from '../lib/cn';
import { Text, TextClassContext, type TextProps } from './text';

/** Elevated surface. Sets the default text colour for descendants. */
export function Card({ className, ...props }: ViewProps) {
  return (
    <TextClassContext.Provider value="text-card-foreground">
      <View
        className={cn(
          'flex flex-col gap-4 rounded-xl border border-border bg-card py-4 shadow-sm',
          className,
        )}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

/** Top section: title, description and optional action. */
export function CardHeader({ className, ...props }: ViewProps) {
  return <View className={cn('flex flex-col gap-1.5 px-4', className)} {...props} />;
}

/** Card heading — an `h2`, because every screen's `ScreenHeader` is the `h1` (heading levels must not skip). */
export function CardTitle({ className, ...props }: TextProps) {
  return (
    <Text
      role="heading"
      aria-level={2}
      className={cn('text-lg font-semibold leading-none', className)}
      {...props}
    />
  );
}

/** Secondary line under the title. */
export function CardDescription({ className, ...props }: TextProps) {
  return <Text className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

/** Main body. */
export function CardContent({ className, ...props }: ViewProps) {
  return <View className={cn('px-4', className)} {...props} />;
}

/** Bottom row, typically actions. */
export function CardFooter({ className, ...props }: ViewProps) {
  return <View className={cn('flex flex-row items-center px-4', className)} {...props} />;
}
