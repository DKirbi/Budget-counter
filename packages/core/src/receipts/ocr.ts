/**
 * Turning raw OCR output into *rows*.
 *
 * On-device OCR returns text lines with bounding boxes, and on a receipt the item name and its price
 * are usually two separate boxes on the same visual row. Parsing line by line would lose that pairing,
 * so we first cluster boxes whose vertical extents overlap and join them left-to-right with a tab.
 * @module receipts/ocr
 */
import type { OcrLine, OcrResult } from './types';

/** Build an {@link OcrResult} from plain text (fixtures, tests, pasted text, the "type it in" path). */
export function ocrFromText(text: string): OcrResult {
  const lines = text.split(/\r?\n/).map((t) => ({ text: t }));
  return { text, lines };
}

const squash = (s: string) =>
  s.replace(/[ \u00a0]{1,}/g, (m) => (m.length > 2 ? '\t' : ' ')).trim();

/**
 * Group OCR lines into visual rows, top to bottom.
 *
 * - Lines with boxes are clustered when they overlap vertically by at least half of the shorter one.
 * - Within a row, boxes are ordered left to right and joined with `\t` (a column gap).
 * - Lines without boxes keep their order and become one row each; runs of 3+ spaces become `\t` so
 *   `Cola      2,50` and `Cola<TAB>2,50` parse identically.
 * - Empty rows are dropped.
 * @param ocr - Recognition result.
 */
export function rowsFromOcr(ocr: OcrResult): string[] {
  const lines: OcrLine[] =
    ocr.lines.length > 0 ? ocr.lines : ocr.text.split(/\r?\n/).map((text) => ({ text }));

  const boxed = lines.filter((l) => l.box && l.text.trim() !== '');
  const unboxed = lines.filter((l) => !l.box);

  // Plain-text path: keep the given order.
  if (boxed.length === 0) {
    return unboxed.map((l) => squash(l.text)).filter((r) => r !== '');
  }

  const sorted = [...boxed].sort((a, b) => centerY(a) - centerY(b));
  const rows: Array<{ top: number; bottom: number; parts: OcrLine[] }> = [];
  for (const line of sorted) {
    const { y, height } = line.box!;
    const last = rows[rows.length - 1];
    if (last) {
      const overlap = Math.min(last.bottom, y + height) - Math.max(last.top, y);
      const shorter = Math.min(last.bottom - last.top, height);
      if (shorter > 0 && overlap / shorter >= 0.5) {
        last.parts.push(line);
        last.top = Math.min(last.top, y);
        last.bottom = Math.max(last.bottom, y + height);
        continue;
      }
    }
    rows.push({ top: y, bottom: y + height, parts: [line] });
  }

  return rows
    .map((r) =>
      r.parts
        .sort((a, b) => a.box!.x - b.box!.x)
        .map((p) => p.text.trim())
        .filter(Boolean)
        .join('\t'),
    )
    .filter((r) => r !== '');
}

function centerY(l: OcrLine): number {
  return l.box!.y + l.box!.height / 2;
}
