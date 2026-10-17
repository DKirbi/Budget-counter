#!/usr/bin/env node
/**
 * Static guard for the Maestro flows (we cannot run an emulator on every PR, but we can catch the #1 cause of flaky
 * E2E: a flow that taps a `testID` nobody renders any more).
 *
 *  1. Collect every `testID` the app can render: string literals and template literals in packages/* and apps/mobile.
 *  2. Parse every flow in apps/mobile/.maestro and pull out each `id:` selector.
 *  3. Fail if a selector matches no known testID. Selectors may be regexes (`day-card-.*`) or use Maestro env vars.
 *
 * Limits: template holes (`tab-${id}`) match any text, so a typo inside such a suffix is not caught; unknown *prefixes* are.
 *
 * Usage: node scripts/check-maestro-ids.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseAllDocuments } from 'yaml';

const root = new URL('..', import.meta.url).pathname;
const SRC_DIRS = [
  'packages/ui-native/src',
  'packages/screens-native/src',
  'apps/mobile/src',
  'apps/mobile/app',
];
const FLOW_DIR = join(root, 'apps/mobile/.maestro');

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

/** Every testID the source can produce, as regexes (template holes become `.+`). */
function collectTestIds() {
  const patterns = new Set();
  const add = (raw) => {
    // A bare pass-through (`testID={testID}` → `${testID}`) would match everything; require some literal text.
    if (raw.replace(/\$\{[^}]*\}/g, '').replace(/[-_]/g, '').length < 3) return;
    const escape = (t) => t.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
    patterns.add(
      `^${raw
        .split(/\$\{[^}]*\}/)
        .map(escape)
        .join('.+')}$`,
    );
  };
  for (const dir of SRC_DIRS) {
    for (const file of walk(join(root, dir))) {
      if (!/\.(tsx?|jsx?)$/.test(file) || /\.(test|stories)\./.test(file)) continue;
      const text = readFileSync(file, 'utf8');
      // testID="x", testID='x', testID={'x'}, testID={`x-${y}`}, testID: 'x' / testIDPrefix
      for (const m of text.matchAll(/testID\s*[=:]\s*(?:\{\s*)?(["'`])((?:\\.|(?!\1).)*)\1/g))
        add(m[2]);
      // A `testIDPrefix` (default `'tag'`, or `part-${i}-tag` from a caller) yields `<prefix>-<item id>`.
      for (const m of text.matchAll(/testIDPrefix\s*[=:]\s*(?:\{\s*)?(["'`])((?:\\.|(?!\1).)*)\1/g))
        add(`${m[2]}-\${item}`);
      // `${testID}-amount` style derived ids
      for (const m of text.matchAll(/`(\$\{testID\}[^`]*)`/g)) add(m[1]);
      // ids passed through props/consts: { id: 'tab-today' } etc.
      for (const m of text.matchAll(/testID:\s*(["'`])((?:\\.|(?!\1).)*)\1/g)) add(m[2]);
      // Tag/route tables build ids from a prefix: `${testIDPrefix}-${t.id}`
      for (const m of text.matchAll(/`(\$\{testIDPrefix\}[^`]*)`/g)) add(m[1]);
    }
  }
  return [...patterns].map((p) => new RegExp(p));
}

/** Flow selector → a concrete sample id we can test against the source patterns. */
function sample(selector) {
  return String(selector)
    .replace(/\$\{[^}]*\}/g, 'X')
    .replace(/\.\*/g, 'X');
}

const known = collectTestIds();
const failures = [];
let checked = 0;

for (const file of walk(FLOW_DIR)) {
  if (!file.endsWith('.yaml')) continue;
  const docs = parseAllDocuments(readFileSync(file, 'utf8'));
  for (const doc of docs) {
    if (doc.errors.length)
      failures.push(`${relative(root, file)}: YAML error — ${doc.errors[0].message}`);
  }
  const ids = [];
  const visit = (node) => {
    if (Array.isArray(node)) node.forEach(visit);
    else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (k === 'id' && typeof v === 'string') ids.push(v);
        else visit(v);
      }
    }
  };
  docs.forEach((d) => visit(d.toJS()));
  for (const id of ids) {
    checked += 1;
    const s = sample(id);
    if (!known.some((re) => re.test(s)))
      failures.push(`${relative(root, file)}: no testID matches "${id}"`);
  }
}

if (failures.length) {
  console.error(
    `✗ Maestro flows reference unknown testIDs (${failures.length}):\n  - ${failures.join('\n  - ')}`,
  );
  process.exit(1);
}
console.log(
  `✓ ${checked} Maestro selectors resolve to testIDs in the source (${known.length} known id patterns)`,
);
