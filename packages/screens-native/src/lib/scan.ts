/**
 * Scanning one photo end to end: store the photo, read it, run the odd-bill checks, file or park it.
 * Kept out of the screen so the batch loop is a few readable lines and this part is testable alone.
 * @module lib/scan
 */
import {
  type BudgetStore,
  type ISODate,
  type Minor,
  type Receipt,
  type ScanServices,
  commitScan,
  getTagMeta,
  formatDayLabel,
  ocrFromText,
  openIssues,
  processScan,
} from '@tbc/core';

/** What happened to one photo. */
export interface ScanPhotoResult {
  receipt: Receipt;
  /** Counted straight away. */
  filed: boolean;
  /** Added to the budget, minor units (0 while in the inbox). */
  amount: Minor;
  /** Shop name, or `undefined` when none was found. */
  title?: string;
  /** One line for the batch list: where it was filed, or what needs the user. */
  detail: string;
  /** The text recognition itself failed (the photo is still saved). */
  readError: boolean;
}

/** Dependencies of {@link scanPhoto}. */
export interface ScanPhotoDeps {
  services: ScanServices;
  store: BudgetStore;
  today: ISODate;
  /** `false` when this build has no OCR engine; the photo is saved for AI or hand entry. */
  ocrSupported: boolean;
}

/**
 * Scan one photo.
 *
 * Never throws for a bad *reading*: a failed or empty recognition still saves the photo to the inbox so
 * the user can finish it with AI or by hand. It does throw when the photo itself cannot be stored.
 * @param uri - Camera or library URI of the photo.
 * @param deps - Services, store and clock.
 * @example
 * const r = await scanPhoto(uri, { services, store, today, ocrSupported: true });
 * if (r.filed) toast(`Filed ${r.detail}`);
 */
export async function scanPhoto(uri: string, deps: ScanPhotoDeps): Promise<ScanPhotoResult> {
  const { services, store, today, ocrSupported } = deps;
  const stored = await services.images.persist(uri);

  let ocr = ocrFromText('');
  let readError = false;
  if (ocrSupported) {
    try {
      ocr = await services.ocr.recognize(stored);
    } catch {
      readError = true;
    }
  }

  // Read the state *now*: bills filed earlier in this batch must count for duplicate detection.
  const state = store.getState();
  const trip = state.trips.find((t) => t.id === state.activeTripId) ?? null;
  const outcome = processScan(ocr, {
    today,
    trip,
    trips: state.trips,
    receipts: state.receipts,
    merchantRules: state.merchantRules,
    autoConfirm: state.settings.autoConfirmReceipts,
  });
  const result = commitScan(state.actions, outcome, { rawText: ocr.text, imageUri: stored });

  const title = outcome.data.merchant;
  let detail: string;
  if (result.filed) {
    detail = `${formatDayLabel(result.receipt.date ?? today)} · ${getTagMeta(result.receipt.tag).label}`;
  } else if (readError || (!ocrSupported && ocr.text === '')) {
    detail = readError ? 'Could not read the text on the photo' : 'Saved — fill it in or use AI';
  } else {
    detail = openIssues(outcome.plan)[0]?.title ?? 'Needs a quick check';
  }
  return {
    receipt: result.receipt,
    filed: result.filed,
    amount: result.amount,
    ...(title ? { title } : {}),
    detail,
    readError,
  };
}
