/**
 * Colour helpers used by the token build and its tests.
 * Kept dependency-free on purpose: the maths is tiny and fully covered by tests.
 * @module color
 */

/**
 * Parse `#rgb`, `#rrggbb` into 0-255 channels.
 * @param {string} hex - Hex colour string.
 * @returns {{r:number,g:number,b:number}} RGB channels.
 */
export function hexToRgb(hex) {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h))
    throw new Error(`Unsupported colour "${hex}" (expected #rgb or #rrggbb)`);
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Convert a hex colour to the space-separated HSL channels shadcn uses in CSS variables,
 * e.g. `#0f766e` -> `175 77% 26%`. The triplet form lets Tailwind add alpha: `hsl(var(--x) / 0.5)`.
 * @param {string} hex - Hex colour string.
 * @returns {string} `H S% L%` triplet with integer-rounded values.
 */
export function hexToHslChannels(hex) {
  const { r, g, b } = hexToRgb(hex);
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * WCAG 2.x relative luminance of a hex colour.
 * @param {string} hex - Hex colour string.
 * @returns {number} Luminance in the range 0..1.
 */
export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lin = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/**
 * WCAG 2.x contrast ratio between two hex colours.
 * @param {string} a - First colour.
 * @param {string} b - Second colour.
 * @returns {number} Ratio from 1 (identical) to 21 (black on white).
 */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
