/**
 * Design-token quality gates. These run in CI on every token change, so a designer
 * or engineer cannot merge a palette edit that breaks accessibility or drops a platform.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';
import { contrast } from '../scripts/lib/color.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const tokens = JSON.parse(readFileSync(path.join(root, 'generated/tokens.json'), 'utf8'));
const hex = (mode, name) => tokens.themes[mode][name].hex;

test('light and dark define exactly the same semantic tokens', () => {
  assert.deepEqual(Object.keys(tokens.themes.light).sort(), Object.keys(tokens.themes.dark).sort());
});

/** [foreground, background, minimum ratio, why] */
const PAIRS = [
  ['foreground', 'background', 4.5],
  ['card-foreground', 'card', 4.5],
  ['popover-foreground', 'popover', 4.5],
  ['primary-foreground', 'primary', 4.5],
  ['secondary-foreground', 'secondary', 4.5],
  ['accent-foreground', 'accent', 4.5],
  ['destructive-foreground', 'destructive', 4.5],
  ['success-foreground', 'success', 4.5],
  ['warning-foreground', 'warning', 4.5],
  ['info-foreground', 'info', 4.5],
  ['muted-foreground', 'background', 4.5],
  ['muted-foreground', 'muted', 4.5],
  // Semantic colours used directly as text/icons on the app canvas.
  ['primary', 'background', 4.5],
  ['destructive', 'background', 4.5],
  ['success', 'background', 4.5],
  ['info', 'background', 4.5],
  // Non-text graphics need 3:1 (WCAG 1.4.11).
  ['warning', 'background', 3],
  ['tag-food', 'card', 3],
  ['tag-groceries', 'card', 3],
  ['tag-transport', 'card', 3],
  ['tag-stay', 'card', 3],
  ['tag-activities', 'card', 3],
  ['tag-shopping', 'card', 3],
  ['tag-other', 'card', 3],
];

for (const mode of ['light', 'dark']) {
  for (const [fg, bg, min] of PAIRS) {
    test(`contrast ${mode}: ${fg} on ${bg} >= ${min}:1`, () => {
      const ratio = contrast(hex(mode, fg), hex(mode, bg));
      assert.ok(
        ratio >= min,
        `${fg} (${hex(mode, fg)}) on ${bg} (${hex(mode, bg)}) is ${ratio.toFixed(2)}:1, needs ${min}:1`,
      );
    });
  }
}

test('tailwind preset exposes every semantic colour and the 4px spacing grid', () => {
  const preset = require(path.join(root, 'generated/tailwind.preset.cjs'));
  for (const name of Object.keys(tokens.themes.light)) {
    assert.equal(preset.theme.colors[name], `hsl(var(--${name}) / <alpha-value>)`);
  }
  assert.equal(preset.theme.spacing['4'], '16px');
  assert.equal(preset.theme.borderRadius.lg, '12px');
  assert.equal(preset.darkMode, 'class');
  assert.equal(preset.theme.colors.red, undefined, 'raw palette must not leak into utilities');
});

test('web css and native css declare the same colour variables', () => {
  const vars = (file) =>
    new Set(
      [
        ...readFileSync(path.join(root, 'generated', file), 'utf8').matchAll(
          /--([a-z-]+): \d+ \d+% \d+%;/g,
        ),
      ].map((m) => m[1]),
    );
  const web = vars('tokens.css');
  const native = vars('tokens.native.css');
  assert.deepEqual([...native].sort(), [...web].sort());
  assert.match(readFileSync(path.join(root, 'generated/tokens.native.css'), 'utf8'), /\.dark:root/);
});

test('generated SCSS compiles and helper functions work', () => {
  const result = sass.compileString(
    `@use 'tokens' as t;
     @include t.root;
     .a { color: t.semantic(primary); background: t.semantic(card, 0.5); padding: t.space(4); border-radius: t.radius(lg); }
     .b { border-color: map-get(t.$semantic-dark, "border"); }`,
    { loadPaths: [path.join(root, 'generated')], importers: [] },
  );
  // Derived from the compiled tokens, not a literal: the test must survive a brand-colour change.
  assert.ok(result.css.includes(`--primary: ${tokens.themes.light.primary.hslChannels};`));
  assert.match(result.css, /\.dark \{/);
  assert.match(result.css, /color: hsl\(var\(--primary\)\)/);
  assert.match(result.css, /padding: 16px/);
  assert.match(result.css, /border-radius: 12px/);
});

test('theme.ts exports typed tokens for both modes', () => {
  const src = readFileSync(path.join(root, 'generated/theme.ts'), 'utf8');
  assert.match(src, /export const themes = /);
  assert.match(src, /export type SemanticColor/);
});

test('committed generated files are in sync with the sources (drift guard)', () => {
  execFileSync(process.execPath, [path.join(root, 'scripts/build.mjs'), '--check'], {
    stdio: 'pipe',
  });
});
