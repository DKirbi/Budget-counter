#!/usr/bin/env node
/**
 * Token build: DTCG JSON (src/**) -> Style Dictionary -> generated/*.
 *
 *   node scripts/build.mjs           write generated/
 *   node scripts/build.mjs --check   build into a temp dir and fail if generated/ is stale (CI drift guard)
 */
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import StyleDictionary from 'style-dictionary';
import { registerFormats } from './lib/formats.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');

registerFormats(StyleDictionary);

/** Output files: destination -> registered format name. */
export const OUTPUTS = {
  'tokens.css': 'tbc/css-web',
  'tokens.native.css': 'tbc/css-native',
  'tokens.tw4.css': 'tbc/css-tailwind4',
  'tokens.scss': 'tbc/scss',
  'tailwind.preset.cjs': 'tbc/tailwind-preset',
  'theme.ts': 'tbc/ts-theme',
  'tokens.json': 'tbc/json-flat',
};

const buildPath = check
  ? await mkdtemp(path.join(tmpdir(), 'tbc-tokens-'))
  : path.join(root, 'generated');

const sd = new StyleDictionary({
  usesDtcg: true,
  source: [path.join(root, 'src/**/*.json')],
  log: { verbosity: 'default', warnings: 'error' },
  platforms: {
    all: {
      transforms: ['name/kebab'], // unique names only — values stay raw (formats do the conversion)
      buildPath: `${buildPath}/`,
      files: Object.entries(OUTPUTS).map(([destination, format]) => ({ destination, format })),
    },
  },
});

await sd.buildAllPlatforms();

if (check) {
  const stale = [];
  for (const file of await readdir(buildPath)) {
    const fresh = await readFile(path.join(buildPath, file), 'utf8');
    const committed = await readFile(path.join(root, 'generated', file), 'utf8').catch(() => null);
    if (fresh !== committed) stale.push(file);
  }
  await rm(buildPath, { recursive: true, force: true });
  if (stale.length) {
    console.error(
      `\n✖ Generated tokens are stale: ${stale.join(', ')}\n  Run \`pnpm tokens\` and commit packages/tokens/generated.`,
    );
    process.exit(1);
  }
  console.log('✔ Generated tokens are up to date.');
}
