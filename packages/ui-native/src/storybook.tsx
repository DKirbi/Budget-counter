/**
 * Helpers for writing stories. Import from `@tbc/ui-native/storybook` — never from production code.
 * @module storybook
 */
import * as React from 'react';

/**
 * Local state for a controlled component in a story, seeded from (and reset by) a Storybook control.
 *
 * Why not `useArgs()`? That hook only works while Storybook itself calls the render function; any React re-render
 * of the story (theme change, safe-area measurement, …) throws "Storybook preview hooks can only be called inside
 * decorators and story functions". Plain React state + a sync effect has no such restriction.
 * @example
 * render: (args) => (
 *   <Controlled value={args.checked}>
 *     {(checked, setChecked) => <Switch checked={checked} onCheckedChange={setChecked} />}
 *   </Controlled>
 * )
 */
export function Controlled<T>({
  value,
  children,
}: {
  value: T;
  children: (value: T, setValue: (next: T) => void) => React.ReactNode;
}) {
  const [current, setCurrent] = React.useState(value);
  const [seen, setSeen] = React.useState(value);
  if (!Object.is(seen, value)) {
    // A Storybook control changed: adopt it (React's "adjust state while rendering" pattern, no effect needed).
    setSeen(value);
    setCurrent(value);
  }
  return <>{children(current, setCurrent)}</>;
}
