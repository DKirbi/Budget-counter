/**
 * The phone adapters, tested against fake device ports: what the camera/library/OCR/storage modules return is turned
 * into the shapes the scan flow expects. (The real Expo modules need a device; see docs/TESTING_ON_PHONE.md.)
 */
import { AI_KEY_NAME, rowsFromOcr } from '@tbc/core';
import {
  AI_PHOTO_WIDTH,
  PICK_LIMIT,
  STORED_PHOTO_WIDTH,
  createNativeScanServices,
  linesFromMlkit,
  type FilesPort,
  type ImageToolsPort,
  type MlkitPort,
  type NativePorts,
  type PickerPort,
  type SecurePort,
} from '../src/scan/native-services';

function setup(over: Partial<NativePorts> = {}) {
  const log = {
    toJpeg: [] as Array<{ uri: string; maxWidth: number; quality: number; base64: boolean }>,
    saved: [] as string[],
    removed: [] as string[],
  };
  const secrets = new Map<string, string>();
  const mlkit: MlkitPort = {
    isSupported: () => true,
    recognizeText: async () => ({
      text: 'CAFE\n2,50',
      blocks: [
        {
          lines: [
            { text: 'Kava', boundingBox: { x: 10, y: 100, width: 80, height: 20 } },
            { text: '2,50', boundingBox: { x: 300, y: 102, width: 50, height: 20 } },
          ],
        },
      ],
    }),
  };
  const picker: PickerPort = {
    requestCameraPermissionsAsync: async () => ({ granted: true }),
    launchCameraAsync: async () => ({ canceled: false, assets: [{ uri: 'file:///cam.jpg' }] }),
    launchImageLibraryAsync: async () => ({
      canceled: false,
      assets: [{ uri: 'file:///1.jpg' }, { uri: 'file:///2.jpg' }],
    }),
  };
  const imageTools: ImageToolsPort = {
    toJpeg: async (uri, o) => {
      log.toJpeg.push({ uri, ...o });
      return { uri: `${uri}.small.jpg`, ...(o.base64 ? { base64: 'QUJD' } : {}) };
    },
  };
  const files: FilesPort = {
    saveToApp: (uri) => {
      log.saved.push(uri);
      return 'file:///documents/bills/bill-1.jpg';
    },
    remove: (uri) => void log.removed.push(uri),
  };
  const secure: SecurePort = {
    getItemAsync: async (k) => secrets.get(k) ?? null,
    setItemAsync: async (k, v) => void secrets.set(k, v),
    deleteItemAsync: async (k) => void secrets.delete(k),
  };
  const ports: NativePorts = {
    mlkit: () => mlkit,
    picker: () => picker,
    imageTools: () => imageTools,
    files: () => files,
    secure: () => secure,
    ...over,
  };
  return { services: createNativeScanServices(ports), log, secrets, picker };
}

describe('OCR adapter', () => {
  it('turns ML Kit blocks into lines with boxes the row builder can pair up', async () => {
    const { services } = setup();
    const result = await services.ocr.recognize('file:///bill.jpg');
    expect(result.lines).toEqual([
      { text: 'Kava', box: { x: 10, y: 100, width: 80, height: 20 } },
      { text: '2,50', box: { x: 300, y: 102, width: 50, height: 20 } },
    ]);
    // Name and price sit on one visual row, joined by a column gap.
    expect(rowsFromOcr(result)).toEqual(['Kava\t2,50']);
  });

  it('flattens several blocks in order', () => {
    const box = { x: 0, y: 0, width: 1, height: 1 };
    expect(
      linesFromMlkit({
        text: '',
        blocks: [
          { lines: [{ text: 'a', boundingBox: box }] },
          { lines: [{ text: 'b', boundingBox: box }] },
        ],
      }).map((l) => l.text),
    ).toEqual(['a', 'b']);
  });

  it('reports "unsupported" when the module is missing (Expo Go) or says no', async () => {
    expect(await setup({ mlkit: () => null }).services.ocr.isSupported()).toBe(false);
    expect(
      await setup({
        mlkit: () => ({
          isSupported: () => false,
          recognizeText: async () => ({ text: '', blocks: [] }),
        }),
      }).services.ocr.isSupported(),
    ).toBe(false);
    expect(
      await setup({
        mlkit: () => {
          throw new Error("Cannot find native module 'ExpoMlkitOcr'");
        },
      }).services.ocr.isSupported(),
    ).toBe(false);
    expect(await setup().services.ocr.isSupported()).toBe(true);
  });

  it('refuses to recognise without the module, with a message the UI can show', async () => {
    await expect(setup({ mlkit: () => null }).services.ocr.recognize('x')).rejects.toThrow(
      /not available/,
    );
  });
});

describe('camera and library', () => {
  it('returns the photo URI', async () => {
    expect(await setup().services.picker.capture()).toBe('file:///cam.jpg');
  });

  it('returns null when the permission is denied, without opening the camera', async () => {
    const launch = jest.fn();
    const { services } = setup({
      picker: () => ({
        requestCameraPermissionsAsync: async () => ({ granted: false }),
        launchCameraAsync: launch,
        launchImageLibraryAsync: jest.fn(),
      }),
    });
    expect(await services.picker.capture()).toBeNull();
    expect(launch).not.toHaveBeenCalled();
  });

  it('returns null / empty when the user cancels', async () => {
    const { services } = setup({
      picker: () => ({
        requestCameraPermissionsAsync: async () => ({ granted: true }),
        launchCameraAsync: async () => ({ canceled: true, assets: null }),
        launchImageLibraryAsync: async () => ({ canceled: true }),
      }),
    });
    expect(await services.picker.capture()).toBeNull();
    expect(await services.picker.pick()).toEqual([]);
  });

  it('asks the library for many images and returns every URI', async () => {
    const launch = jest.fn(async () => ({ canceled: false, assets: [{ uri: 'a' }, { uri: 'b' }] }));
    const { services } = setup({
      picker: () => ({
        requestCameraPermissionsAsync: async () => ({ granted: true }),
        launchCameraAsync: async () => ({ canceled: true }),
        launchImageLibraryAsync: launch,
      }),
    });
    expect(await services.picker.pick()).toEqual(['a', 'b']);
    expect(launch).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: PICK_LIMIT,
      quality: 1,
    });
  });
});

describe('photo storage', () => {
  it('re-encodes to a bounded JPEG, then moves it into permanent app storage', async () => {
    const { services, log } = setup();
    expect(await services.images.persist('file:///cache/raw.jpg')).toBe(
      'file:///documents/bills/bill-1.jpg',
    );
    expect(log.toJpeg).toEqual([
      { uri: 'file:///cache/raw.jpg', maxWidth: STORED_PHOTO_WIDTH, quality: 0.9, base64: false },
    ]);
    expect(log.saved).toEqual(['file:///cache/raw.jpg.small.jpg']);
  });

  it('prepares a smaller base64 copy for AI', async () => {
    const { services, log } = setup();
    expect(await services.images.encodeForAi('file:///documents/bills/bill-1.jpg')).toEqual({
      base64: 'QUJD',
      mimeType: 'image/jpeg',
    });
    expect(log.toJpeg[0]).toMatchObject({ maxWidth: AI_PHOTO_WIDTH, base64: true });
    expect(AI_PHOTO_WIDTH).toBeLessThan(STORED_PHOTO_WIDTH);
  });

  it('fails clearly when no base64 came back', async () => {
    const { services } = setup({ imageTools: () => ({ toJpeg: async (uri) => ({ uri }) }) });
    await expect(services.images.encodeForAi('x')).rejects.toThrow(/could not be prepared/);
  });

  it('deleting a photo that is already gone is not an error', async () => {
    const { services, log } = setup({
      files: () => ({
        saveToApp: () => '',
        remove: () => {
          throw new Error('ENOENT');
        },
      }),
    });
    await expect(services.images.remove('file:///gone.jpg')).resolves.toBeUndefined();
    expect(log.removed).toEqual([]);
  });

  it('removes the photo file', async () => {
    const { services, log } = setup();
    await services.images.remove('file:///documents/bills/bill-1.jpg');
    expect(log.removed).toEqual(['file:///documents/bills/bill-1.jpg']);
  });
});

describe('secure storage', () => {
  it('stores, reads and removes the API key under its fixed name', async () => {
    const { services, secrets } = setup();
    expect(await services.secrets.get(AI_KEY_NAME)).toBeNull();
    await services.secrets.set(AI_KEY_NAME, 'k-123');
    expect(secrets.get('tbc.ai.apiKey')).toBe('k-123');
    expect(await services.secrets.get(AI_KEY_NAME)).toBe('k-123');
    await services.secrets.remove(AI_KEY_NAME);
    expect(await services.secrets.get(AI_KEY_NAME)).toBeNull();
  });
});

describe('laziness', () => {
  it('creating the services loads no native module', () => {
    const touched = jest.fn(() => {
      throw new Error('should not be called');
    });
    expect(() =>
      createNativeScanServices({
        mlkit: touched,
        picker: touched,
        imageTools: touched,
        files: touched,
        secure: touched,
      }),
    ).not.toThrow();
    expect(touched).not.toHaveBeenCalled();
  });
});
