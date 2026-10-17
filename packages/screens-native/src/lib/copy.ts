/**
 * User-facing wording shared by more than one screen, kept in one place for consistency and, later,
 * localisation.
 * @module lib/copy
 */
import type { OverspendPolicy } from '@tbc/core';

/** Title and explanation for each overspend policy. */
export const OVERSPEND_COPY: Record<OverspendPolicy, { title: string; description: string }> = {
  cascade: {
    title: 'Take it off tomorrow',
    description:
      'Strict. Overspending is deducted from the next day and keeps rolling forward until it is paid back.',
  },
  redistribute: {
    title: 'Spread it over the rest of the trip',
    description: 'Gentler. Overspending is shared evenly across every remaining day.',
  },
};
