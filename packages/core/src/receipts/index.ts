/**
 * Receipt scanning engine: OCR rows → parsed JSON → category → "is this bill odd?" checks → AI fallback.
 * Pure TypeScript with injected I/O (OCR engine, HTTP, secure storage), so it runs in React Native, on
 * the web and in tests alike.
 * @module receipts
 */
export * from './ai';
export * from './amounts';
export * from './analyze';
export * from './categorize';
export * from './ocr';
export * from './parse';
export * from './pipeline';
export * from './printedDates';
export * from './services';
export * from './types';
