/**
 * Ports for everything the scan flow needs from the device. The domain code never imports a native
 * module; the app injects implementations (`expo-mlkit-ocr`, `expo-image-picker`, `expo-secure-store`,
 * `fetch`) and tests and Storybook inject the fakes from `./fakes`.
 * @module receipts/services
 */
import type { AiImage } from './ai';
import type { OcrResult } from './types';

/** On-device text recognition. */
export interface OcrEngine {
  /** `false` where no engine exists (Expo Go, web); the UI then offers to type the bill in. */
  isSupported(): Promise<boolean>;
  /** Recognise the text in a local image file. */
  recognize(uri: string): Promise<OcrResult>;
}

/** Getting photos into the app. */
export interface ImagePicker {
  /** Open the camera. Resolves with the file URI, or `null` if cancelled / permission denied. */
  capture(): Promise<string | null>;
  /** Open the photo library for one or many bills. Resolves with file URIs (empty if cancelled). */
  pick(): Promise<string[]>;
}

/** Photo storage inside the app. */
export interface ImageStore {
  /** Copy a picked/captured image into app storage and return its stable URI. */
  persist(uri: string): Promise<string>;
  /** Delete a stored image (no error if it is already gone). */
  remove(uri: string): Promise<void>;
  /** Downscale and encode a stored image for upload to an AI service. */
  encodeForAi(uri: string): Promise<AiImage>;
}

/** Small secret values (API keys) in the OS keychain/keystore. Never the zustand store. */
export interface SecretStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** Name under which the AI API key is stored. */
export const AI_KEY_NAME = 'tbc.ai.apiKey';

/** Everything the scan screens need from the device. */
export interface ScanServices {
  ocr: OcrEngine;
  picker: ImagePicker;
  images: ImageStore;
  secrets: SecretStore;
  /** HTTP for the AI fallback. Defaults to the global `fetch`. */
  fetch?: typeof fetch;
}
