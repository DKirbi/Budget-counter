/*
 * GENERATED FILE — DO NOT EDIT.
 * Source: packages/tokens/src/**  ·  Run `pnpm tokens` to regenerate.
 */

/** Core palette (primitives). Components should use {@link themes} instead. */
export const palette = {
  "white": "#ffffff",
  "black": "#000000",
  "stone": {
    "50": "#fafaf9",
    "100": "#f5f5f4",
    "200": "#e7e5e4",
    "300": "#d6d3d1",
    "400": "#a8a29e",
    "500": "#78716c",
    "600": "#57534e",
    "700": "#44403c",
    "800": "#292524",
    "900": "#1c1917",
    "950": "#0c0a09"
  },
  "teal": {
    "50": "#f0fdfa",
    "100": "#ccfbf1",
    "200": "#99f6e4",
    "300": "#5eead4",
    "400": "#2dd4bf",
    "500": "#14b8a6",
    "600": "#0d9488",
    "700": "#0f766e",
    "800": "#115e59",
    "900": "#134e4a",
    "950": "#042f2e"
  },
  "red": {
    "50": "#fef2f2",
    "100": "#fee2e2",
    "200": "#fecaca",
    "300": "#fca5a5",
    "400": "#f87171",
    "500": "#ef4444",
    "600": "#dc2626",
    "700": "#b91c1c",
    "800": "#991b1b",
    "900": "#7f1d1d",
    "950": "#450a0a"
  },
  "amber": {
    "50": "#fffbeb",
    "100": "#fef3c7",
    "200": "#fde68a",
    "300": "#fcd34d",
    "400": "#fbbf24",
    "500": "#f59e0b",
    "600": "#d97706",
    "700": "#b45309",
    "800": "#92400e",
    "900": "#78350f",
    "950": "#451a03"
  },
  "emerald": {
    "50": "#ecfdf5",
    "100": "#d1fae5",
    "200": "#a7f3d0",
    "300": "#6ee7b7",
    "400": "#34d399",
    "500": "#10b981",
    "600": "#059669",
    "700": "#047857",
    "800": "#065f46",
    "900": "#064e3b",
    "950": "#022c22"
  },
  "sky": {
    "50": "#f0f9ff",
    "100": "#e0f2fe",
    "200": "#bae6fd",
    "300": "#7dd3fc",
    "400": "#38bdf8",
    "500": "#0ea5e9",
    "600": "#0284c7",
    "700": "#0369a1",
    "800": "#075985",
    "900": "#0c4a6e",
    "950": "#082f49"
  },
  "orange": {
    "50": "#fff7ed",
    "100": "#ffedd5",
    "200": "#fed7aa",
    "300": "#fdba74",
    "400": "#fb923c",
    "500": "#f97316",
    "600": "#ea580c",
    "700": "#c2410c",
    "800": "#9a3412",
    "900": "#7c2d12",
    "950": "#431407"
  },
  "lime": {
    "50": "#f7fee7",
    "100": "#ecfccb",
    "200": "#d9f99d",
    "300": "#bef264",
    "400": "#a3e635",
    "500": "#84cc16",
    "600": "#65a30d",
    "700": "#4d7c0f",
    "800": "#3f6212",
    "900": "#365314",
    "950": "#1a2e05"
  },
  "violet": {
    "50": "#f5f3ff",
    "100": "#ede9fe",
    "200": "#ddd6fe",
    "300": "#c4b5fd",
    "400": "#a78bfa",
    "500": "#8b5cf6",
    "600": "#7c3aed",
    "700": "#6d28d9",
    "800": "#5b21b6",
    "900": "#4c1d95",
    "950": "#2e1065"
  },
  "pink": {
    "50": "#fdf2f8",
    "100": "#fce7f3",
    "200": "#fbcfe8",
    "300": "#f9a8d4",
    "400": "#f472b6",
    "500": "#ec4899",
    "600": "#db2777",
    "700": "#be185d",
    "800": "#9d174d",
    "900": "#831843",
    "950": "#500724"
  }
} as const;

/** Spacing scale in dp. Keys mirror Tailwind (`4` = 16). */
export const spacing = {
  "0": 0,
  "1": 4,
  "2": 8,
  "3": 12,
  "4": 16,
  "5": 20,
  "6": 24,
  "7": 28,
  "8": 32,
  "9": 36,
  "10": 40,
  "11": 44,
  "12": 48,
  "13": 52,
  "14": 56,
  "16": 64,
  "20": 80,
  "24": 96,
  "28": 112,
  "32": 128,
  "px": 1,
  "0.5": 2,
  "1.5": 6,
  "2.5": 10,
  "3.5": 14
} as const;

/** Corner radii in dp. */
export const radius = {
  "none": 0,
  "sm": 6,
  "md": 8,
  "lg": 12,
  "xl": 16,
  "2xl": 24,
  "full": 9999
} as const;

/** Font size + paired line height in dp. */
export const fontSize = {
  "xs": {
    "size": 12,
    "lineHeight": 16
  },
  "sm": {
    "size": 14,
    "lineHeight": 20
  },
  "base": {
    "size": 16,
    "lineHeight": 24
  },
  "lg": {
    "size": 18,
    "lineHeight": 28
  },
  "xl": {
    "size": 20,
    "lineHeight": 28
  },
  "2xl": {
    "size": 24,
    "lineHeight": 32
  },
  "3xl": {
    "size": 30,
    "lineHeight": 36
  },
  "4xl": {
    "size": 36,
    "lineHeight": 40
  },
  "5xl": {
    "size": 48,
    "lineHeight": 52
  }
} as const;

/** Font weights as React Native expects them (strings). */
export const fontWeight = {
  "normal": "400",
  "medium": "500",
  "semibold": "600",
  "bold": "700"
} as const;

/** Font stacks (web). Native uses the platform system font. */
export const fontFamily = {
  "sans": "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  "mono": "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
} as const;

/** CSS box-shadow strings. */
export const shadow = {
  "sm": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  "md": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  "lg": "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)"
} as const;

/** Animation durations in ms. */
export const duration = {
  "fast": 120,
  "base": 200,
  "slow": 320
} as const;

/** Cubic-bezier control points. */
export const easing = {
  "standard": [
    0.2,
    0,
    0,
    1
  ],
  "emphasized": [
    0.3,
    0,
    0,
    1
  ]
} as const;

/** Component sizing decisions in dp (control heights, icon sizes, touch target). */
export const size = {
  "touchTarget": 44,
  "control": {
    "sm": 36,
    "md": 44,
    "lg": 52
  },
  "icon": {
    "sm": 16,
    "md": 20,
    "lg": 24,
    "xl": 32
  }
} as const;

/** Resolved semantic colours per mode (hex). Use for props that cannot take a className. */
export const themes = {
  "light": {
    "background": "#fafaf9",
    "foreground": "#1c1917",
    "card": "#ffffff",
    "card-foreground": "#1c1917",
    "popover": "#ffffff",
    "popover-foreground": "#1c1917",
    "primary": "#0f766e",
    "primary-foreground": "#ffffff",
    "secondary": "#f5f5f4",
    "secondary-foreground": "#1c1917",
    "muted": "#f5f5f4",
    "muted-foreground": "#57534e",
    "accent": "#f0fdfa",
    "accent-foreground": "#134e4a",
    "destructive": "#dc2626",
    "destructive-foreground": "#ffffff",
    "success": "#047857",
    "success-foreground": "#ffffff",
    "warning": "#d97706",
    "warning-foreground": "#451a03",
    "info": "#0369a1",
    "info-foreground": "#ffffff",
    "border": "#e7e5e4",
    "input": "#d6d3d1",
    "ring": "#0d9488",
    "tag-food": "#ea580c",
    "tag-groceries": "#4d7c0f",
    "tag-transport": "#0284c7",
    "tag-stay": "#7c3aed",
    "tag-activities": "#db2777",
    "tag-shopping": "#d97706",
    "tag-other": "#78716c"
  },
  "dark": {
    "background": "#0c0a09",
    "foreground": "#fafaf9",
    "card": "#1c1917",
    "card-foreground": "#fafaf9",
    "popover": "#1c1917",
    "popover-foreground": "#fafaf9",
    "primary": "#2dd4bf",
    "primary-foreground": "#042f2e",
    "secondary": "#292524",
    "secondary-foreground": "#fafaf9",
    "muted": "#292524",
    "muted-foreground": "#a8a29e",
    "accent": "#134e4a",
    "accent-foreground": "#f0fdfa",
    "destructive": "#f87171",
    "destructive-foreground": "#450a0a",
    "success": "#34d399",
    "success-foreground": "#022c22",
    "warning": "#fbbf24",
    "warning-foreground": "#451a03",
    "info": "#38bdf8",
    "info-foreground": "#082f49",
    "border": "#292524",
    "input": "#44403c",
    "ring": "#2dd4bf",
    "tag-food": "#fb923c",
    "tag-groceries": "#a3e635",
    "tag-transport": "#38bdf8",
    "tag-stay": "#a78bfa",
    "tag-activities": "#f472b6",
    "tag-shopping": "#fbbf24",
    "tag-other": "#a8a29e"
  }
} as const;

/** Names of the colour schemes. */
export type ThemeName = keyof typeof themes;
/** Every semantic colour token name, e.g. `'primary'`. */
export type SemanticColor = keyof (typeof themes)['light'];

/**
 * Get the resolved colours for a scheme.
 * @param name - `'light'` or `'dark'`.
 */
export function getTheme(name: ThemeName) {
  return themes[name];
}
