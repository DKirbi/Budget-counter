/**
 * Documentation-only React (DOM) views of the design tokens. They read the *generated* token outputs
 * (`@tbc/tokens`, `@tbc/tokens/json`), so the docs can never drift from what the apps consume.
 */
import tokens from '@tbc/tokens/json';
import { themes } from '@tbc/tokens';
import * as React from 'react';

type Hex = `#${string}`;

const css = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
    gap: 12,
    margin: '16px 0',
  } as React.CSSProperties,
  card: {
    border: '1px solid hsl(var(--border))',
    borderRadius: 12,
    overflow: 'hidden',
    background: 'hsl(var(--card))',
    color: 'hsl(var(--card-foreground))',
    fontSize: 12,
  } as React.CSSProperties,
  meta: { padding: '8px 10px', lineHeight: 1.5 } as React.CSSProperties,
  mono: {
    fontFamily: 'ui-monospace, Menlo, monospace',
    fontSize: 11,
    opacity: 0.8,
  } as React.CSSProperties,
};

function luminance(hex: Hex): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours. */
export function contrast(a: Hex, b: Hex): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** The semantic palette for one theme, with each foreground pair's contrast ratio. */
export function SemanticColors({ theme }: { theme: 'light' | 'dark' }) {
  const t = themes[theme] as Record<string, Hex>;
  const descriptions = tokens.descriptions as Record<string, string>;
  const pairs = Object.keys(t).filter((k) => !k.endsWith('-foreground') && t[`${k}-foreground`]);
  const singles = Object.keys(t).filter((k) => !pairs.includes(k) && !k.endsWith('-foreground'));
  return (
    <div data-theme-preview={theme} style={css.grid}>
      {pairs.map((name) => {
        const ratio = contrast(t[name]!, t[`${name}-foreground`]!);
        return (
          <div key={name} style={css.card}>
            <div
              style={{
                background: t[name],
                color: t[`${name}-foreground`],
                padding: '18px 10px',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Aa · {name}
            </div>
            <div style={css.meta}>
              <div>
                <code>{name}</code> <span style={css.mono}>{t[name]}</span>
              </div>
              <div style={css.mono}>
                on {name}-foreground · {ratio.toFixed(1)}:1{' '}
                {ratio >= 4.5 ? 'AA ✓' : ratio >= 3 ? 'large text only' : '✗'}
              </div>
              {descriptions[name] ? (
                <div style={{ opacity: 0.75 }}>{descriptions[name]}</div>
              ) : null}
            </div>
          </div>
        );
      })}
      {singles.map((name) => (
        <div key={name} style={css.card}>
          <div
            style={{
              background: t[name],
              height: 56,
              borderBottom: '1px solid hsl(var(--border))',
            }}
          />
          <div style={css.meta}>
            <code>{name}</code> <span style={css.mono}>{t[name]}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Core (primitive) palette: hue scales. Components never use these directly. */
export function Palette() {
  const palette = tokens.palette as Record<string, string | Record<string, string>>;
  return (
    <div style={{ display: 'grid', gap: 10, margin: '16px 0' }}>
      {Object.entries(palette)
        .filter(([, v]) => typeof v === 'object')
        .map(([hue, steps]) => (
          <div
            key={hue}
            style={{
              display: 'grid',
              gridTemplateColumns: '84px 1fr',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <code>{hue}</code>
            <div
              style={{
                display: 'flex',
                borderRadius: 8,
                overflow: 'hidden',
                border: '1px solid hsl(var(--border))',
              }}
            >
              {Object.entries(steps as Record<string, string>).map(([step, hex]) => (
                <div
                  key={step}
                  title={`${hue}-${step} ${hex}`}
                  style={{
                    flex: 1,
                    height: 36,
                    background: hex,
                    fontSize: 9,
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    color: luminance(hex as Hex) > 0.4 ? '#000' : '#fff',
                    paddingBottom: 2,
                  }}
                >
                  {step}
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

/** Type scale from `fontSize` / `fontWeight` tokens. */
export function TypeScale() {
  const sizes = tokens.fontSize as Record<string, { size: string; lineHeight: string }>;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', margin: '16px 0' }}>
      <thead>
        <tr style={{ textAlign: 'left', fontSize: 12, opacity: 0.7 }}>
          <th>Token</th>
          <th>Size / line</th>
          <th>Specimen</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(sizes).map(([name, v]) => (
          <tr key={name} style={{ borderTop: '1px solid hsl(var(--border))' }}>
            <td>
              <code>text-{name}</code>
            </td>
            <td style={css.mono}>
              {v.size} / {v.lineHeight}
            </td>
            <td style={{ fontSize: v.size, lineHeight: v.lineHeight, padding: '6px 0' }}>
              €1,234.50 spent today
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Spacing scale (4 px base grid). */
export function SpacingScale() {
  const spacing = tokens.spacing as Record<string, string>;
  return (
    <div style={{ display: 'grid', gap: 6, margin: '16px 0' }}>
      {Object.entries(spacing)
        .filter(([, px]) => px !== '0px')
        .map(([step, px]) => (
          <div
            key={step}
            style={{
              display: 'grid',
              gridTemplateColumns: '90px 60px 1fr',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
            }}
          >
            <code>
              p-{step} · gap-{step}
            </code>
            <span style={css.mono}>{px}</span>
            <div
              style={{ height: 12, width: px, background: 'hsl(var(--primary))', borderRadius: 3 }}
            />
          </div>
        ))}
    </div>
  );
}

/** Radius scale. */
export function RadiusScale() {
  const radius = tokens.radius as Record<string, string>;
  return (
    <div style={css.grid}>
      {Object.entries(radius).map(([name, px]) => (
        <div
          key={name}
          style={{ ...css.card, padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              background: 'hsl(var(--accent))',
              border: '2px solid hsl(var(--primary))',
              borderRadius: px === '9999px' ? 28 : px,
            }}
          />
          <div>
            <code>rounded-{name}</code>
            <div style={css.mono}>{px}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Elevation (shadows). */
export function ShadowScale() {
  const shadow = tokens.shadow as Record<string, string>;
  return (
    <div style={css.grid}>
      {Object.entries(shadow).map(([name, value]) => (
        <div key={name} style={{ ...css.card, padding: 20, boxShadow: value }}>
          <code>shadow-{name}</code>
          <div style={{ ...css.mono, marginTop: 6 }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

/** Motion tokens as a table. */
export function MotionTable() {
  const rows: [string, string][] = [
    ...Object.entries(tokens.duration as Record<string, string>).map(([k, v]): [string, string] => [
      `duration.${k}`,
      v,
    ]),
    ...Object.entries(tokens.easing as Record<string, number[]>).map(([k, v]): [string, string] => [
      `easing.${k}`,
      `cubic-bezier(${v.join(', ')})`,
    ]),
  ];
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', margin: '16px 0', fontSize: 13 }}>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} style={{ borderTop: '1px solid hsl(var(--border))' }}>
            <td>
              <code>{k}</code>
            </td>
            <td style={css.mono}>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Touch target + control sizes. */
export function SizeTable() {
  const size = tokens.size as Record<string, string | Record<string, string>>;
  const rows: [string, string][] = [];
  for (const [k, v] of Object.entries(size)) {
    if (typeof v === 'string') rows.push([`size.${k}`, v]);
    else for (const [k2, v2] of Object.entries(v)) rows.push([`size.${k}.${k2}`, v2]);
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', margin: '16px 0', fontSize: 13 }}>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} style={{ borderTop: '1px solid hsl(var(--border))' }}>
            <td>
              <code>{k}</code>
            </td>
            <td style={css.mono}>{v}</td>
            <td>
              <div
                style={{ height: 10, width: v, background: 'hsl(var(--primary))', borderRadius: 3 }}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
