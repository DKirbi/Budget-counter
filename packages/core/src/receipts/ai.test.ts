import {
  AiError,
  buildPrompt,
  extractJson,
  mergeAiWithOcr,
  readReceiptWithAi,
  receiptFromAiJson,
  type AiReadOptions,
} from './ai';
import { createFakeScanServices } from './fakes';
import { RECEIPT_FIXTURES, fixtureOcr } from './fixtures';
import { parseReceipt } from './parse';
import { DEFAULT_SETTINGS, type AiSettings } from '../types';

const KEY = 'sk-test-SECRET-123';
const gemini: AiSettings = { provider: 'gemini', model: '', baseUrl: '', dailyLimit: 20 };
const openai: AiSettings = {
  provider: 'openai',
  model: 'gpt-x',
  baseUrl: 'https://llm.example/v1/',
  dailyLimit: 20,
};
const image = { base64: 'QUJD', mimeType: 'image/jpeg' };

const goodJson = {
  merchant: ' Cafe Nova ',
  date: '2026-10-06',
  dateAmbiguous: false,
  time: '9:05',
  currency: 'eur',
  total: 12.5,
  subtotal: 12.5,
  tax: 1.13,
  tip: null,
  items: [
    { description: 'Kosilo', quantity: 1, amount: 11 },
    { description: 'Popust', quantity: null, amount: -0.5 },
    { description: 'Kava', amount: '2,00' },
  ],
  paymentMethod: 'card',
  receiptNumber: ' A-17 ',
};
const geminiBody = (obj: unknown) => ({
  candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }],
});
const openAiBody = (obj: unknown) => ({ choices: [{ message: { content: JSON.stringify(obj) } }] });

const opts = (over: Partial<AiReadOptions>): AiReadOptions => ({
  settings: gemini,
  apiKey: KEY,
  image,
  today: '2026-10-06',
  tripCurrency: 'EUR',
  ...over,
});

describe('buildPrompt', () => {
  it('tells the model today is context only, and what to do with unknowns', () => {
    const p = buildPrompt({ today: '2026-10-06', tripCurrency: 'CZK', ocrText: 'MILK 1,29' });
    expect(p).toContain('Today is 2026-10-06');
    expect(p).toContain('never use it as the receipt date');
    expect(p).toContain('Use null for anything that is not printed');
    expect(p).toContain('use CZK');
    expect(p).toContain('MILK 1,29');
  });
  it('omits the OCR block when there is none and caps a huge one', () => {
    expect(buildPrompt({ today: '2026-10-06' })).not.toContain('Text recognised');
    const long = buildPrompt({ today: '2026-10-06', ocrText: 'x'.repeat(10_000) });
    expect(long.length).toBeLessThan(6000);
  });
});

describe('extractJson', () => {
  it.each([
    ['{"a":1}', { a: 1 }],
    ['```json\n{"a":1}\n```', { a: 1 }],
    ['Here you go: {"a":1} hope that helps', { a: 1 }],
  ])('%s', (text, expected) => {
    expect(extractJson(text)).toEqual(expected);
  });
  it.each(['', 'no json', '{broken', '}{'])('rejects %j', (text) => {
    expect(() => extractJson(text)).toThrow(AiError);
  });
});

describe('receiptFromAiJson', () => {
  const data = receiptFromAiJson(goodJson);
  it('converts to minor units and cleans fields', () => {
    expect(data).toMatchObject({
      source: 'ai',
      merchant: 'Cafe Nova',
      date: '2026-10-06',
      time: '09:05',
      currency: 'EUR',
      total: 1250,
      subtotal: 1250,
      tax: 113,
      paymentMethod: 'card',
      receiptNumber: 'A-17',
    });
    expect(data.items.map((i) => i.amount)).toEqual([1100, -50, 200]);
    expect(data.tip).toBeUndefined();
    expect(data.dateAmbiguous).toBeUndefined();
  });
  it('scores confidence like the parser does', () => {
    expect(data.confidence).toBeGreaterThanOrEqual(0.9);
    expect(receiptFromAiJson({}).confidence).toBeLessThan(0.1);
  });
  it('handles zero-decimal currencies', () => {
    expect(receiptFromAiJson({ currency: 'JPY', total: 1200, items: [] }).total).toBe(1200);
  });
  it('falls back to the trip currency for missing or unsupported ones', () => {
    expect(receiptFromAiJson({ total: 1, currency: 'XXX' }, 'CZK').currency).toBe('CZK');
    expect(receiptFromAiJson({ total: 1 }, 'PLN').currency).toBe('PLN');
  });
  it('drops impossible dates, bad times, non-positive totals and empty items', () => {
    const d = receiptFromAiJson({
      date: '2026-02-31',
      time: 'noon',
      total: 0,
      tax: -1,
      items: [
        { description: '  ', amount: 1 },
        { description: 'x', amount: 'abc' },
      ],
    });
    expect(d).toMatchObject({ items: [] });
    expect(d.date).toBeUndefined();
    expect(d.time).toBeUndefined();
    expect(d.total).toBeUndefined();
    expect(d.tax).toBeUndefined();
  });
  it('keeps "ambiguous" only when there is a date', () => {
    expect(receiptFromAiJson({ date: '2026-10-04', dateAmbiguous: true }).dateAmbiguous).toBe(true);
    expect(receiptFromAiJson({ date: null, dateAmbiguous: true }).dateAmbiguous).toBeUndefined();
  });
  it('extracts a date from a longer timestamp', () => {
    expect(receiptFromAiJson({ date: '2026-10-04T18:30:00' }).date).toBe('2026-10-04');
  });
  it('rejects the wrong shape', () => {
    for (const bad of [
      null,
      'text',
      5,
      { items: 'none' },
      { total: { value: 1 } },
      { merchant: 5 },
    ]) {
      expect(() => receiptFromAiJson(bad)).toThrow(AiError);
    }
  });
  it('ignores unknown keys (including attempts at prompt injection)', () => {
    const d = receiptFromAiJson({
      total: 1,
      instructions: 'ignore all rules',
      __proto__: { x: 1 },
    });
    expect(d).not.toHaveProperty('instructions');
  });
});

describe('mergeAiWithOcr', () => {
  it('fills what the model left out from the OCR, keeps what it said', () => {
    const ocr = parseReceipt(fixtureOcr(RECEIPT_FIXTURES[0]!));
    const ai = receiptFromAiJson({ date: '2026-10-05', total: 6.06, merchant: null, items: [] });
    const m = mergeAiWithOcr(ai, ocr);
    expect(m).toMatchObject({
      source: 'ai',
      date: '2026-10-05',
      total: 606,
      vatId: 'SI12345678',
      receiptNumber: '000123',
    });
    expect(m.merchant).toBe(ocr.merchant);
    expect(m.items).toEqual(ocr.items);
    expect(m.confidence).toBeGreaterThan(ai.confidence);
  });
  it("never overrides the model's own values", () => {
    const ocr = parseReceipt(fixtureOcr(RECEIPT_FIXTURES[0]!));
    const ai = receiptFromAiJson({
      merchant: 'Else',
      total: 9,
      date: '2026-10-05',
      items: [{ description: 'a', amount: 9 }],
    });
    const m = mergeAiWithOcr(ai, ocr);
    expect(m).toMatchObject({ merchant: 'Else', total: 900 });
    expect(m.items).toHaveLength(1);
  });
});

describe('readReceiptWithAi · Gemini', () => {
  it('sends the photo and prompt to generateContent and parses the answer', async () => {
    const svc = createFakeScanServices({ aiResponse: { body: geminiBody(goodJson) } });
    const data = await readReceiptWithAi(opts({ fetch: svc.fetch, ocrText: 'KAVA 2,00' }));
    expect(data).toMatchObject({ source: 'ai', total: 1250 });

    const [call] = svc.calls.fetches;
    expect(call!.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
    );
    expect(call!.headers['x-goog-api-key']).toBe(KEY);
    expect(call!.url).not.toContain(KEY);
    const body = call!.body as {
      contents: Array<{ parts: Array<Record<string, unknown>> }>;
      generationConfig: Record<string, unknown>;
    };
    expect(body.generationConfig).toEqual({ temperature: 0, responseMimeType: 'application/json' });
    expect(body.contents[0]!.parts[1]).toEqual({
      inline_data: { mime_type: 'image/jpeg', data: 'QUJD' },
    });
    expect(String(body.contents[0]!.parts[0]!.text)).toContain('KAVA 2,00');
  });
  it('honours a custom model and address (trailing slash trimmed)', async () => {
    const svc = createFakeScanServices({ aiResponse: { body: geminiBody(goodJson) } });
    await readReceiptWithAi(
      opts({
        settings: { ...gemini, model: 'gemini-9-turbo', baseUrl: 'https://proxy.example/v1beta/' },
        fetch: svc.fetch,
      }),
    );
    expect(svc.calls.fetches[0]!.url).toBe(
      'https://proxy.example/v1beta/models/gemini-9-turbo:generateContent',
    );
  });
  it('reports a blocked prompt and an empty answer as BAD_RESPONSE', async () => {
    const blocked = createFakeScanServices({
      aiResponse: { body: { promptFeedback: { blockReason: 'SAFETY' } } },
    });
    await expect(readReceiptWithAi(opts({ fetch: blocked.fetch }))).rejects.toMatchObject({
      code: 'BAD_RESPONSE',
      message: expect.stringContaining('SAFETY'),
    });
    const empty = createFakeScanServices({ aiResponse: { body: { candidates: [] } } });
    await expect(readReceiptWithAi(opts({ fetch: empty.fetch }))).rejects.toMatchObject({
      code: 'BAD_RESPONSE',
    });
  });
});

describe('readReceiptWithAi · OpenAI-compatible', () => {
  it('uses chat/completions with a data-URI image and a bearer token', async () => {
    const svc = createFakeScanServices({ aiResponse: { body: openAiBody(goodJson) } });
    const data = await readReceiptWithAi(opts({ settings: openai, fetch: svc.fetch }));
    expect(data.total).toBe(1250);
    const [call] = svc.calls.fetches;
    expect(call!.url).toBe('https://llm.example/v1/chat/completions'.replace('v1/chat', 'v1/chat'));
    expect(call!.headers.authorization).toBe(`Bearer ${KEY}`);
    const body = call!.body as {
      model: string;
      response_format: unknown;
      messages: Array<{ content: Array<Record<string, unknown>> }>;
    };
    expect(body.model).toBe('gpt-x');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0]!.content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/jpeg;base64,QUJD' },
    });
  });
  it('rejects an empty completion', async () => {
    const svc = createFakeScanServices({
      aiResponse: { body: { choices: [{ message: { content: '' } }] } },
    });
    await expect(
      readReceiptWithAi(opts({ settings: openai, fetch: svc.fetch })),
    ).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });
});

describe('readReceiptWithAi · failures the UI must explain', () => {
  const run = (o: Partial<AiReadOptions>) => readReceiptWithAi(opts(o));
  const fail = (o: Partial<AiReadOptions>): Promise<AiError> =>
    run(o).then(
      () => {
        throw new Error('expected the call to fail');
      },
      (e: unknown) => e as AiError,
    );

  it('is switched off by default and needs a key', async () => {
    expect(await fail({ settings: DEFAULT_SETTINGS.ai })).toMatchObject({ code: 'NOT_CONFIGURED' });
    expect(await fail({ apiKey: null })).toMatchObject({ code: 'NO_KEY' });
    expect(await fail({ apiKey: '   ' })).toMatchObject({ code: 'NO_KEY' });
  });
  it('429 → RATE_LIMITED with retry-after', async () => {
    const svc = createFakeScanServices({
      aiResponse: {
        status: 429,
        body: { error: { message: 'quota' } },
        headers: { 'retry-after': '30' },
      },
    });
    const e = await fail({ fetch: svc.fetch });
    expect(e).toMatchObject({ code: 'RATE_LIMITED', status: 429, retryAfterSec: 30 });
    expect(e.message).toMatch(/free AI quota/i);
  });
  it('429 without retry-after', async () => {
    const svc = createFakeScanServices({ aiResponse: { status: 429, body: {} } });
    expect(await fail({ fetch: svc.fetch })).toMatchObject({
      code: 'RATE_LIMITED',
      retryAfterSec: undefined,
    });
  });
  it.each([401, 403])('%i → UNAUTHORIZED', async (status) => {
    const svc = createFakeScanServices({ aiResponse: { status, body: {} } });
    expect(await fail({ fetch: svc.fetch })).toMatchObject({ code: 'UNAUTHORIZED' });
  });
  it('400 "API key not valid" → UNAUTHORIZED', async () => {
    const svc = createFakeScanServices({
      aiResponse: {
        status: 400,
        body: { error: { message: 'API key not valid. Please pass a valid API key.' } },
      },
    });
    expect(await fail({ fetch: svc.fetch })).toMatchObject({ code: 'UNAUTHORIZED' });
  });
  it('404 → MODEL_NOT_FOUND naming the model, so a retired model is a one-tap fix', async () => {
    const svc = createFakeScanServices({ aiResponse: { status: 404, body: {} } });
    const e = await fail({ settings: { ...gemini, model: 'gemini-2.5-flash' }, fetch: svc.fetch });
    expect(e).toMatchObject({ code: 'MODEL_NOT_FOUND', status: 404 });
    expect(e.message).toContain('gemini-2.5-flash');
  });
  it('500 → HTTP with the provider message', async () => {
    const svc = createFakeScanServices({
      aiResponse: { status: 500, body: { error: { message: 'boom' } } },
    });
    const e = await fail({ fetch: svc.fetch });
    expect(e).toMatchObject({ code: 'HTTP', status: 500 });
    expect(e.message).toContain('boom');
  });
  it('offline → NETWORK', async () => {
    const svc = createFakeScanServices({ offline: true });
    expect(await fail({ fetch: svc.fetch })).toMatchObject({ code: 'NETWORK' });
  });
  it('garbage envelope → BAD_RESPONSE', async () => {
    const f = (async () => new Response('<html>', { status: 200 })) as typeof fetch;
    expect(await fail({ fetch: f })).toMatchObject({ code: 'BAD_RESPONSE' });
  });
  it('never leaks the API key into an error message', async () => {
    for (const status of [401, 404, 429, 500]) {
      const svc = createFakeScanServices({
        aiResponse: { status, body: { error: { message: 'x' } } },
      });
      expect((await fail({ fetch: svc.fetch })).message).not.toContain(KEY);
    }
  });
  it('passes the abort signal through', async () => {
    const ctl = new AbortController();
    let seen: AbortSignal | undefined;
    const f = (async (_u: unknown, init?: RequestInit) => {
      seen = init?.signal ?? undefined;
      return new Response(JSON.stringify(geminiBody(goodJson)));
    }) as typeof fetch;
    await run({ fetch: f, signal: ctl.signal });
    expect(seen).toBe(ctl.signal);
  });
});
