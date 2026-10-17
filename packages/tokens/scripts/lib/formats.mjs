/**
 * Style Dictionary formats. Each one renders the neutral model (see model.mjs)
 * for a single consumer: web CSS, NativeWind CSS, SCSS, Tailwind preset, TS theme, ...
 * @module formats
 */
import { HEADER, buildModel, ms, px } from './model.mjs';

const block = (text) => `/*\n * ${text.split('\n').join('\n * ')}\n */\n`;
const line = (text) => `// ${text.split('\n').join('\n// ')}\n`;
const q = (s) => JSON.stringify(s);
const varName = (key) => key.replace(/\./g, '-');

/** Turn `{ 'control.sm': 36 }` into `{ control: { sm: 36 } }`. */
function nest(flat) {
  const out = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let cursor = out;
    parts.slice(0, -1).forEach((p) => (cursor = cursor[p] ??= {}));
    cursor[parts.at(-1)] = value;
  }
  return out;
}

const colorVars = (theme, indent = '  ') =>
  Object.entries(theme)
    .map(([name, v]) => `${indent}--${name}: ${v.channels};`)
    .join('\n');

/* ------------------------------------------------------------------ CSS (web) */
/** `tokens.css` — shadcn-compatible variables for web (`:root` + `.dark`). */
export function cssWeb(model) {
  const misc = [
    ...Object.entries(model.radius).map(([k, v]) => `  --radius-${varName(k)}: ${v};`),
    ...Object.entries(model.fontFamily).map(([k, v]) => `  --font-${k}: ${v};`),
    ...Object.entries(model.shadow).map(([k, v]) => `  --shadow-${k}: ${v};`),
    ...Object.entries(model.duration).map(([k, v]) => `  --duration-${k}: ${v};`),
    ...Object.entries(model.easing).map(
      ([k, v]) => `  --easing-${k}: cubic-bezier(${v.join(', ')});`,
    ),
    `  --radius: ${model.radius.lg};`,
  ].join('\n');
  return `${block(HEADER)}
:root {
${colorVars(model.themes.light)}
${misc}
}

.dark {
${colorVars(model.themes.dark)}
}
`;
}

/* ------------------------------------------------------------ CSS (NativeWind v4) */
/** `tokens.native.css` — colour variables only, using NativeWind v4's `.dark:root` selector. */
export function cssNative(model) {
  return `${block(HEADER)}
:root {
${colorVars(model.themes.light)}
}

.dark:root {
${colorVars(model.themes.dark)}
}
`;
}

/* ------------------------------------------------------------ CSS (Tailwind v4) */
/** `tokens.tw4.css` — forward-compat file for NativeWind v5 / Uniwind / shadcn on Tailwind v4. */
export function cssTailwind4(model) {
  const theme = Object.keys(model.themes.light)
    .map((n) => `  --color-${n}: hsl(var(--${n}));`)
    .join('\n');
  const radius = Object.entries(model.radius)
    .map(([k, v]) => `  --radius-${varName(k)}: ${v};`)
    .join('\n');
  const text = Object.entries(model.fontSize)
    .map(([k, v]) => `  --text-${k}: ${v.size};\n  --text-${k}--line-height: ${v.lineHeight};`)
    .join('\n');
  return `${block(`${HEADER}\nTailwind v4 (CSS-first) flavour. Use with NativeWind v5, Uniwind or shadcn on Tailwind 4.`)}
:root {
${colorVars(model.themes.light)}
}

.dark {
${colorVars(model.themes.dark)}
}

@theme inline {
${theme}
${radius}
${text}
}
`;
}

/* ----------------------------------------------------------------------- SCSS */
/** `tokens.scss` — variables, maps, functions and mixins for hand-written SCSS. */
export function scss(model) {
  const lines = [];
  lines.push(line(HEADER), "@use 'sass:map';\n");

  lines.push(line('Core palette — primitives. Prefer the semantic maps below in components.'));
  for (const [family, val] of Object.entries(model.palette)) {
    if (typeof val === 'string') lines.push(`$color-${family}: ${val};`);
    else
      for (const [step, hex] of Object.entries(val))
        lines.push(`$color-${family}-${step}: ${hex};`);
  }
  lines.push('\n$palette: (');
  for (const [family, val] of Object.entries(model.palette)) {
    if (typeof val === 'string') lines.push(`  ${q(family)}: ${val},`);
    else {
      lines.push(`  ${q(family)}: (`);
      lines.push(
        Object.entries(val)
          .map(([s, hex]) => `    ${q(s)}: ${hex}`)
          .join(',\n'),
      );
      lines.push('  ),');
    }
  }
  lines.push(');\n');

  const scale = (name, obj) => {
    lines.push(line(`${name} scale`));
    for (const [k, v] of Object.entries(obj)) lines.push(`$${name}-${varName(k)}: ${v};`);
    lines.push(`$${name}: (`);
    lines.push(
      Object.entries(obj)
        .map(([k, v]) => `  ${q(k)}: ${v}`)
        .join(',\n'),
    );
    lines.push(');\n');
  };
  scale('spacing', model.spacing);
  scale('radius', model.radius);
  scale(
    'font-size',
    Object.fromEntries(Object.entries(model.fontSize).map(([k, v]) => [k, v.size])),
  );
  scale(
    'line-height',
    Object.fromEntries(Object.entries(model.fontSize).map(([k, v]) => [k, v.lineHeight])),
  );
  scale('font-weight', model.fontWeight);
  scale('duration', model.duration);
  scale('size', model.size);
  lines.push(line('Shadows and font stacks (strings)'));
  for (const [k, v] of Object.entries(model.shadow)) lines.push(`$shadow-${k}: ${v};`);
  for (const [k, v] of Object.entries(model.fontFamily)) lines.push(`$font-family-${k}: ${v};`);
  lines.push('');

  for (const mode of ['light', 'dark']) {
    lines.push(line(`Semantic colours, ${mode} mode (resolved hex — handy for Sass colour maths)`));
    lines.push(`$semantic-${mode}: (`);
    lines.push(
      Object.entries(model.themes[mode])
        .map(([k, v]) => `  ${q(k)}: ${v.hex}`)
        .join(',\n'),
    );
    lines.push(');\n');
  }

  lines.push(
    `${line('Emit the runtime CSS variables (same channel triplets as tokens.css).')}@mixin theme-light {`,
  );
  lines.push(colorVars(model.themes.light));
  lines.push('}\n@mixin theme-dark {');
  lines.push(colorVars(model.themes.dark));
  lines.push('}\n');
  lines.push(`@mixin root {
  :root {
    @include theme-light;
  }
  .dark {
    @include theme-dark;
  }
}
`);
  lines.push(`${line('Reference a semantic colour: `color: t.semantic(primary)` or `t.semantic(primary, 0.5)`.')}@function semantic($name, $alpha: null) {
  @if $alpha == null {
    @return hsl(var(--#{$name}));
  }
  @return hsl(var(--#{$name}) / #{$alpha});
}
`);
  lines.push(`${line('Reference the spacing / radius scales: `padding: t.space(4)`.')}@function space($key) {
  @return map.get($spacing, "#{$key}");
}

@function radius($key) {
  @return map.get($radius, "#{$key}");
}
`);
  return lines.join('\n');
}

/* ------------------------------------------------------------ Tailwind preset */
/** `tailwind.preset.cjs` — shared by the web Tailwind config and NativeWind (v4). */
export function tailwindPreset(model) {
  const colors = {
    transparent: 'transparent',
    current: 'currentColor',
    white: '#ffffff',
    black: '#000000',
  };
  for (const name of Object.keys(model.themes.light))
    colors[name] = `hsl(var(--${name}) / <alpha-value>)`;
  const fontSize = Object.fromEntries(
    Object.entries(model.fontSize).map(([k, v]) => [k, [v.size, { lineHeight: v.lineHeight }]]),
  );
  return `${block(`${HEADER}\nShared Tailwind v3 preset. Web: presets: [require('@tbc/tokens/tailwind-preset')].\nNative: presets: [require('nativewind/preset'), require('@tbc/tokens/tailwind-preset')].\nRaw palette colours are intentionally NOT exposed: use semantic names (bg-primary, text-muted-foreground).`)}
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  theme: {
    colors: ${JSON.stringify(colors, null, 6).replace(/\n}/, '\n    }')},
    spacing: ${JSON.stringify(model.spacing, null, 6).replace(/\n}/, '\n    }')},
    borderRadius: ${JSON.stringify(model.radius, null, 6).replace(/\n}/, '\n    }')},
    fontSize: ${JSON.stringify(fontSize, null, 6).replace(/\n}/, '\n    }')},
    extend: {
      boxShadow: ${JSON.stringify(model.shadow, null, 8).replace(/\n}/, '\n      }')},
      transitionDuration: ${JSON.stringify(model.duration, null, 8).replace(/\n}/, '\n      }')},
      minHeight: { touch: ${q(model.size.touchTarget)} },
      minWidth: { touch: ${q(model.size.touchTarget)} },
    },
  },
};
`;
}

/* ------------------------------------------------------------------ TS theme */
/** `theme.ts` — typed tokens for JS consumers (SVG fills, navigation theme, Reanimated timings). */
export function tsTheme(model) {
  const num = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, px(v)]));
  const themes = Object.fromEntries(
    Object.entries(model.themes).map(([mode, t]) => [
      mode,
      Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v.hex])),
    ]),
  );
  const fontSize = Object.fromEntries(
    Object.entries(model.fontSize).map(([k, v]) => [
      k,
      { size: px(v.size), lineHeight: px(v.lineHeight) },
    ]),
  );
  const fontWeight = Object.fromEntries(
    Object.entries(model.fontWeight).map(([k, v]) => [k, String(v)]),
  );
  const duration = Object.fromEntries(Object.entries(model.duration).map(([k, v]) => [k, ms(v)]));
  const size = nest(Object.fromEntries(Object.entries(model.size).map(([k, v]) => [k, px(v)])));
  const j = (o) => JSON.stringify(o, null, 2);
  return `${block(HEADER)}
/** Core palette (primitives). Components should use {@link themes} instead. */
export const palette = ${j(model.palette)} as const;

/** Spacing scale in dp. Keys mirror Tailwind (\`4\` = 16). */
export const spacing = ${j(num(model.spacing))} as const;

/** Corner radii in dp. */
export const radius = ${j(num(model.radius))} as const;

/** Font size + paired line height in dp. */
export const fontSize = ${j(fontSize)} as const;

/** Font weights as React Native expects them (strings). */
export const fontWeight = ${j(fontWeight)} as const;

/** Font stacks (web). Native uses the platform system font. */
export const fontFamily = ${j(model.fontFamily)} as const;

/** CSS box-shadow strings. */
export const shadow = ${j(model.shadow)} as const;

/** Animation durations in ms. */
export const duration = ${j(duration)} as const;

/** Cubic-bezier control points. */
export const easing = ${j(model.easing)} as const;

/** Component sizing decisions in dp (control heights, icon sizes, touch target). */
export const size = ${j(size)} as const;

/** Resolved semantic colours per mode (hex). Use for props that cannot take a className. */
export const themes = ${j(themes)} as const;

/** Names of the colour schemes. */
export type ThemeName = keyof typeof themes;
/** Every semantic colour token name, e.g. \`'primary'\`. */
export type SemanticColor = keyof (typeof themes)['light'];

/**
 * Get the resolved colours for a scheme.
 * @param name - \`'light'\` or \`'dark'\`.
 */
export function getTheme(name: ThemeName) {
  return themes[name];
}
`;
}

/* ---------------------------------------------------------------------- JSON */
/** `tokens.json` — flat, resolved snapshot. Feeds Storybook token docs and any tooling. */
export function jsonFlat(model) {
  const themes = Object.fromEntries(
    Object.entries(model.themes).map(([m, t]) => [
      m,
      Object.fromEntries(
        Object.entries(t).map(([k, v]) => [k, { hex: v.hex, hslChannels: v.channels }]),
      ),
    ]),
  );
  return `${JSON.stringify({ palette: model.palette, themes, descriptions: model.descriptions, spacing: model.spacing, radius: model.radius, fontFamily: model.fontFamily, fontSize: model.fontSize, fontWeight: model.fontWeight, shadow: model.shadow, duration: model.duration, easing: model.easing, size: nest(model.size) }, null, 2)}\n`;
}

/** Register every format on a Style Dictionary class. */
export function registerFormats(StyleDictionary) {
  const wrap =
    (fn) =>
    ({ dictionary }) =>
      fn(buildModel(dictionary.allTokens));
  StyleDictionary.registerFormat({ name: 'tbc/css-web', format: wrap(cssWeb) });
  StyleDictionary.registerFormat({ name: 'tbc/css-native', format: wrap(cssNative) });
  StyleDictionary.registerFormat({ name: 'tbc/css-tailwind4', format: wrap(cssTailwind4) });
  StyleDictionary.registerFormat({ name: 'tbc/scss', format: wrap(scss) });
  StyleDictionary.registerFormat({ name: 'tbc/tailwind-preset', format: wrap(tailwindPreset) });
  StyleDictionary.registerFormat({ name: 'tbc/ts-theme', format: wrap(tsTheme) });
  StyleDictionary.registerFormat({ name: 'tbc/json-flat', format: wrap(jsonFlat) });
}
