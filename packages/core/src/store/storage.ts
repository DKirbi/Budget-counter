/**
 * Storage abstraction for persistence.
 *
 * zustand's `persist` speaks `StateStorage` (getItem / setItem / removeItem, sync or async).
 * React Native passes AsyncStorage, the web app will pass `localStorage`, tests pass memory.
 * @module store/storage
 */
import type { StateStorage } from 'zustand/middleware';

export type { StateStorage };

/**
 * In-memory storage. Synchronous, so a store using it is hydrated the moment it is created —
 * ideal for unit tests, Storybook stories and SSR.
 * @param initial - Optional seed of raw key/value pairs.
 */
export function createMemoryStorage(
  initial: Record<string, string> = {},
): StateStorage & { dump(): Record<string, string> } {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (name) => map.get(name) ?? null,
    setItem: (name, value) => void map.set(name, value),
    removeItem: (name) => void map.delete(name),
    dump: () => Object.fromEntries(map),
  };
}
