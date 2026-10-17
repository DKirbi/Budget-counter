/**
 * In-memory implementations of the scan ports for tests, Storybook and the Expo Go "demo scan".
 * @module receipts/fakes
 */
import type { AiImage } from './ai';
import { RECEIPT_FIXTURES, fixtureOcr } from './fixtures';
import { ocrFromText } from './ocr';
import type { ScanServices } from './services';
import type { OcrResult } from './types';

/** Options for {@link createFakeScanServices}. */
export interface FakeScanOptions {
  /** OCR text by image URI. Unknown URIs return the text `fallbackText` (default: nothing readable). */
  ocrByUri?: Record<string, string | OcrResult>;
  fallbackText?: string;
  /** URIs the next `capture()` calls return, in order. */
  captures?: Array<string | null>;
  /** URIs `pick()` returns. */
  picks?: string[];
  /** Pretend there is no OCR engine (Expo Go / web). */
  ocrSupported?: boolean;
  /** Fake API response body for AI calls. `status` defaults to 200. */
  aiResponse?: { status?: number; body: unknown; headers?: Record<string, string> };
  /** Make the fake `fetch` reject, as if offline. */
  offline?: boolean;
  /** Secrets to start with. */
  secrets?: Record<string, string>;
}

/** A fake service bundle that also records what was done to it. */
export interface FakeScanServices extends ScanServices {
  calls: {
    recognized: string[];
    removed: string[];
    encoded: string[];
    fetches: Array<{ url: string; headers: Record<string, string>; body: unknown }>;
  };
  secretValues: Record<string, string>;
}

const TINY_JPEG: AiImage = { base64: '/9j/4AAQSkZJRg==', mimeType: 'image/jpeg' };

/**
 * Build fake scan services.
 * @param o - Behaviour, see {@link FakeScanOptions}.
 */
export function createFakeScanServices(o: FakeScanOptions = {}): FakeScanServices {
  const captures = [...(o.captures ?? [])];
  const secretValues = { ...(o.secrets ?? {}) };
  const calls: FakeScanServices['calls'] = {
    recognized: [],
    removed: [],
    encoded: [],
    fetches: [],
  };

  const fake: FakeScanServices = {
    calls,
    secretValues,
    ocr: {
      isSupported: async () => o.ocrSupported ?? true,
      recognize: async (uri) => {
        calls.recognized.push(uri);
        const hit = o.ocrByUri?.[uri];
        if (typeof hit === 'string') return ocrFromText(hit);
        if (hit) return hit;
        return ocrFromText(o.fallbackText ?? '');
      },
    },
    picker: {
      capture: async () => (captures.length > 0 ? (captures.shift() ?? null) : null),
      pick: async () => [...(o.picks ?? [])],
    },
    images: {
      persist: async (uri) => uri,
      remove: async (uri) => void calls.removed.push(uri),
      encodeForAi: async (uri) => {
        calls.encoded.push(uri);
        return TINY_JPEG;
      },
    },
    secrets: {
      get: async (k) => secretValues[k] ?? null,
      set: async (k, v) => void (secretValues[k] = v),
      remove: async (k) => void delete secretValues[k],
    },
    fetch: (async (url: RequestInfo | URL, init?: RequestInit) => {
      if (o.offline) throw new TypeError('Network request failed');
      calls.fetches.push({
        url: String(url),
        headers: (init?.headers ?? {}) as Record<string, string>,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      const status = o.aiResponse?.status ?? 200;
      const headers = new Headers(o.aiResponse?.headers ?? {});
      return new Response(JSON.stringify(o.aiResponse?.body ?? {}), { status, headers });
    }) as typeof fetch,
  };
  return fake;
}

/** `image://fixture/<id>` URIs for every synthetic bill, mapped to its OCR result. */
export function fixtureImages(): Record<string, OcrResult> {
  return Object.fromEntries(
    RECEIPT_FIXTURES.map((f) => [`image://fixture/${f.id}`, fixtureOcr(f)]),
  );
}
