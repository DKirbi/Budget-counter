/**
 * Package `@tbc/ui-native` — the React Native design system.
 *
 * Primitives follow shadcn/ui naming (Button, Card, Badge, Tabs, AlertDialog, …) on top of
 * rn-primitives (the React Native counterpart of Radix). Domain components compose them into the
 * pieces this app needs (AllowanceRing, SpendRow, DayCard, …).
 * @packageDocumentation
 */
export { cn } from './lib/cn';
export { STATUS_STYLES, type StatusStyle } from './lib/status';
export { TAG_CLASSES, TAG_ICONS } from './lib/tags';

export * from './primitives/alert';
export * from './primitives/alert-dialog';
export * from './primitives/badge';
export * from './primitives/button';
export * from './primitives/card';
export * from './primitives/field';
export * from './primitives/icon';
export * from './primitives/input';
export * from './primitives/label';
export * from './primitives/progress';
export * from './primitives/radio-group';
export * from './primitives/separator';
export * from './primitives/skeleton';
export * from './primitives/stepper';
export * from './primitives/switch';
export * from './primitives/tabs';
export * from './primitives/text';
export * from './primitives/toggle-group';

export * from './domain/allowance-ring';
export * from './domain/amount-input';
export * from './domain/category-bar';
export * from './domain/day-card';
export * from './domain/empty-state';
export * from './domain/money-text';
export * from './domain/spend-row';
export * from './domain/stat-tile';
export * from './domain/tag-icon';
export * from './domain/tag-picker';
export * from './domain/week-strip';
export * from './domain/widget-preview';

export * from './layout';
export * from './theme/theme';
