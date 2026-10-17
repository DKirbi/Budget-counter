# Building the React (web) app from this repo

**Status:** guide, not code — the first drop is React Native complete (see the README). This document is the plan for
the web side, written so that a person (or a future Claude skill) can execute it step by step. The two riskiest claims —
_"the web can consume our tokens"_ and _"the web can reuse `@tbc/core`"_ — were verified with a throw-away spike (see
[§ What was verified](#what-was-verified)).

> **What is shared and what isn't**
>
> - Shared, unchanged: `@tbc/tokens` (look & feel), `@tbc/core` (money, dates, allowance engine, forms, zustand store,
>   React hooks, receipt parser / categoriser / odd-bill rules / AI client), test fixtures and fakes (`@tbc/core/testing`),
>   the flow definitions F1–F15.
> - Per-platform: components and screens. Web uses **shadcn/ui on Radix UI** (the DOM originals of what
>   `@tbc/ui-native` re-implements with rn-primitives). We copy shadcn components, we don't invent any.

## 1 · Pick an approach

|                                                               | **A · Separate React app** (recommended)             | **B · Expo web** (react-native-web)          | **C · Solito / Next.js universal**         |
| ------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------- | ------------------------------------------ |
| Codebase                                                      | `apps/web` + `packages/ui-web`, shares core + tokens | the existing `apps/mobile` exported to web   | shared screens, thin Next + Expo shells    |
| Components                                                    | shadcn/ui + Radix (real DOM)                         | `@tbc/ui-native` as-is via react-native-web  | RN components everywhere, or split         |
| Web feel (SEO, forms, keyboard, text selection, browser a11y) | native                                               | "an app in a browser"                        | good with Next                             |
| Effort                                                        | medium (port ~20 components + 7 screens)             | **lowest**: `npx expo export --platform web` | highest (routing/monorepo plumbing)        |
| Design-system parity                                          | tokens shared, components mirrored                   | 100 % same components                        | 100 % if RN components are used everywhere |
| Fits "shadcn/Radix as base"                                   | yes                                                  | via rn-primitives (Radix's RN sibling)       | mixed                                      |

**Recommendation:** approach **A**. It respects the brief (_shadcn/Radix, react and react-native separate_), gives the
web its own idiomatic UX, and the shared `core`+`tokens` mean the parts that must never diverge (money maths and
colours) can't. Approach **B** is a legitimate 1-day shortcut for an internal demo or PWA: this repo already proves the
RN components render on the web (that's what Storybook is), and `app.json` has `web.bundler: metro`; do it first if you
need a URL quickly, then replace it with A as the product grows. Choose **C** only if you later want screens shared at
source level.

## 1b · Same repo, or a new one?

**Put the web app in this repository** (`apps/web` + `packages/ui-web`). The whole architecture exists so that web and
mobile share the parts that must never disagree — `@tbc/core` (money, allowance engine, receipt parser, odd-bill rules,
store) and `@tbc/tokens` — and a workspace link is the only mechanism that makes that free.

| Question                                               | Same monorepo (recommended)                                                                                         | Separate repo                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| A parser fix (new receipt language, new odd-bill rule) | one PR, both apps get it, tests of both run                                                                         | publish `@tbc/core`, bump, release in two repos — versions drift    |
| Token change (colour, radius)                          | `pnpm tokens` regenerates for both; CI tests both                                                                   | publish `@tbc/tokens` as a package; each repo must upgrade          |
| Atomic refactors (rename a core type)                  | `tsc` across the whole repo catches every caller                                                                    | breaking change lands in one repo, breaks the other later           |
| CI cost                                                | Turborepo `--filter=...[origin/main]` and caching keep it fast; path-filtered jobs per app                          | each repo small and fast, but you rebuild the shared packages twice |
| Release cadence                                        | independent: `apps/mobile` ships via EAS/tags, `apps/web` deploys on push to `main` — separate workflows, same repo | trivially independent                                               |
| Access control / open-sourcing one half                | all or nothing                                                                                                      | possible                                                            |
| Different team owning the web app                      | needs CODEOWNERS per folder                                                                                         | natural                                                             |

Choose a **separate repository only if** (a) a different team owns the web app and will not touch `core`, (b) you want to
open-source one half, or (c) the web app becomes a different product. If you ever need to split later, `@tbc/core` and
`@tbc/tokens` are already self-contained packages with no dependency on the apps: publish them from the monorepo
(Changesets) and let the new repo consume them from npm — nothing has to be rewritten.

Practical rules for living in one repo:

- Add path filters so a web-only change does not trigger the Android build (`on.push.paths: ['apps/web/**', 'packages/ui-web/**', 'packages/core/**', 'packages/tokens/**']`) and vice versa.
- One workflow per deployable: `android-apk.yml` (exists), `web-deploy.yml` (new: build `apps/web`, publish to GitHub Pages / Cloudflare Pages / Vercel).
- `packages/ui-web` must not import `react-native*` and `packages/ui-native` must not import `react-dom` / Radix. Enforce it
  with an ESLint `no-restricted-imports` override per package so the two component sets cannot leak into each other.
- Keep `@tbc/core` free of both. It currently depends only on `zustand` and `zod`.

### What the web app does with bill scanning

The bill pipeline lives in `@tbc/core` behind the `ScanServices` ports, so the web app needs **adapters, not a rewrite**:

| Port      | Web adapter                                                                                                                                                                             |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `picker`  | `<input type="file" accept="image/*" multiple capture="environment">` (opens the camera on phones)                                                                                      |
| `ocr`     | `tesseract.js` (WASM, offline, noticeably less accurate than ML Kit) — or report `isSupported() = false` and lean on the AI fallback / manual entry                                     |
| `images`  | IndexedDB blobs + a `canvas` resize/re-encode for `encodeForAi`                                                                                                                         |
| `secrets` | `localStorage` is readable by any script on the origin; for the BYO AI key prefer an in-memory field with an explicit "remember" opt-in, or a server-side proxy once there is a backend |
| `fetch`   | global `fetch` (Gemini's REST API allows browser calls with a key; OpenAI-compatible endpoints may need CORS or a proxy)                                                                |

All parsing, odd-bill checks, categorising, budgeting and the timeline logic are shared; only the screens
(`ReceiptTimeline`, scan list, review form) are ported from `@tbc/ui-native` to shadcn/ui.

## 2 · Target layout

```
packages/
  tokens/          (exists)  ← shared
  core/            (exists)  ← shared
  ui-native/       (exists)
  ui-web/          NEW  shadcn/ui components (copied by the CLI), CVA, cn(), stories
  screens-web/     NEW  (optional; can start inside apps/web/src/screens)
apps/
  mobile/          (exists)
  storybook/       (exists)  RN components on react-native-web
  web/             NEW  Vite + React 19 + Tailwind + router
  storybook-web/   NEW  (optional) @storybook/react-vite for ui-web, composed into the main Storybook via `refs`
```

Start with everything inside `apps/web` and extract `packages/ui-web` when a second consumer (Storybook) needs it. Don't
build package boundaries you don't yet need.

## 3 · Step by step (approach A)

### 3.1 Scaffold

```bash
pnpm create vite apps/web --template react-ts
cd apps/web
pnpm add react@19.2.3 react-dom@19.2.3 react-router
pnpm add @tbc/core@workspace:* @tbc/tokens@workspace:*
pnpm add class-variance-authority clsx tailwind-merge lucide-react @radix-ui/react-slot
```

Turborepo, ESLint and Prettier configs at the repo root already apply; add `"typecheck": "tsc --noEmit"`,
`"lint": "eslint src"`, `"test": "vitest run"` scripts so `turbo run …` picks the app up automatically.

### 3.2 Wire the tokens (choose one — both verified)

**Tailwind 3.4** (same engine as the RN app; one preset for both platforms):

```bash
pnpm add -D tailwindcss@3.4.19 postcss autoprefixer
```

```js
// apps/web/tailwind.config.cjs
module.exports = {
  presets: [require('@tbc/tokens/tailwind-preset')],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
};
// apps/web/postcss.config.cjs
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

```css
/* apps/web/src/index.css */
@import '@tbc/tokens/css'; /* :root + .dark variables */
@tailwind base;
@tailwind components;
@tailwind utilities;
@layer base {
  body {
    @apply bg-background text-foreground;
  }
}
```

**Tailwind 4** (what a fresh `shadcn init` targets, and the NativeWind v5 / Uniwind future):

```bash
pnpm add -D tailwindcss @tailwindcss/vite
```

```ts
// vite.config.ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
export default { plugins: [react(), tailwindcss()] };
```

```css
/* src/index.css */
@import 'tailwindcss';
@import '@tbc/tokens/css/tailwind4'; /* variables + @theme inline mapping */
@custom-variant dark (&:where(.dark, .dark *));
@layer base {
  body {
    @apply bg-background text-foreground;
  }
}
```

Either way, dark mode = toggle the `dark` class on `<html>` (persist the choice in the same `settings.theme` the store
already has: `system` → `matchMedia('(prefers-color-scheme: dark)')`).

### 3.3 Add the shadcn components

```bash
pnpm dlx shadcn@latest init          # creates components.json, src/lib/utils.ts; needs the "@" alias (see below)
pnpm dlx shadcn@latest add button card badge alert alert-dialog input label progress \
  radio-group separator skeleton switch tabs toggle-group
```

`@` alias: `"paths": {"@/*": ["./src/*"]}` in `tsconfig.json`/`tsconfig.app.json` and
`resolve.alias: { '@': path.resolve(__dirname, './src') }` in `vite.config.ts` (the shadcn Vite guide's requirement).
In a monorepo, `shadcn` takes `-c <workspace>` to target a package.

**Then make the tokens win.** `shadcn init` writes its own colour variables (`:root { --background: oklch(...) … }`, and
for Tailwind 4 an `@theme inline` block) into `index.css`. Delete those blocks and keep the two token imports from §3.2.
The semantic names are identical (`background`, `card`, `primary`, `muted-foreground`, `destructive`, `ring` …), so every
generated component picks the brand colours up untouched. Add what shadcn lacks by extending our tokens, not by editing
components: `success`, `warning`, `info`, `tag-*` already exist in the token files.

Tailwind-version note: the shadcn docs state existing Tailwind 3 projects keep working and new components added to them
stay v3-compatible; new projects default to v4. If `init` generates v4-style code in a v3 project, either pick §3.2's
Tailwind 4 branch or follow shadcn's legacy (v3) instructions.

### 3.4 Storage and state — reuse `@tbc/core` as-is

```ts
// apps/web/src/store.ts
import { createBudgetStore } from '@tbc/core';

/** localStorage is synchronous, so the store is hydrated before the first render. */
export const appStore = createBudgetStore({ storage: window.localStorage });
```

```tsx
// apps/web/src/main.tsx
import { BudgetProvider } from '@tbc/core/react';
createRoot(root).render(
  <BudgetProvider store={appStore}>
    <App />
  </BudgetProvider>,
);
```

Everything else (`useActivePlan`, `useBudgetActions`, `validateSpendForm`, `formatMoney`, `computeTripSummary`) works
unchanged. If you ever server-render, pass `createMemoryStorage()` on the server and hydrate on the client.

### 3.5 Port the screens

Routes mirror expo-router 1:1:

| expo-router                          | React Router                                             |
| ------------------------------------ | -------------------------------------------------------- |
| `(tabs)/index`                       | `/` Today                                                |
| `(tabs)/days`, `summary`, `settings` | `/days`, `/summary`, `/settings`                         |
| `day/[date]`                         | `/day/:date`                                             |
| `trip/new`                           | `/trip/new` (dialog route)                               |
| `spend/new?date=` , `spend/[id]`     | `/spend/new?date=`, `/spend/:id` (dialog / sheet routes) |

Each RN screen is already "props in, callbacks out" (`onOpenDay`, `onCreateTrip`, …), so the web screen is the same
component tree with different leaves. The translation is mechanical:

| React Native (`@tbc/ui-native`)                                                                      | Web                                                                                                                            |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `View`, `Text`, `Pressable`                                                                          | `div`, `span`/`p`/`h1-3`, `button`                                                                                             |
| `ScrollView` / `Screen`                                                                              | `main` with normal page scroll; safe-area via `env(safe-area-inset-*)`                                                         |
| `TextInput` `onChangeText(text)`                                                                     | `input` `onChange={(e) => …(e.target.value)}`; `inputMode="decimal"` for amounts                                               |
| `onPress`                                                                                            | `onClick`                                                                                                                      |
| `testID`                                                                                             | `data-testid` (Playwright: `testIdAttribute: 'data-testid'` — same ids as Maestro)                                             |
| `accessibilityLabel`                                                                                 | `aria-label`                                                                                                                   |
| `Button`, `Card*`, `Badge`, `Alert`, `Input`, `Label`, `Progress`, `Separator`, `Skeleton`, `Switch` | shadcn/ui of the same name (same variants)                                                                                     |
| `AlertDialog*` + `ConfirmDialog`                                                                     | shadcn `alert-dialog` (Radix) — wrap once as `ConfirmDialog` with the same props                                               |
| `Tabs*`, `SegmentedControl`                                                                          | shadcn `tabs`                                                                                                                  |
| `RadioGroup`, `RadioCard`                                                                            | shadcn `radio-group` (+ a `RadioCard` wrapper)                                                                                 |
| `ToggleGroup*`, `TagPicker`                                                                          | shadcn `toggle-group`                                                                                                          |
| `Stepper`                                                                                            | two `Button size="icon"` around a value, or `input type="number"`                                                              |
| `Icon as={X}`                                                                                        | `lucide-react` (`<X className="size-4" />`)                                                                                    |
| `AllowanceRing` (react-native-svg)                                                                   | inline `<svg>` — `Circle` props are identical (`r`, `strokeDasharray`, …); copy the geometry helpers (`ringFraction`) directly |
| `UIProvider` / `useTheme`                                                                            | `ThemeProvider` toggling the `dark` class; `themes` from `@tbc/tokens` if JS colours are needed                                |

The domain components (`MoneyText`, `SpendRow`, `DayCard`, `WeekStrip`, `CategoryBar`, `StatTile`, `EmptyState`, …) are
composition only: rebuild them on top of the shadcn components, keeping **props, variants, `testID`s and roles**
identical. That contract is what keeps the platforms interchangeable in tests.

### 3.6 Tests: reuse the flows

- **Unit/flow tests:** Vitest + Testing Library (`@testing-library/react`, `user-event`). Copy the F1–F10 steps from
  `packages/screens-native/src/flows.test.tsx` — the assertions (text, roles, numbers) are the same because the numbers
  come from `@tbc/core/testing` fixtures. Use `createTestStore()` and a frozen `today` (`DEMO_TODAY`).
- **E2E:** Playwright, one spec per Maestro flow (`f1-first-run.spec.ts`, …); keep the numbering. Selectors by
  `getByTestId` reuse the ids already checked by `pnpm check:maestro`.
- **Storybook:** `@storybook/react-vite` (+ `addon-a11y` with `test: 'error'`) for `ui-web`; stories mirror the RN stories'
  titles (`Primitives/Button`, `Domain/AllowanceRing`, `Flows/User journeys`), and compose it into the RN Storybook with
  `refs: { web: { title: 'Web', url: '…' } }` so reviewers can flip between platforms in one UI.

### 3.7 CI/CD additions

Copy the RN jobs, then add path filters so unrelated changes don't run everything:

```yaml
# .github/workflows/ci.yml — extra job
web:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v7
    - uses: pnpm/action-setup@v6
    - uses: actions/setup-node@v7
      with: { node-version-file: .nvmrc, cache: pnpm }
    - run: pnpm install --frozen-lockfile
    - run: pnpm turbo run typecheck lint test build --filter=@tbc/web... # "..." = its workspace deps too
    - run: pnpm --filter @tbc/web exec playwright install --with-deps chromium
    - run: pnpm --filter @tbc/web e2e
```

- The existing `tokens-autofix.yml` already says the web consumes `generated/`; after the web app exists, add its
  `build` to the required checks so a token change is verified against **both** platforms in the same PR.
- Deploy: static output (`vite build`) to GitHub Pages / Cloudflare Pages / Netlify / Vercel; copy `storybook-deploy.yml`
  for the web Storybook.
- Installable on a phone: add a web manifest + service worker (`vite-plugin-pwa`) to get an "Add to home screen" PWA. Note
  the Android **home-screen widgets** (hero feature) are native-only; the web app cannot provide them.

### 3.8 Keeping the two component sets in sync

Tokens are automatic; components are a **parity contract**:

1. **Same names, props, variants, testIDs, roles** (table in `DESIGN_SYSTEM.md` §2 is the checklist).
2. A tiny script (recommended, ~30 lines) compares the exported component names and CVA variant keys of `ui-native` and
   `ui-web` and fails CI on a mismatch; add it next to `scripts/check-maestro-ids.mjs`.
3. Definition of done for a component change: RN story + test ✔, web story + test ✔, flow tests still green.
4. This is exactly the repetitive port a **Claude skill** is good at: input = a diff in `packages/ui-native/src/**`,
   output = the mirrored change in `packages/ui-web/src/**` plus the story and test. The table in §3.5 is its knowledge base.

## 4 · Approach B in ten minutes (Expo web)

```bash
pnpm --filter @tbc/mobile add react-dom react-native-web @expo/metro-runtime
pnpm --filter @tbc/mobile exec expo export --platform web      # static site in apps/mobile/dist
```

`app.json` already sets `web.bundler: "metro"` and `web.output: "single"`. NativeWind and the tokens work on the web
target the same way they do in Storybook (className → CSS via react-native-web; `tokens.native.css` variables). Caveats:
run the F1–F10 story tests first (they exercise exactly this rendering path), expect to tune desktop layouts (the screens
are phone-shaped), and use `aria-*` props rather than `accessibilityState` (already done). Persistence uses AsyncStorage's
web shim (localStorage).

## 5 · Approach C (Solito) in one paragraph

Add `apps/next` (Next.js) beside `apps/mobile`, move screens to a `packages/app` that use Solito's `Link`/`useRouter`
abstractions, and render the RN components on Next through react-native-web (NativeWind supports Next). It buys shared
navigation and SSR at the cost of significant plumbing; only worth it if you need SEO pages or want a single screen
codebase. `@tbc/core` and `@tbc/tokens` need no change.

## What was verified

In the authoring sandbox, outside the repo, a scratch Vite 7 + React 19.2 app was built twice:

| Check                                                                                                                        | Tailwind 3.4.19 + `tailwind-preset` + `tokens.css` | Tailwind 4 + `tokens.tw4.css` |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------- |
| `vite build` succeeds, `tsc --noEmit` clean                                                                                  | ✔                                                  | ✔                             |
| `bg-primary` → `hsl(var(--primary) …)`; `rounded-lg` = 12 px; `h-13` = 52 px                                                 | ✔                                                  | ✔                             |
| `:root` and `.dark` variables present in the bundle                                                                          | ✔                                                  | ✔                             |
| shadcn-style `Button` (CVA + `cn` + Radix `Slot`) and Radix `AlertDialog` compile and bundle using the same semantic classes | ✔                                                  | ✔                             |
| `@tbc/core` imported directly (`computeTripPlan`, `formatMoney`) from TS source through a workspace-style link               | ✔                                                  | ✔                             |

The spike was built, not opened in a browser. Not built or run at all: the shadcn CLI itself (`init`/`add`, network +
interactive), the Expo web export of §4, the full screen port, Playwright and the web Storybook. Those are the work items
of this guide; §4's commands are the standard Expo web setup and should be treated as unverified here.
