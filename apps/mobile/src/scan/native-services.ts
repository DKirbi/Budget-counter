/**
 * The phone's implementation of the scan ports (`ScanServices` from `@tbc/core`).
 *
 * `createNativeScanServices` takes the native capabilities as small structural interfaces, so everything between
 * "the camera returned a file" and "the parser received text" is unit-tested with fakes (see
 * `__tests__/native-services.test.ts`). `./device.ts` supplies the real Expo modules.
 * @module scan/native-services
 */
import { type AiImage, type OcrLine, type OcrResult, type ScanServices } from '@tbc/core';

/** Longest side, in pixels, of the photo kept on the device. Big enough for small print, small enough to store. */
export const STORED_PHOTO_WIDTH = 1800;
/** Width of the copy sent to an AI service: cheaper and faster, still legible for receipt text. */
export const AI_PHOTO_WIDTH = 1280;
/** How many photos the library picker may return at once. */
export const PICK_LIMIT = 30;

/** Result of `recognizeText` in `expo-mlkit-ocr`. */
export interface MlkitResult {
  text: string;
  blocks: Array<{
    lines: Array<{
      text: string;
      boundingBox: { x: number; y: number; width: number; height: number };
    }>;
  }>;
}

/** The part of `expo-mlkit-ocr` the app uses. */
export interface MlkitPort {
  isSupported(): boolean;
  recognizeText(uri: string): Promise<MlkitResult>;
}

/** What `expo-image-picker` returns. */
export interface PickerResult {
  canceled: boolean;
  assets?: Array<{ uri: string }> | null;
}

/** The part of `expo-image-picker` the app uses. */
export interface PickerPort {
  requestCameraPermissionsAsync(): Promise<{ granted: boolean }>;
  launchCameraAsync(options: { mediaTypes: ['images']; quality: number }): Promise<PickerResult>;
  launchImageLibraryAsync(options: {
    mediaTypes: ['images'];
    allowsMultipleSelection: boolean;
    selectionLimit: number;
    quality: number;
  }): Promise<PickerResult>;
}

/** Re-encode a local image as a JPEG no wider than `maxWidth`. */
export interface ImageToolsPort {
  toJpeg(
    uri: string,
    options: { maxWidth: number; quality: number; base64: boolean },
  ): Promise<{ uri: string; base64?: string }>;
}

/** Files inside the app's own storage. */
export interface FilesPort {
  /** Copy a (cache) file into permanent app storage; returns the new URI. */
  saveToApp(uri: string): string;
  /** Delete a file; no error if it is already gone. */
  remove(uri: string): void;
}

/** The part of `expo-secure-store` the app uses. */
export interface SecurePort {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

/** Everything {@link createNativeScanServices} needs from the device. */
export interface NativePorts {
  /** `null` where the native module is missing (Expo Go, web). */
  mlkit: () => MlkitPort | null;
  picker: () => PickerPort;
  imageTools: () => ImageToolsPort;
  files: () => FilesPort;
  secure: () => SecurePort;
}

/** Flatten ML Kit blocks into lines with boxes, keeping reading order. */
export function linesFromMlkit(result: MlkitResult): OcrLine[] {
  return result.blocks
    .flatMap((b) => b.lines)
    .map((l) => ({ text: l.text, box: { ...l.boundingBox } }));
}

/**
 * Build the scan services from device ports. Ports are resolved lazily (on first use), so creating the services
 * never loads a native module — an app that never scans never pays for them, and Jest never needs them.
 * @param ports - Device capabilities.
 * @example
 * const services = createNativeScanServices(devicePorts);
 */
export function createNativeScanServices(ports: NativePorts): ScanServices {
  return {
    ocr: {
      isSupported: async () => {
        try {
          return ports.mlkit()?.isSupported() === true;
        } catch {
          return false;
        }
      },
      recognize: async (uri): Promise<OcrResult> => {
        const mlkit = ports.mlkit();
        if (!mlkit) throw new Error('Text recognition is not available in this build.');
        const result = await mlkit.recognizeText(uri);
        return { text: result.text, lines: linesFromMlkit(result) };
      },
    },
    picker: {
      capture: async () => {
        const picker = ports.picker();
        const permission = await picker.requestCameraPermissionsAsync();
        if (!permission.granted) return null;
        const result = await picker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
        return result.canceled ? null : (result.assets?.[0]?.uri ?? null);
      },
      pick: async () => {
        const result = await ports.picker().launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: true,
          selectionLimit: PICK_LIMIT,
          quality: 1,
        });
        return result.canceled ? [] : (result.assets ?? []).map((a) => a.uri);
      },
    },
    images: {
      persist: async (uri) => {
        // Re-encoding also bakes the camera's rotation flag into the pixels, so every later step sees it upright.
        const jpeg = await ports.imageTools().toJpeg(uri, {
          maxWidth: STORED_PHOTO_WIDTH,
          quality: 0.9,
          base64: false,
        });
        return ports.files().saveToApp(jpeg.uri);
      },
      remove: async (uri) => {
        try {
          ports.files().remove(uri);
        } catch {
          // Already gone, or the system cleaned it up: nothing to do.
        }
      },
      encodeForAi: async (uri): Promise<AiImage> => {
        const jpeg = await ports.imageTools().toJpeg(uri, {
          maxWidth: AI_PHOTO_WIDTH,
          quality: 0.7,
          base64: true,
        });
        if (!jpeg.base64) throw new Error('The photo could not be prepared for upload.');
        return { base64: jpeg.base64, mimeType: 'image/jpeg' };
      },
    },
    secrets: {
      get: async (key) => ports.secure().getItemAsync(key),
      set: async (key, value) => ports.secure().setItemAsync(key, value),
      remove: async (key) => ports.secure().deleteItemAsync(key),
    },
  };
}
