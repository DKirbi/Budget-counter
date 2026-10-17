/**
 * Package `@tbc/core` — platform-agnostic budget domain.
 * React bindings live in `@tbc/core/react`; fixtures in `@tbc/core/testing`.
 * @packageDocumentation
 */
export * from './allowance';
export * from './dates';
export * from './demo';
export * from './forms';
export * from './money';
export * from './summary';
export * from './types';
export * from './store/budgetStore';
export * from './store/selectors';
export * from './store/storage';

/** Working title of the app. One constant so renaming is a one-line change. */
export const APP_NAME = 'Budget Counter';
