/**
 * The real Expo modules behind {@link NativePorts}. Every `require` is deferred until first use and the OCR module is
 * optional: Expo Go does not contain `expo-mlkit-ocr`, so loading it there throws — we report "unsupported" instead
 * and the scan screen falls back to saving photos for AI or hand entry.
 * @module scan/device
 */
import type * as ExpoFileSystem from 'expo-file-system';
import type * as ExpoImageManipulator from 'expo-image-manipulator';
import { createNativeScanServices, type NativePorts } from './native-services';

/** Device ports backed by Expo modules. */
export const devicePorts: NativePorts = {
  mlkit: () => {
    try {
      return require('expo-mlkit-ocr') as ReturnType<NativePorts['mlkit']>;
    } catch {
      return null;
    }
  },
  picker: () => require('expo-image-picker') as ReturnType<NativePorts['picker']>,
  imageTools: () => {
    const { ImageManipulator, SaveFormat } =
      require('expo-image-manipulator') as typeof ExpoImageManipulator;
    return {
      async toJpeg(uri, { maxWidth, quality, base64 }) {
        const source = await ImageManipulator.manipulate(uri).renderAsync();
        // Only ever shrink: upscaling a small photo adds bytes, not legibility.
        const image =
          source.width > maxWidth
            ? await ImageManipulator.manipulate(source).resize({ width: maxWidth }).renderAsync()
            : source;
        const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: quality, base64 });
        return { uri: saved.uri, ...(saved.base64 ? { base64: saved.base64 } : {}) };
      },
    };
  },
  files: () => {
    const { Directory, File, Paths } = require('expo-file-system') as typeof ExpoFileSystem;
    return {
      saveToApp(uri) {
        const dir = new Directory(Paths.document, 'bills');
        dir.create({ intermediates: true, idempotent: true });
        const target = new File(
          dir,
          `bill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`,
        );
        new File(uri).copy(target);
        return target.uri;
      },
      remove(uri) {
        const file = new File(uri);
        if (file.exists) file.delete();
      },
    };
  },
  secure: () => require('expo-secure-store') as ReturnType<NativePorts['secure']>,
};

/** The app's scan services (OCR, camera/library, photo storage, secure key storage). */
export const nativeScanServices = createNativeScanServices(devicePorts);
