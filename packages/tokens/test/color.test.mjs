import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contrast, hexToHslChannels, hexToRgb } from '../scripts/lib/color.mjs';

test('hexToRgb expands shorthand and parses full hex', () => {
  assert.deepEqual(hexToRgb('#fff'), { r: 255, g: 255, b: 255 });
  assert.deepEqual(hexToRgb('#0f766e'), { r: 15, g: 118, b: 110 });
});

test('hexToRgb rejects garbage instead of emitting broken CSS', () => {
  assert.throws(() => hexToRgb('teal'), /Unsupported colour/);
});

test('hexToHslChannels matches known shadcn-style triplets', () => {
  assert.equal(hexToHslChannels('#ffffff'), '0 0% 100%');
  assert.equal(hexToHslChannels('#000000'), '0 0% 0%');
  assert.equal(hexToHslChannels('#0f766e'), '175 77% 26%');
});

test('contrast: black on white is 21:1 and is symmetric', () => {
  assert.equal(Math.round(contrast('#000000', '#ffffff')), 21);
  assert.equal(contrast('#123456', '#fedcba'), contrast('#fedcba', '#123456'));
});
