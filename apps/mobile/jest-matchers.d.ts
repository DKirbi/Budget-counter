/**
 * Type declarations for the custom Jest matchers that `expo-router/testing-library` registers at runtime
 * (`expect(screen).toHavePathname('/')`). The package ships the implementation but an empty `expect.d.ts`,
 * so without this file `tsc` rejects every navigation assertion. Delete it if a future SDK ships the types.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Jest's Matchers interface is only extensible this way.
  namespace jest {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- `R` must be declared to merge with Jest's interface.
    interface Matchers<R> {
      /** The router's current pathname (no query string). */
      toHavePathname(pathname: string): R;
      /** The router's current pathname including the query string. */
      toHavePathnameWithParams(pathnameWithParams: string): R;
      /** The matched route segments, e.g. `['(tabs)', 'days']`. */
      toHaveSegments(segments: string[]): R;
      /** The current search params. */
      toHaveSearchParams(params: Record<string, string | string[]>): R;
      /** A partial of the React Navigation state. */
      toHaveRouterState(state: unknown): R;
    }
  }
}

export {};
