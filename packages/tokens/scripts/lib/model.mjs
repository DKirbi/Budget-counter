/**
 * Turns Style Dictionary's flat token list into a small, format-friendly model.
 * Every generated file is rendered from this one object, so platforms can never drift apart.
 * @module model
 */
import { hexToHslChannels } from './color.mjs';

/** Look up a nested group of tokens by path prefix and return `{ key: value }`. */
function group(tokens, prefix) {
  const out = {};
  for (const t of tokens) {
    if (prefix.every((p, i) => t.path[i] === p)) {
      out[t.path.slice(prefix.length).join('.')] = t.$value;
    }
  }
  return out;
}

/**
 * Build the neutral token model.
 * @param {Array<{path:string[], $value:any, $type?:string, $description?:string}>} tokens - Resolved tokens.
 * @returns {object} Model with `palette`, `themes`, `spacing`, `radius`, `fontSize`, ... fields.
 */
export function buildModel(tokens) {
  const palette = {};
  for (const t of tokens.filter((x) => x.path[0] === 'color')) {
    const [, family, step] = t.path;
    if (step === undefined) palette[family] = t.$value;
    else (palette[family] ??= {})[step] = t.$value;
  }

  const themes = { light: {}, dark: {} };
  const descriptions = {};
  for (const t of tokens.filter((x) => x.path[0] === 'semantic')) {
    const [, mode, ...rest] = t.path;
    const name = rest.join('.');
    themes[mode][name] = { hex: t.$value, channels: hexToHslChannels(t.$value) };
    if (t.$description) descriptions[name] = t.$description;
  }

  const fontSizeRaw = group(tokens, ['fontSize']);
  const lineHeightRaw = group(tokens, ['lineHeight']);
  const fontSize = Object.fromEntries(
    Object.entries(fontSizeRaw).map(([k, v]) => [k, { size: v, lineHeight: lineHeightRaw[k] }]),
  );

  return {
    palette,
    themes,
    descriptions,
    spacing: group(tokens, ['spacing']),
    radius: group(tokens, ['radius']),
    fontFamily: group(tokens, ['fontFamily']),
    fontSize,
    fontWeight: group(tokens, ['fontWeight']),
    shadow: group(tokens, ['shadow']),
    duration: group(tokens, ['duration']),
    easing: group(tokens, ['easing']),
    size: group(tokens, ['size']),
  };
}

/** `"12px"` -> `12`. Used where native APIs want unitless numbers. */
export const px = (v) => Number.parseFloat(String(v));
/** `"120ms"` -> `120`. */
export const ms = (v) => Number.parseFloat(String(v));
/** Header stamped on every generated file. */
export const HEADER =
  'GENERATED FILE — DO NOT EDIT.\nSource: packages/tokens/src/**  ·  Run `pnpm tokens` to regenerate.';
