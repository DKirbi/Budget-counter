/**
 * The optional AI fallback: send the photo of a bill to a vision model and get the receipt JSON back.
 *
 * Design rules:
 * - **Never automatic.** The UI asks every time ("send this photo to Google?"); nothing leaves the
 *   device otherwise. The app works fully offline without this module ever being called.
 * - **Bring your own key.** The key lives in the device's secure storage and is passed in per call;
 *   it is never stored in the zustand store or logged.
 * - **No SDKs.** Two plain `fetch` calls (Gemini `generateContent`, OpenAI-style `chat/completions`),
 *   with `fetch` injected so tests run against a fake and the app can later point at its own proxy.
 * - **Never trusted blindly.** The model's JSON is validated with zod, coerced to minor units, and run
 *   through the same odd-bill checks as OCR results.
 * @module receipts/ai
 */
import { z } from 'zod';
import { type ISODate, isISODate } from '../dates';
import { CURRENCY_CODES, type CurrencyCode, type Minor, getCurrency, parseAmount } from '../money';
import { AI_PROVIDERS, type AiSettings } from '../types';
import { scoreConfidence } from './parse';
import {
  RECEIPT_SCHEMA_VERSION,
  type PaymentMethod,
  type ReceiptData,
  type ReceiptItem,
} from './types';

/** A photo ready to upload. */
export interface AiImage {
  /** Base64 without the `data:` prefix. */
  base64: string;
  /** e.g. `image/jpeg`. */
  mimeType: string;
}

/** Why an AI call failed — each maps to a different message and recovery in the UI. */
export type AiErrorCode =
  /** AI is switched off in settings. */
  | 'NOT_CONFIGURED'
  /** No API key saved. */
  | 'NO_KEY'
  /** The app's own daily cap is used up. */
  | 'LIMIT_REACHED'
  /** The provider said "slow down / free quota used" (HTTP 429). */
  | 'RATE_LIMITED'
  /** The key was rejected (HTTP 401/403). */
  | 'UNAUTHORIZED'
  /** The model name is unknown or retired (HTTP 404). */
  | 'MODEL_NOT_FOUND'
  /** No connection, or the request was aborted. */
  | 'NETWORK'
  /** The provider answered, but not with usable receipt JSON. */
  | 'BAD_RESPONSE'
  /** Any other HTTP error. */
  | 'HTTP';

/** Thrown by {@link readReceiptWithAi}. `message` is safe to show to the user. */
export class AiError extends Error {
  constructor(
    public readonly code: AiErrorCode,
    message: string,
    public readonly status?: number,
    /** Seconds to wait before retrying, when the provider said so. */
    public readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

/** Everything {@link readReceiptWithAi} needs. */
export interface AiReadOptions {
  settings: AiSettings;
  /** The user's API key, read from secure storage just now. */
  apiKey: string | null | undefined;
  image: AiImage;
  /** What the on-device OCR read — a hint, the image is the authority. */
  ocrText?: string;
  /** Today, so the model is told *not* to mistake it for the receipt date. */
  today: ISODate;
  /** Currency to assume when nothing is printed. */
  tripCurrency?: CurrencyCode;
  /** Injected for tests; defaults to the global `fetch`. */
  fetch?: typeof fetch;
  signal?: AbortSignal;
}

/** The instructions sent with every photo. Exported so tests and docs show exactly what leaves the device. */
export function buildPrompt(
  opts: Pick<AiReadOptions, 'ocrText' | 'today' | 'tripCurrency'>,
): string {
  const lines = [
    'You read photos of paper receipts and return their content as JSON.',
    'Return ONE JSON object and nothing else (no markdown, no commentary) with exactly these keys:',
    '{',
    '  "merchant": string|null,        // shop or restaurant name as printed',
    '  "date": "YYYY-MM-DD"|null,       // the PURCHASE date printed on the receipt',
    '  "dateAmbiguous": boolean,        // true if day/month order cannot be told from the receipt',
    '  "time": "HH:MM"|null,            // 24-hour',
    '  "currency": string|null,         // ISO 4217 code, e.g. "EUR"',
    '  "total": number|null,            // amount actually charged',
    '  "subtotal": number|null, "tax": number|null, "tip": number|null,',
    '  "items": [{ "description": string, "quantity": number|null, "amount": number }],',
    '  "paymentMethod": "card"|"cash"|null,',
    '  "receiptNumber": string|null',
    '}',
    'Rules:',
    '- Amounts are plain numbers in major units with a dot as decimal separator (12.5 means twelve and a half). Discounts are negative.',
    '- Use null for anything that is not printed. Never guess or invent values.',
    `- Today is ${opts.today}. That is context only: never use it as the receipt date unless it is printed.`,
    '- If the receipt date could be read as day/month or month/day, give your best reading and set "dateAmbiguous": true.',
    `- If no currency is printed, use ${opts.tripCurrency ?? 'null'}.`,
  ];
  const hint = opts.ocrText?.trim();
  if (hint) {
    lines.push(
      'Text recognised on the device (may contain mistakes; the image is authoritative):',
      '"""',
      hint.slice(0, 4000),
      '"""',
    );
  }
  return lines.join('\n');
}

// ── response handling ─────────────────────────────────────────────────────────────────────────

const num = z.union([z.number(), z.string()]).nullish();
const aiReceiptSchema = z.object({
  merchant: z.string().nullish(),
  date: z.string().nullish(),
  dateAmbiguous: z.boolean().nullish(),
  time: z.string().nullish(),
  currency: z.string().nullish(),
  total: num,
  subtotal: num,
  tax: num,
  tip: num,
  items: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.union([z.number(), z.string()]).nullish(),
        amount: num,
      }),
    )
    .nullish(),
  paymentMethod: z.string().nullish(),
  receiptNumber: z.string().nullish(),
});

/** Pull the JSON object out of a model reply, tolerating code fences and chatter around it. */
export function extractJson(text: string): unknown {
  const stripped = text.replace(/```(?:json)?/gi, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end <= start)
    throw new AiError('BAD_RESPONSE', 'The AI did not return receipt data.');
  try {
    return JSON.parse(stripped.slice(start, end + 1));
  } catch {
    throw new AiError('BAD_RESPONSE', 'The AI reply was not valid JSON.');
  }
}

function toMinor(
  value: string | number | null | undefined,
  currency: CurrencyCode,
): Minor | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const { decimals } = getCurrency(currency);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return undefined;
    const minor = Math.round(value * 10 ** decimals);
    return Number.isSafeInteger(minor) ? minor : undefined;
  }
  const negative = value.trim().startsWith('-');
  const parsed = parseAmount(value.replace(/[^\d.,\s']/g, ''), currency);
  return parsed === null ? undefined : negative ? -parsed : parsed;
}

/**
 * Validate and convert a model reply into {@link ReceiptData}.
 * @param raw - Parsed JSON (see {@link extractJson}).
 * @param tripCurrency - Currency to assume when the model returned none or an unsupported one.
 * @throws {AiError} `BAD_RESPONSE` when the shape is wrong.
 */
export function receiptFromAiJson(raw: unknown, tripCurrency: CurrencyCode = 'EUR'): ReceiptData {
  const parsed = aiReceiptSchema.safeParse(raw);
  if (!parsed.success)
    throw new AiError('BAD_RESPONSE', 'The AI reply did not look like a receipt.');
  const r = parsed.data;

  const code = r.currency?.trim().toUpperCase();
  const currency: CurrencyCode = (CURRENCY_CODES as readonly string[]).includes(code ?? '')
    ? (code as CurrencyCode)
    : tripCurrency;
  const money = (v: string | number | null | undefined) => toMinor(v, currency);
  const positive = (v: Minor | undefined) => (v !== undefined && v > 0 ? v : undefined);

  const dateText = r.date?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  const date = dateText && isISODate(dateText) ? dateText : undefined;
  const time = r.time?.match(/^(\d{1,2}):(\d{2})/);
  const items: ReceiptItem[] = (r.items ?? []).flatMap((i) => {
    const amount = money(i.amount);
    const description = i.description.trim();
    if (amount === undefined || !description) return [];
    const q = typeof i.quantity === 'string' ? Number(i.quantity.replace(',', '.')) : i.quantity;
    return [{ description, amount, ...(q && q > 0 ? { quantity: q } : {}) }];
  });
  const total = positive(money(r.total));
  const subtotal = positive(money(r.subtotal));
  const tax = positive(money(r.tax));
  const tip = positive(money(r.tip));
  const merchant = r.merchant?.trim() || undefined;
  const pm = r.paymentMethod?.toLowerCase();
  const paymentMethod: PaymentMethod | undefined = pm === 'card' || pm === 'cash' ? pm : undefined;
  const receiptNumber = r.receiptNumber?.trim() || undefined;
  const dateAmbiguous = date !== undefined && r.dateAmbiguous === true;

  const data: ReceiptData = {
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    source: 'ai',
    ...(merchant ? { merchant } : {}),
    ...(date ? { date } : {}),
    ...(dateAmbiguous ? { dateAmbiguous } : {}),
    ...(time ? { time: `${time[1]!.padStart(2, '0')}:${time[2]}` } : {}),
    currency,
    ...(total !== undefined ? { total } : {}),
    ...(subtotal !== undefined ? { subtotal } : {}),
    ...(tax !== undefined ? { tax } : {}),
    ...(tip !== undefined ? { tip } : {}),
    items,
    ...(paymentMethod ? { paymentMethod } : {}),
    ...(receiptNumber ? { receiptNumber } : {}),
    confidence: 0,
  };
  return {
    ...data,
    confidence: scoreConfidence(data, { totalIsFallback: false, currencyPrinted: !!r.currency }),
  };
}

/**
 * Fill gaps in an AI result with what the on-device OCR found (merchant, ids, items), keeping the AI's
 * values wherever it had an opinion. Confidence is recomputed.
 * @param ai - Result from the model.
 * @param ocr - Result from on-device OCR.
 */
export function mergeAiWithOcr(ai: ReceiptData, ocr: ReceiptData): ReceiptData {
  const merged: ReceiptData = {
    ...ai,
    ...(ai.merchant === undefined && ocr.merchant ? { merchant: ocr.merchant } : {}),
    ...(ai.vatId === undefined && ocr.vatId ? { vatId: ocr.vatId } : {}),
    ...(ai.receiptNumber === undefined && ocr.receiptNumber
      ? { receiptNumber: ocr.receiptNumber }
      : {}),
    ...(ai.time === undefined && ocr.time ? { time: ocr.time } : {}),
    ...(ai.total === undefined && ocr.total !== undefined ? { total: ocr.total } : {}),
    ...(ai.paymentMethod === undefined && ocr.paymentMethod
      ? { paymentMethod: ocr.paymentMethod }
      : {}),
    items: ai.items.length > 0 ? ai.items : ocr.items,
  };
  return {
    ...merged,
    confidence: scoreConfidence(merged, { totalIsFallback: false, currencyPrinted: true }),
  };
}

// ── providers ─────────────────────────────────────────────────────────────────────────────────

interface HttpPlan {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  /** Pull the model's text out of the provider's JSON envelope. */
  readText: (json: unknown) => string;
}

type Json = Record<string, unknown>;
const asObj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});

function geminiPlan(o: AiReadOptions, model: string, baseUrl: string, apiKey: string): HttpPlan {
  return {
    url: `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`,
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: {
      contents: [
        {
          role: 'user',
          parts: [
            { text: buildPrompt(o) },
            { inline_data: { mime_type: o.image.mimeType, data: o.image.base64 } },
          ],
        },
      ],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    },
    readText: (json) => {
      const root = asObj(json);
      const block = asObj(asObj(root.promptFeedback)).blockReason;
      if (typeof block === 'string')
        throw new AiError('BAD_RESPONSE', `Google declined to read this image (${block}).`);
      const candidate = asObj((root.candidates as unknown[] | undefined)?.[0]);
      const parts = asObj(candidate.content).parts as unknown[] | undefined;
      const text = (parts ?? [])
        .map((p) => asObj(p).text)
        .filter((t): t is string => typeof t === 'string')
        .join('');
      if (!text) throw new AiError('BAD_RESPONSE', 'The AI returned an empty answer.');
      return text;
    },
  };
}

function openAiPlan(o: AiReadOptions, model: string, baseUrl: string, apiKey: string): HttpPlan {
  return {
    url: `${baseUrl}/chat/completions`,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: {
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: buildPrompt(o) },
            {
              type: 'image_url',
              image_url: { url: `data:${o.image.mimeType};base64,${o.image.base64}` },
            },
          ],
        },
      ],
    },
    readText: (json) => {
      const choice = asObj((asObj(json).choices as unknown[] | undefined)?.[0]);
      const content = asObj(choice.message).content;
      if (typeof content !== 'string' || !content)
        throw new AiError('BAD_RESPONSE', 'The AI returned an empty answer.');
      return content;
    },
  };
}

function errorMessage(body: string): string {
  try {
    const e = asObj(asObj(JSON.parse(body)).error);
    return typeof e.message === 'string' ? e.message : '';
  } catch {
    return '';
  }
}

/**
 * Ask the configured AI model to read a bill.
 *
 * @param o - Settings, key, photo and context. See {@link AiReadOptions}.
 * @returns The receipt JSON with `source: 'ai'`.
 * @throws {AiError} with a code the UI maps to a message: `NOT_CONFIGURED`, `NO_KEY`, `RATE_LIMITED`
 *   (free quota used — suggest trying later or filling in by hand), `UNAUTHORIZED`, `MODEL_NOT_FOUND`
 *   (models are retired regularly — suggest changing it in settings), `NETWORK`, `BAD_RESPONSE`, `HTTP`.
 * @example
 * const data = await readReceiptWithAi({ settings, apiKey, image, today, ocrText });
 */
export async function readReceiptWithAi(o: AiReadOptions): Promise<ReceiptData> {
  const { provider } = o.settings;
  if (provider === 'none') throw new AiError('NOT_CONFIGURED', 'AI is switched off in settings.');
  const meta = AI_PROVIDERS.find((p) => p.id === provider);
  if (!meta) throw new AiError('NOT_CONFIGURED', 'Unknown AI provider.');
  const apiKey = o.apiKey?.trim();
  if (!apiKey) throw new AiError('NO_KEY', 'Add your API key in settings first.');

  const model = o.settings.model.trim() || meta.defaultModel;
  const baseUrl = (o.settings.baseUrl.trim() || meta.baseUrl).replace(/\/+$/, '');
  const plan = (provider === 'gemini' ? geminiPlan : openAiPlan)(o, model, baseUrl, apiKey);

  const doFetch = o.fetch ?? globalThis.fetch;
  let res: Response;
  try {
    res = await doFetch(plan.url, {
      method: 'POST',
      headers: plan.headers,
      body: JSON.stringify(plan.body),
      ...(o.signal ? { signal: o.signal } : {}),
    });
  } catch {
    throw new AiError('NETWORK', 'Could not reach the AI service. Check your connection.');
  }

  const bodyText = await res.text();
  if (!res.ok) {
    const detail = errorMessage(bodyText);
    if (res.status === 429) {
      const retry = Number(res.headers?.get?.('retry-after'));
      throw new AiError(
        'RATE_LIMITED',
        'The free AI quota is used up for now. Try again later, or fill in the bill yourself.',
        429,
        Number.isFinite(retry) && retry > 0 ? retry : undefined,
      );
    }
    if (res.status === 401 || res.status === 403 || /api key not valid/i.test(detail))
      throw new AiError('UNAUTHORIZED', 'The AI service rejected your API key.', res.status);
    if (res.status === 404)
      throw new AiError(
        'MODEL_NOT_FOUND',
        `The model "${model}" was not found. Models are retired from time to time — pick another one in AI settings.`,
        404,
      );
    throw new AiError(
      'HTTP',
      `The AI service returned an error (${res.status}). ${detail}`.trim(),
      res.status,
    );
  }

  let envelope: unknown;
  try {
    envelope = JSON.parse(bodyText);
  } catch {
    throw new AiError('BAD_RESPONSE', 'The AI service sent an unreadable answer.');
  }
  return receiptFromAiJson(extractJson(plan.readText(envelope)), o.tripCurrency ?? 'EUR');
}
