/**
 * Bridges `@tbc/core` validators to react-hook-form.
 *
 * Core returns flat `{ 'parts.1.amount': 'Enter an amount' }` maps; react-hook-form wants a nested
 * errors object. This adapter converts one into the other so forms stay free of validation logic.
 * @module lib/resolver
 */
import type { ValidationResult } from '@tbc/core';
import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';

type Bag = Record<string, unknown>;

/** Assign `message` at a dotted path, creating arrays for numeric segments. */
function assign(target: Bag, path: string, message: string): void {
  const keys = path.split('.');
  let cursor: Bag = target;
  keys.forEach((key, i) => {
    if (i === keys.length - 1) {
      cursor[key] = { type: 'validate', message };
      return;
    }
    const nextIsIndex = /^\d+$/.test(keys[i + 1] as string);
    cursor[key] ??= nextIsIndex ? [] : {};
    cursor = cursor[key] as Bag;
  });
}

/**
 * Turn a core validator into a react-hook-form resolver.
 * @param validate - e.g. `validateTripForm`.
 * @param arrayRootKeys - Keys whose own error belongs to the array as a whole (react-hook-form's `.root`), e.g. `['parts']`.
 * @example
 * useForm<TripFormValues>({ resolver: createResolver(validateTripForm) });
 */
export function createResolver<T extends FieldValues>(
  validate: (values: T) => ValidationResult<unknown>,
  arrayRootKeys: string[] = [],
): Resolver<T> {
  return async (values) => {
    const result = validate(values);
    if (result.ok) return { values, errors: {} };
    const errors: Bag = {};
    for (const [path, message] of Object.entries(result.errors)) {
      assign(errors, arrayRootKeys.includes(path) ? `${path}.root` : path, message);
    }
    return { values: {}, errors: errors as FieldErrors<T> };
  };
}
