/**
 * Class-name helper used by every component: `clsx` for conditionals, `tailwind-merge` so a caller's
 * `className` can override a component's defaults (`cn('px-4', 'px-2')` -> `'px-2'`).
 * @module lib/cn
 */
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names, resolving Tailwind conflicts in favour of the last one.
 * @param inputs - Strings, arrays, or `{ class: boolean }` maps.
 * @returns A single class string.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
