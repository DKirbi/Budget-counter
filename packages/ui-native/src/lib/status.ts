/**
 * Visual mapping for day statuses (from the allowance engine) so every component agrees on colour
 * and wording. Written out in full for Tailwind's scanner.
 * @module lib/status
 */
import type { DayStatus } from '@tbc/core';

/** Presentation of a {@link DayStatus}. */
export interface StatusStyle {
  label: string;
  badge: 'secondary' | 'success' | 'warning' | 'destructive';
  /** Fill for bars / dots. */
  bar: string;
  /** Text colour when the status is used as text. */
  text: string;
}

/** One entry per status. */
export const STATUS_STYLES: Record<DayStatus, StatusStyle> = {
  planned: {
    label: 'Planned',
    badge: 'secondary',
    bar: 'bg-muted-foreground/40',
    text: 'text-muted-foreground',
  },
  'on-track': { label: 'On track', badge: 'success', bar: 'bg-primary', text: 'text-success' },
  'near-limit': { label: 'Near limit', badge: 'warning', bar: 'bg-warning', text: 'text-warning' },
  over: { label: 'Over', badge: 'destructive', bar: 'bg-destructive', text: 'text-destructive' },
};
