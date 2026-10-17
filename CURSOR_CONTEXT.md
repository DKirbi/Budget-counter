# CURSOR_CONTEXT.md — Budget Counter (trip budget app) · full project context

> **How to use this file.** Drop the whole `trip-budget/` folder into Cursor. This file is the single briefing for the
> agent: what was asked, what was built, how it is wired, what was verified, what was _not_, and where to look next.
> It is written to be read top-to-bottom once and then searched. If you want Cursor to load it automatically, rename it
> to `AGENTS.md` (repo root) or copy it into `.cursor/rules/project.mdc` with `alwaysApply: true`.
>
> Trust order when things disagree: **the code and tests → `docs/*.md` → this file.** Run the commands in §3 before
> believing any claim in here (§11 says which claims were verified and which were not).

---

## 0 · TL;DR

- **What it is:** _Budget Counter_ (working title; repo name `Budget-counter`, project "Trip Budget Counter") — a trip
  budgeting app. A total trip budget is split into one **daily allowance**; unspent money **carries over**; overspend is
  **deducted from the next day** (`cascade`, default) or **spread over the remaining days** (`redistribute`).
- **What exists now:** a first edition / MVP as a **pnpm + Turborepo monorepo**: an **Expo (React Native)
  app**, a **shared platform-free domain package**, a **design-token pipeline**, a **shadcn/Radix-based RN design system**,
  a **Storybook** that documents every component and user flow, **tests for every flow**, and **GitHub Actions
  pipelines**. Two feature layers: the **core loop** (daily allowances, F1–F10) and **bill scanning** (F11–F15, see
  `docs/RECEIPT_SCANNING.md`): on-device OCR → JSON digital bill → budgeted in the background → timeline by printed date,
  odd bills ask, optional AI fallback with a user-supplied key. The **React web app is deliberately a guide**
  (`docs/WEB_BUILD_GUIDE.md`, which also answers "same repo or new repo?" → same repo), not code.
- **Owner's goal:** a personal **portfolio** project (React + React Native), component-driven, kept simple, well
  documented (JSDoc on every exported component/function), using libraries such as zustand.
- **State of truth:** all Jest suites, lint, typecheck, Storybook build + 133 interaction/a11y tests, an Android JS
  bundle export and `expo prebuild` (Android + iOS) were run and pass in the build sandbox. **APK build, a real camera/ML
  Kit read, emulator/Maestro run, EAS, Chromatic and GitHub Actions execution were not possible there** (§11).

---

## 1 · The original brief (verbatim intent) and decisions

The owner asked, using an earlier "smart trip budgeting app with daily tracking" conversation as context:

1. Create a **first edition (MVP)** in **React Native and React**.
2. Create a **design system of the components used** and a **design-token system** mainly for editing SCSS/other styles
   that could also drive React Native.
3. **Explore ways to test the RN app on a phone** (.apk or another standard).
4. Create **all pipelines** so that changing the design system updates components in both systems (RN and React may be
   separate packages; "skills later on" will help keep both updated).
5. A **nicely written Storybook**.
6. **Use shadcn or Radix as the base** for components — don't invent new ones.
7. **Explore NativeWind** as a Tailwind alternative and **map the tokens** there.
8. **Tests for all flows**, recreated in Storybook as documentation.
9. **Code documentation** above function blocks/components; **component-driven development**; **keep it simple**;
   use libraries like **zustand**.
10. **Split the work**: RN first, then an **.md instruction file on how to build the React site** (unless other tools
    provide the CI/CD or architecture).

Clarifying answers given: web scope = **"RN complete + web build guide"**; MVP scope = **"Core loop"**.

Product context carried over from the earlier conversation/memory: daily allowance model; manual spend logging first;
**Android home-screen widgets (2×2 and 4×2) are the hero feature (not built; `WidgetPreview` defines the data
contract)**; **splittable card payments with tags**; working name "Budget Counter". Repo the owner uses:
`https://github.com/DKirbi/Budget-counter` (nothing here was committed or pushed there — this folder is not a git repo).

---

## 2 · Repository map

```
trip-budget/
├─ package.json, pnpm-workspace.yaml, .npmrc (node-linker=hoisted), turbo.json, tsconfig.base.json, .nvmrc (22)
├─ eslint.config.mjs        ESLint 9 flat config + eslint-plugin-jsdoc (require-jsdoc on packages/*/src + apps/mobile/src)
├─ scripts/check-maestro-ids.mjs   static guard: every Maestro `id:` must exist as a testID in source
├─ packages/
│  ├─ tokens/          DTCG JSON → Style Dictionary 5 → generated/ (CSS, native CSS, TW4 CSS, SCSS, Tailwind preset, theme.ts, tokens.json)
│  ├─ core/            platform-free domain: money, dates, allowance engine, summary, forms (zod), receipts/ (OCR rows → parse → categorise → odd-bill checks → pipeline, AI client, ScanServices ports + fakes), zustand store, React hooks, demo data, test fixtures
│  ├─ ui-native/       RN design system: shadcn-style primitives (rn-primitives + NativeWind + CVA) + domain components + theme provider + jest preset + tailwind/babel factories
│  └─ screens-native/  the 10 screens (+ BillsSettingsCard) + MiniApp (router-free shell used by flow tests & Storybook) + flow tests/stories
├─ apps/
│  ├─ mobile/          Expo app: expo-router routes (thin adapters), providers, store, native scan adapters (src/scan), Jest tests, Maestro flows, EAS config
│  └─ storybook/       Storybook 10 (react-native-web + Vite): Foundations MDX, all stories, test-runner + axe
├─ docs/               ARCHITECTURE · RECEIPT_SCANNING · DESIGN_SYSTEM · TESTING · TESTING_ON_PHONE · WEB_BUILD_GUIDE (+ img/)
└─ .github/            workflows (ci, storybook-deploy, android-apk, e2e-android, eas-build, tokens-autofix, chromatic) + dependabot.yml
```

Size: ~175 TS/TSX files, 22 Jest test files, 36 `*.stories.tsx`. Dependency direction:
`tokens → ui-native → screens-native → apps/mobile`, `core → ui-native / screens-native`, everything → `apps/storybook`.
TypeScript **sources are consumed directly** across packages (no build step); only `@tbc/tokens` has a build
(`turbo` `dependsOn: ["^build"]`).

### Package names and public entry points

| Package               | Entry points                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `@tbc/tokens`         | `.` / `./theme` (typed `theme.ts`), `./css`, `./css/native`, `./css/tailwind4`, `./scss`, `./tailwind-preset`, `./json`           |
| `@tbc/core`           | `.` (domain + store + receipts), `./react` (Provider + hooks), `./testing` (fixtures, `createFakeScanServices`, receipt fixtures) |
| `@tbc/ui-native`      | `.`, `./tailwind` (config factory), `./babel`, `./jest` (preset), `./global.css`, `./testing`, `./testing-core`, `./storybook`    |
| `@tbc/screens-native` | `.` (screens, `ScanServicesProvider`), `./testing` (`renderWithStore({ services })`)                                              |
| `@tbc/mobile`         | Expo app (`main: expo-router/entry`) — app id `app.budgetcounter.mobile`, scheme `budgetcounter`                                  |
| `@tbc/storybook`      | scripts only                                                                                                                      |

---

## 3 · Commands (run these first)

```bash
# Node 22+, pnpm 10 (corepack enable).
pnpm install
pnpm tokens:check            # generated tokens up to date?           (drift guard)
pnpm check:maestro           # 86 Maestro selectors resolve to testIDs
pnpm lint                    # or: npx eslint .
pnpm typecheck
pnpm test                    # tokens(58) core(379) ui-native(63) screens-native(65) mobile(25)
pnpm build-storybook && pnpm --filter @tbc/storybook test:ci   # 36 suites / 133 story tests incl. axe
pnpm --filter @tbc/mobile export:check                         # Metro bundles the Android app (Hermes .hbc)

pnpm start                   # Expo dev server → Expo Go QR / emulator
pnpm storybook               # http://localhost:6006
pnpm tokens                  # regenerate design tokens after editing packages/tokens/src
pnpm test-storybook          # story tests against a running dev Storybook
pnpm --filter @tbc/mobile e2e            # Maestro flows against an installed build
pnpm --filter @tbc/mobile build:apk:release   # local APK (needs JDK 17 + Android SDK)
pnpm format                  # prettier --write .
```

`pnpm test` intentionally does **not** run Storybook tests (they need a built/running Storybook); use `test:ci` /
`test-storybook`.

---

## 4 · Tech stack and versions (as installed)

| Area          | Choice                                                                                                                                                                                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tooling       | Node 22, **pnpm 10.28** (hoisted linker — required for Expo/Metro in a monorepo), **Turborepo 2**, TypeScript ~5.9, ESLint 9 flat + jsdoc + react-hooks v7, Prettier 3                                                                                                                         |
| Mobile        | **Expo SDK 57**, React Native **0.86.3**, React **19.2.3**, **expo-router ~57**, Reanimated 4.5 (+ worklets 0.10), Gesture Handler ~2.32, Screens ~4.26, Safe-Area ~5.7, react-native-svg 15.15, AsyncStorage 2.2, expo-dev-client ~57.0.19                                                    |
| Styling       | **NativeWind 4.2.x + Tailwind 3.4.19** (stable line). `tokens.tw4.css` is emitted for **NativeWind 5 / Uniwind / Tailwind 4**                                                                                                                                                                  |
| Components    | **shadcn/ui pattern** via **rn-primitives** (`@rn-primitives/*` ^1.5: alert-dialog, label, portal, progress, radio-group, slot, switch, tabs, toggle-group) + **CVA** + tailwind-merge + clsx + **lucide-react-native**; structure follows _react-native-reusables_ (MIT) — credited in README |
| State / forms | **zustand 5** (vanilla store + `persist`), **zod 4**, react-hook-form 7 (screens, with a small zod resolver in `screens-native/src/lib/resolver.ts`)                                                                                                                                           |
| Tokens        | W3C **DTCG JSON** → **Style Dictionary 5**; sass for tests                                                                                                                                                                                                                                     |
| Docs          | **Storybook 10.6** (`@storybook/react-native-web-vite`, addon-docs, addon-a11y with `test: 'error'`), Vite 7.3, react-native-web 0.21.3                                                                                                                                                        |
| Tests         | Jest 29 + jest-expo + **RNTL 13.3.3** (v14 was tried and rejected, see §10), `expo-router/testing-library`, `@storybook/test-runner` 0.24 + Playwright 1.56, **Maestro** YAML, `node --test` for tokens                                                                                        |

---

## 5 · Domain model and rules (`@tbc/core`)

**Concepts**

- `Trip { id, name, currency, totalBudget (minor units), startDate, endDate (ISO, inclusive), overspendPolicy: 'cascade' | 'redistribute', createdAt }`
- `Spend { id, tripId, date, amount (minor units), tag, note?, splitGroupId?, createdAt }`
- `SpendTag = 'food' | 'groceries' | 'transport' | 'stay' | 'activities' | 'shopping' | 'other'`
- `Settings { theme, autoConfirmReceipts, ai: { provider: 'none'|'gemini'|'openai', model, baseUrl, dailyLimit }, aiUsage: { date, count } }`;
  persisted `BudgetData { trips, spends, receipts, merchantRules, activeTripId, settings }` (the AI **key** is never in the
  store — secure storage under `tbc.ai.apiKey`)
- `Receipt { id, tripId, status: needs-attention|budgeted|archived, data: ReceiptData, date, tag, rawText, imageUri?, acknowledged[], … }`;
  `ReceiptData` = the bill JSON (schema v1, minor units) — details in `docs/RECEIPT_SCANNING.md`. `Spend.receiptId?` links a spend back.
- `DayPlan { date, index, phase: past|today|future, planned, base, carryIn, available, spent, remaining, status }`,
  `DayStatus = planned | on-track | near-limit | over` (`NEAR_LIMIT_RATIO = 0.15`)
- `TripPlan` / `TripSummary` are derived; `computeTripPlan(trip, spends, today)` and `computeTripSummary(plan, spends)` are **pure**.

**Rules that must not be broken**

1. **Money is an integer of minor units** (`Minor`). No floats anywhere in the domain. `splitEvenly(total, parts)` gives
   the remainder to the earliest shares (100 over 3 → `[34, 33, 33]`) so daily allowances always sum to the budget.
2. **Nothing derived is stored.** Balances/plans are recomputed from `(trip, spends, today)` on every read → edits and
   deletes can never leave stale carry-over.
3. **Dates are ISO strings** (`YYYY-MM-DD`); `today` is injected (`useToday()` follows midnight unless frozen) — tests
   use `DEMO_TODAY = '2026-05-03'`.
4. **Cascade:** a negative balance is deducted from the very next day and keeps rolling until absorbed. **Redistribute:**
   overspend is spread evenly over _all remaining days_ by lowering their base allowance; surplus still carries forward.
5. **Split payments:** one card payment → several `Spend`s sharing a `splitGroupId`, each with its own tag (`SplitPart`
   / `SplitSpendInput`). Parts must add up to the total (F6).
6. **Store:** `createBudgetStore({ storage, name?, now?, createId?, initial? })` returns a vanilla zustand store with
   `persist` (**versioned**: `STORE_VERSION = 2`, `migrate()` hook adds receipts/rules/AI settings to v1 data). Actions
   live under `state.actions` (stable identity): `createTrip, updateTrip, deleteTrip, setActiveTrip, logSpend (parts[]),
updateSpend, removeSpend, setTheme, reset`, plus the receipt actions (`saveReceipt, budgetReceipt, unbudgetReceipt,
updateReceipt, deleteReceipt, setMerchantRule, removeMerchantRule, setAutoConfirmReceipts, setAiSettings,
recordAiUse`; an `updateReceipt` patch may carry `replaceData` to swap the whole bill JSON).
   Storage is **injected** (`AsyncStorage` on RN, `localStorage` on web, `createMemoryStorage()` in tests/stories).
   Domain errors are `BudgetError` with a code.
7. **Forms:** `validateTripForm` / `validateSpendForm` take raw strings and return `{ ok: true, value }` (minor units) or
   `{ ok: false, errors: Record<field, message> }` — all errors at once (F2).
8. **React bindings** (`@tbc/core/react`): `BudgetProvider`, `useBudget(selector)`, `useBudgetActions`, `useToday`,
   `useActiveTrip`, `useTripSpends`, `useDaySpends`, `useActivePlan`, `useActiveSummary`, `useHydrated`
   (via `useSyncExternalStore(onFinishHydration, hasHydrated, () => true)`).
9. **Currencies:** static ISO-4217 table with `decimals` (EUR, USD, GBP, CHF, CZK, PLN, …); `formatMoney` is currency-aware.
10. User-facing wording lives in `screens-native/src/lib/copy.ts` and `messages.ts` (pure, unit-tested; i18n-ready).
11. **Receipts:** device access only through `ScanServices {ocr, picker, images, secrets, fetch?}`; issues are derived by
    the pure `analyzeReceipt`, never stored; a bill with an unresolved `decision` issue is never counted; AI is never
    automatic (per-use consent, local daily cap, usage counted only on success); AI output is zod-validated and re-checked.

---

## 6 · The app (`apps/mobile`)

```
app/
  _layout.tsx        providers + Stack (modals: trip/new, spend/new, spend/[id]; scan; receipt/[id]); imports ../global.css
  (tabs)/            index (Today) · days · bills · summary · settings
  scan.tsx           scan bills (camera / library / type in)
  receipt/[id].tsx   review a bill
  day/[date].tsx     a single day
  trip/new.tsx       create trip
  spend/new.tsx      log a spend (?date=YYYY-MM-DD); splitting is a mode inside the form
  spend/[id].tsx     edit / delete
src/providers.tsx    store → hydration gate (keeps splash up) → ScanServicesProvider → UIProvider (theme, safe area, portal)
src/store.ts         appStore = createBudgetStore({ storage: AsyncStorage })
src/scan/            native-services.ts (adapter logic over port interfaces, unit-tested) · device.ts (lazy requires of expo-mlkit-ocr, image-picker, image-manipulator, file-system, secure-store)
```

- Routes contain **no business logic**: each is `<XScreen …callbacks />` with `router.push/back` wired in. Screens are
  "props in, callbacks out" so flows can be tested **without the router** (`MiniApp`) and routing is tested separately
  (`__tests__/navigation.test.tsx`; adapters in `__tests__/native-services.test.ts`; 25 mobile tests).
- Screens: `TodayScreen` (allowance ring, week strip, today's spends, engine explanation alert), `DaysScreen`,
  `DayScreen`, `LogSpendScreen` (add/edit, split mode, live preview of the effect), `CreateTripScreen`,
  `SummaryScreen` (totals, pace, category breakdown, highlights, projection warning), `SettingsScreen` (theme, trips,
  demo data, delete, erase all, **Bills & AI** card), `BillsScreen` (inbox, timeline by printed date, archive),
  `ScanScreen` (camera / multi-select library / type in; live result rows), `ReceiptReviewScreen` (issue cards, edit,
  AI card, split, save/archive/delete).
- `app.json` native plugins for scanning: `expo-mlkit-ocr` (`iosEngine: auto`), `expo-build-properties`
  (`ios.deploymentTarget: 16.4` — SDK 57's plugin rejects lower — and `useFrameworks: static`), `expo-image-picker`
  (permission strings), `expo-secure-store`. **OCR works only in a development build, not Expo Go.**
- `app.json`: name "Budget Counter", slug `budget-counter`, scheme `budgetcounter`, package/bundle id
  `app.budgetcounter.mobile`, portrait, automatic UI style, splash with light/dark colours. **Icons/splash in
  `assets/` are simple placeholders — replace before any release.**
- `eas.json` profiles: `development` (dev-client APK), `preview` (APK, internal), `production` (AAB, auto-increment).
- Metro: `withNativeWind(config, { input: './global.css', inlineRem: 16 })`. `global.css` imports
  `@tbc/tokens/generated/tokens.native.css` (path form on purpose — PostCSS import resolution ignores package `exports`).

---

## 7 · Design tokens and the design system

Full detail: `docs/DESIGN_SYSTEM.md`. Essentials:

- **Source of truth:** `packages/tokens/src/{core,semantic,component}/*.json` (W3C DTCG). Core = palette (stone, teal,
  red, amber, emerald, sky, orange, lime, violet, pink), spacing (4 px), radius, typography, shadow, motion. Semantic =
  shadcn vocabulary (`background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`,
  `destructive`, `border`, `input`, `ring` + `*-foreground`) plus **`success`, `warning`, `info`** and seven category
  colours **`tag-food … tag-other`**. Light and dark must define identical keys (tested). Component tokens: 44 px touch
  target, control heights, icon sizes.
- **Generated outputs** (`packages/tokens/generated`, committed, guarded by `tokens:check`): `tokens.css` (web
  `:root` / `.dark`, HSL triplets), `tokens.native.css` (`.dark:root`, NativeWind v4), `tokens.tw4.css` (Tailwind 4 /
  NativeWind 5 / Uniwind, `@theme inline`), `tokens.scss` (vars, `$semantic-light/-dark` maps, mixins `theme-light`,
  `theme-dark`, `root`, functions `semantic()`, `space()`, `radius()` — use with `@use 'pkg:@tbc/tokens/scss'`),
  `tailwind.preset.cjs` (Tailwind 3 preset; **raw palette colours deliberately not exposed**), `theme.ts` (typed, for SVG
  strokes / navigation chrome), `tokens.json` (flat, for docs/Figma tooling).
- **Quality gates:** WCAG contrast tests for ~24 fg/bg pairs in both themes, SCSS compile test, structural tests, drift check.
- **Components** (`@tbc/ui-native`): primitives — Alert, AlertDialog (+`ConfirmDialog`), Badge, Button, Card*, Field, Icon,
  Input, Label, Progress, RadioGroup (+`RadioCard`), Separator, Skeleton, Stepper (the one non-shadcn primitive), Switch,
  Tabs (+`SegmentedControl`), Text (+`TextClassContext`), ToggleGroup. Domain — AllowanceRing, AmountInput, CategoryBar,
  DayCard, EmptyState, MoneyText, SpendRow, StatTile, TagIcon, TagPicker, WeekStrip, WidgetPreview. Layout — `Screen`,
  `ScreenHeader`. Theme — `UIProvider`, `useTheme`.
- **Authoring rules:** compose don't fork; variants with CVA; **semantic classes only** (`bg-destructive`, never
  `bg-red-600`); full class strings (Tailwind's scanner can't see template-built names — use maps like `STATUS_STYLES`,
  `TAG_CLASSES`); `className` last in `cn()`; a11y is API (roles, `aria-*`, ≥44 px targets); JSDoc on every export
  (ESLint-enforced); a story per component (+ `play` when it has behaviour).
- **NativeWind v4 vs v5 (checked 29 Sep 2026):** v5 = `5.0.0-rc.0` (published 13 Sep 2026) with `react-native-css`
  3.1.0-rc.0 and Tailwind 4.1.x; migration guide exists. This repo stays on **stable v4** and keeps v5/Uniwind one
  `pnpm tokens` away. The only v4-specific code: `cssInterop(IconImpl, …)` in `primitives/icon.tsx`, `setColorScheme` in
  `UIProvider`, `nativewind/babel` + Metro wrapper.
- **Proven token propagation:** changing `primary` (teal.700 → violet.700) failed `tokens:check`, regenerated 6 files, all
  58 token tests + Storybook build + 98 story/axe tests passed, and the ring (SVG via `theme.ts`), buttons, selected day
  and tab label all recoloured — then reverted. Before/after screenshots: `docs/img/token-change-*.png`.

---

## 8 · Testing

Full detail + flow matrix: `docs/TESTING.md`. The journeys F1–F10 exist as **Jest**, **Storybook `play`**, and
**Maestro**; the bill-scanning journeys F11–F15 exist as Jest (`screens-native/src/flows.bills.test.tsx`) and Storybook
(`Flows/Bills`) only — Maestro needs a real camera/ML Kit and is a later drop:

| ID  | Journey                                     | Jest (`screens-native/src/flows.test.tsx`) | Storybook `Flows/User journeys` | Maestro (`apps/mobile/.maestro`) |
| --- | ------------------------------------------- | ------------------------------------------ | ------------------------------- | -------------------------------- |
| F0  | boot, tab bar                               | `navigation.test.tsx`                      | —                               | `f0-smoke.yaml`                  |
| F1  | empty → create trip → allowance             | ✔ (2)                                      | F1 First Run                    | `f1-first-run.yaml`              |
| F2  | validation, all errors, then fixed          | ✔                                          | F2 Validation                   | `f2-validation.yaml`             |
| F3  | log a spend, balance updates (+ preview)    | ✔ (3)                                      | F3, F3b                         | `f3-log-spend.yaml`              |
| F4  | overspend cascades into tomorrow            | ✔                                          | F4                              | `f4-overspend-cascade.yaml`      |
| F5  | switch to "spread it out"                   | ✔                                          | F5                              | `f5-spread-it-out.yaml`          |
| F6  | split a card payment (parts must sum)       | ✔ (2)                                      | F6                              | `f6-split-payment.yaml`          |
| F7  | edit / delete with confirmation             | ✔ (2)                                      | F7                              | `f7-edit-delete.yaml`            |
| F8  | other days, day stepper                     | ✔ (2)                                      | F8, F8b                         | `f8-other-days.yaml`             |
| F9  | summary (+ empty, + projection warning)     | ✔ (3)                                      | F9                              | `f9-summary.yaml`                |
| F10 | settings: theme, demo data, delete, erase   | ✔ (3)                                      | F10                             | `f10-settings.yaml`              |
| F11 | evening scan: clean bills file themselves   | ✔ (`flows.bills.test.tsx`)                 | `Flows/Bills` F11               | —                                |
| F12 | odd date asks; answer decides the day       | ✔                                          | F12                             | —                                |
| F13 | outside the trip: other trip / copy         | ✔                                          | F13                             | —                                |
| F14 | unreadable: AI (consent, limits) or by hand | ✔                                          | F14, F14b                       | —                                |
| F15 | Bills tab + Bills & AI settings             | ✔                                          | F15                             | —                                |

Conventions: select by **`testID`** (kebab-case; the contract between app, Jest, Storybook, Maestro — CI guard
`check:maestro`); assert by role/text; deterministic data (`demoPlan()`, `createTestStore()`, `DEMO_TODAY`, demo data is
relative to _today_ for E2E); helpers: `renderUI` (`@tbc/ui-native/testing`), `renderWithStore` (`@tbc/screens-native/testing`),
`@tbc/core/testing` (`makeTrip, makeSpend, demoData, demoPlan, createTestStore, StoryLoaded, DEMO_TODAY`).
Storybook fails on **axe violations** (`parameters.a11y.test = 'error'`).

---

## 9 · CI/CD (`.github/workflows`) — written, YAML-validated, NOT executed

| Workflow               | Trigger                                                                                                   | Does                                                                                                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`               | push / PR                                                                                                 | tokens drift → maestro id guard → lint → typecheck → Jest; Storybook build + 133 tests (Playwright chromium); `expo export` bundle check                              |
| `storybook-deploy.yml` | push to `main`                                                                                            | Storybook → GitHub Pages                                                                                                                                              |
| `android-apk.yml`      | manual / `v*` tag / `workflow_call`                                                                       | `expo prebuild` + `gradlew assembleRelease` (arm64-v8a,x86_64) → artifact `app-release-apk` (+ GitHub Release on tags); debug-keystore signed → internal testing only |
| `e2e-android.yml`      | manual / nightly 03:17 UTC / PR label `e2e`                                                               | reuses the APK workflow, KVM, `android-emulator-runner` (API 34), installs Maestro, runs all flows, uploads JUnit + screenshots                                       |
| `eas-build.yml`        | manual                                                                                                    | EAS build (`preview` / `development` / `production`) + optional OTA update; needs secret `EXPO_TOKEN`                                                                 |
| `tokens-autofix.yml`   | PR touching `packages/tokens/src                                                                          | scripts`                                                                                                                                                              | regenerates `generated/` and pushes the fix to the PR branch |
| `chromatic.yml`        | PR, only if `vars.CHROMATIC_ENABLED`                                                                      | visual regression; needs `CHROMATIC_PROJECT_TOKEN`                                                                                                                    |
| `dependabot.yml`       | weekly npm (grouped: expo-sdk, storybook, lint; Tailwind major bumps ignored on purpose), monthly Actions | dependency PRs                                                                                                                                                        |

Action versions used include `actions/checkout@v7`, `pnpm/action-setup@v6`, `actions/setup-node@v7`,
`actions/upload-artifact@v7` — **re-check that these tags exist when first running**; they were chosen from research, not run.

Phone testing options (details `docs/TESTING_ON_PHONE.md`): Expo Go (QR) → dev-client APK (EAS or `expo run:android`)
→ preview APK (GitHub Actions / EAS / local) + `adb install` → emulator + Maestro in CI → Play Internal Testing /
Firebase App Distribution / TestFlight → device farms (Firebase Test Lab, BrowserStack, AWS Device Farm).

---

## 10 · Gotchas already hit (don't rediscover them)

| Symptom                                                                                                          | Cause → fix                                                                                              |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| expo-router `renderRouter` hangs with RNTL 14                                                                    | RNTL 14 renders asynchronously → **pinned RNTL 13.3.3**                                                  |
| Jest: NativeWind `setColorScheme` throws                                                                         | set css-interop `darkMode` flag in `ui-native/jest/setup.js`                                             |
| `waitFor` timing out after expo-router testing-library                                                           | it installs fake timers → use `waitFor`, not `setTimeout` waits                                          |
| First navigation test > 5 s                                                                                      | cold transform cache → `testTimeout: 120_000` in `apps/mobile/jest.config.cjs`                           |
| `tsc`: `toHavePathname` does not exist                                                                           | expo-router ships the matchers at runtime with an empty `expect.d.ts` → `apps/mobile/jest-matchers.d.ts` |
| Storybook prod build: "exports is not defined"                                                                   | CJS `react-native-css-interop/doctor.js` → tiny Vite plugin stubs it in `.storybook/main.ts`             |
| Storybook: default rnw exclude regex matches by prefix; treat-js-as-jsx compiles every `.js`                     | explicit allow-list for @rn-primitives / lucide / svg / safe-area-context                                |
| `useArgs` errors on re-render; blank first paint                                                                 | `Controlled` helper (`ui-native/src/storybook.tsx`); `UIProvider initialSafeAreaMetrics`                 |
| RN Web 0.21 ignores `accessibilityState/Value` (axe failures)                                                    | use `aria-*` props everywhere                                                                            |
| NativeWind on web                                                                                                | className → `$$css`; Vite needs `jsxImportSource: 'nativewind'`                                          |
| react-hooks v7 lint `set-state-in-effect`                                                                        | `useSyncExternalStore` in `useHydrated`, `Controlled` restructured                                       |
| jsdoc lint: tag-name errors                                                                                      | lines starting with `@tbc/...` in comments are parsed as tags — reword                                   |
| Maestro id guard too loose                                                                                       | requires literal ids; supports `testIDPrefix`; negative test confirmed                                   |
| Act warnings from react-hook-form async validation                                                               | narrow console filter in `screens-native/jest.setup.js` (only CreateTripScreen/LogSpendScreen/MiniApp)   |
| `turbo run test` failed on Storybook                                                                             | its `test` script needs a live server → renamed `test:run`; `test:ci` is the CI entry                    |
| pnpm "Ignored build scripts" warning                                                                             | `ignoredBuiltDependencies` in `pnpm-workspace.yaml` (all four ship prebuilt binaries)                    |
| `pkill -f <pattern>` killed the agent's own shell                                                                | never use `pkill -f` with a pattern that appears in your own command line                                |
| `expo-build-properties` rejects `ios.deploymentTarget: 16.0` (SDK 57) although expo-mlkit-ocr's README says 16.0 | use `16.4`                                                                                               |
| RNTL `toHaveTextContent('x')` is an exact match; `getByRole` only finds `accessible` elements                    | use a regex; assert `props.role` on non-accessible Views                                                 |
| `act()` warnings from async secure-store lookups in settings                                                     | `press` helpers wrap in `act`; `renderWithStore` flushes mount promises                                  |
| Unmounting `ScanScreen` when a receipt is pushed loses the result rows                                           | `MiniApp` keeps it mounted (class `hidden`) under the receipt route                                      |
| Tokens SCSS test hard-coded teal                                                                                 | now derived from `tokens.json`                                                                           |

---

## 11 · What is verified and what is not

**Verified (run in the build sandbox, Linux, Node 22, pnpm 10.28):**
`tokens:check` ✔ · token tests 58/58 ✔ · core 379 ✔ · ui-native 63 ✔ · screens-native 65 ✔ ·
mobile 25 (navigation + native adapters against fakes) ✔ · `eslint .` clean (incl. JSDoc rule) ✔ · typecheck all packages ✔ ·
Storybook production build ✔ · Storybook test-runner 36 suites / 133 tests incl. axe ✔ · `check:maestro` 86 selectors ✔ ·
`expo export --platform android` (Hermes bundle ≈ 7 MB) ✔ · `expo prebuild` Android ✔ and iOS ✔ (config plugins resolve,
permission strings generated) · `prettier --check .` ✔ · clean-room: unzip → `pnpm install --frozen-lockfile` → tokens check +
tests ✔ · token-change propagation demo ✔ · a scratch **web spike** (Vite 7 + React 19 + Tailwind 3.4 _and_ Tailwind 4, shadcn-style
Button + Radix AlertDialog + `@tbc/core`) built and type-checked ✔.

**Not verified — needs real infrastructure. Treat the first run as the test:**

1. Android APK build (`expo prebuild` + Gradle) and installing/running it on a device or emulator.
2. Maestro flows on an emulator (only their selectors were statically checked).
3. Every GitHub Actions workflow _as executed_ (YAML parses; commands inside were run locally where possible).
4. EAS builds/updates, Play/TestFlight, Chromatic, GitHub Pages deploy, Firebase App Distribution.
5. iOS anything beyond `expo prebuild` (no macOS in the sandbox).
   5a. **Real ML Kit text recognition on real paper, the camera/photo-library flow on a device, and a live Gemini/OpenAI call**
   (all covered only by fakes; the AI request shapes follow the providers' public docs, not a recorded exchange).
6. The shadcn CLI (`init`/`add`), Expo web export (§ web guide 4), the full React web app, Playwright web E2E.
7. Visual QA on real devices (fonts, safe areas, keyboard behaviour, dark mode on hardware).

**Not built (by design):** React web app (guide only), Android widgets, cloud sync/accounts, bank import (dropped), Maestro flows for scanning, paid-AI tier/own proxy, re-parse of stored bills after a parser upgrade, i18n
beyond centralised copy, real brand assets, analytics/crash reporting, app-store metadata.

---

## 12 · Web (React) plan — summary of `docs/WEB_BUILD_GUIDE.md`

- Recommended: **separate React app** (`apps/web`, Vite + React 19 + router) using **shadcn/ui on Radix**, sharing
  `@tbc/tokens` and `@tbc/core`; optional `packages/ui-web`. Alternatives: Expo web via react-native-web (fastest,
  least web-native) or Solito/Next (heaviest).
- Wire tokens with either **Tailwind 3.4** (`presets: [require('@tbc/tokens/tailwind-preset')]` + `@import '@tbc/tokens/css'`)
  or **Tailwind 4** (`@import '@tbc/tokens/css/tailwind4'` + `@custom-variant dark`). After `shadcn init`, delete its
  generated colour variables so the token files win (semantic names are identical).
- Reuse the store with `createBudgetStore({ storage: window.localStorage })`; port screens using the RN→web mapping
  table (View→div, Pressable→button, `onPress`→`onClick`, `testID`→`data-testid`, `onChangeText`→`onChange`, …).
- Tests: Vitest + Testing Library re-using F1–F10 steps and `@tbc/core/testing`; Playwright per Maestro flow; web
  Storybook composed into the RN one via `refs`.
- **Sync contract:** tokens are shared automatically; components are per-platform files kept in parity (same names,
  props, variants, testIDs, roles). Suggested CI script: compare exported component names + CVA variant keys of
  `ui-native` vs `ui-web`. A future "port skill" takes a diff in `ui-native` and emits the mirrored `ui-web` change,
  story and test.

---

## 13 · Decisions and alternatives (why things are the way they are)

| Decision     | Chosen                                 | Alternatives                                    | Reason                                                                          |
| ------------ | -------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| Monorepo     | pnpm + Turborepo                       | Nx, Yarn                                        | light, caching, strict deps                                                     |
| Mobile       | Expo SDK 57 + CNG (prebuild)           | bare RN                                         | disposable `android/`, EAS, Expo Go, native widgets still possible via plugins  |
| Routing      | expo-router                            | React Navigation                                | file routes, tested deep links                                                  |
| Styling      | NativeWind 4 / Tailwind 3              | NativeWind 5 RC, Uniwind, Unistyles, StyleSheet | same class names as shadcn → same tokens; stable; migration prepared            |
| Behaviour    | rn-primitives                          | Tamagui, gluestack, hand-rolled                 | "Radix for RN", unstyled, accessible                                            |
| State        | zustand + persist                      | Redux Toolkit, Jotai, MMKV                      | boilerplate-free, works outside React, AsyncStorage keeps Expo Go compatibility |
| Persistence  | AsyncStorage (injected `StateStorage`) | MMKV, SQLite                                    | Expo Go friendly; swap later behind the same interface                          |
| Docs         | Storybook 10 on react-native-web       | on-device Storybook                             | shareable, headless in CI, axe                                                  |
| E2E          | Maestro                                | Detox, Appium                                   | YAML, no instrumentation, both OSes                                             |
| Derived data | never stored                           | cache plan                                      | correctness on edit/delete                                                      |
| Web          | guide, not code                        | ship both now                                   | owner's choice ("RN complete + web build guide")                                |

---

## 14 · Rules for an AI agent working in this repo

1. **Read before changing:** `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, and the module JSDoc in
   `packages/core/src/allowance.ts`.
2. **Tokens:** edit `packages/tokens/src/**` only; run `pnpm tokens`; never hand-edit `generated/`.
3. **Colours/styles:** semantic Tailwind classes only. No hex literals in components (SVG uses `useTheme().colors`).
4. **New UI:** look for the shadcn/Radix equivalent first; add a CVA variant rather than a new component; write the story
   (+ `play`) and the test; keep `testID`s stable and kebab-case; run `pnpm check:maestro`.
5. **Domain changes** go in `@tbc/core` with unit tests first; keep everything pure and integer-minor-unit; bump
   `STORE_VERSION` and add a `migrate()` step when the persisted shape changes.
6. **Every exported component/function gets JSDoc** (ESLint enforces it) with `@example` where non-obvious.
7. **Accessibility:** use `aria-*` props (not `accessibilityState`); ≥44 px touch targets; the Storybook axe run must stay green.
8. **Don't add** localStorage/sessionStorage usage in RN code; don't use `pkill -f`; don't re-add RNTL 14; don't expose raw
   palette colours in the Tailwind preset.
9. Before finishing any change: `pnpm tokens:check && pnpm check:maestro && npx eslint . && pnpm typecheck && pnpm test`
   (+ Storybook build and `test:ci` for UI changes).
10. Keep RN and web component contracts in sync (§12); note any intentional divergence in `docs/`.

---

## 15 · Open items and suggested next steps

**Quick wins**

- Replace placeholder icons/splash; pick a real name (change `APP_NAME` in `@tbc/core` + `app.json` + bundle id).
- Add `argTypes` descriptions to `Button` (and other) stories; CODEOWNERS / PR template.
- Add the ui-native ↔ ui-web parity script once the web app exists.
- The code is pushed to `DKirbi/Budget-counter`; enable Pages; add `EXPO_TOKEN`; run **Android APK** and
  **E2E · Android** workflows and fix whatever the first real run reveals.
- Build a development build, scan 20+ real bills from the countries you travel to, and feed the failures back as fixtures
  in `packages/core/src/receipts/fixtures.ts` (the parser's accuracy is only as good as that corpus).

**Product**

- **Android widgets 2×2 / 4×2** (hero feature): config plugin or `react-native-android-widget`, reading the persisted
  store snapshot; requires a dev build (not Expo Go). `WidgetPreview` is the contract.
- Web app per the guide; PWA "add to home screen" as a stop-gap.
- Cloud sync (sync middleware or repository interface), multi-currency/FX (bills in another currency currently ask for the converted amount), notifications.
- Bill scanning next steps: Maestro flows (needs emulator camera injection), re-parse stored `rawText` after parser upgrades,
  paid AI tier behind an own proxy (`ScanServices.fetch` + `AiSettings.baseUrl`), on-device LLM, web adapters for the ports.
- Migrate to NativeWind 5 / Uniwind once stable (checklist in `docs/DESIGN_SYSTEM.md` §4).
- Figma ↔ tokens loop (Tokens Studio → PR → `tokens-autofix`).

**Good questions for Cursor to investigate**

- Are there any accessibility gaps outside what axe can see on the web (TalkBack/VoiceOver semantics on `Stepper`,
  `WeekStrip`, `AllowanceRing`)?
- Which of the `@rn-primitives/*` behaviours differ on Android/iOS vs react-native-web, and are they covered by Maestro?
- Is the persisted-store migration path exercised (write a v0→v1 test)? What happens on a corrupted `persist` payload?
- Time-zone/DST and midnight-rollover edge cases in `useToday()` and `eachDay`/`diffDays` (trips crossing DST changes,
  device time-zone change mid-trip).
- Performance of `computeTripPlan` on long trips with thousands of spends (memoisation boundaries in the hooks).
- Bundle size / startup time (Hermes bundle ≈ 7 MB export; lucide icon imports; Reanimated usage).
- Is `react-hook-form` worth keeping given `@tbc/core/forms` already validates? (It is used only in the two form screens.)

---

## 16 · Suggested prompts to start with in Cursor

- _"Read CURSOR_CONTEXT.md and docs/ARCHITECTURE.md, then run the checks in §3 and tell me what fails on your machine."_
- _"Walk through flow F6 (split payment) across `flows.test.tsx`, the `F6_SplitPayment` story and `f6-split-payment.yaml`
  and list any step that is asserted in one layer but not the others."_
- _"Audit `packages/ui-native/src/primitives` against the shadcn/ui source for Button, Card, Badge, Alert, Tabs and
  list API/variant differences."_
- _"Plan the Android widget feature: data contract from `WidgetPreview`, how to read the persisted store from native
  code, and what changes in eas.json / app.json."_
- _"Scaffold `apps/web` following docs/WEB_BUILD_GUIDE.md §3.1–3.4 and port F1–F3 with Vitest."_
- _"Read docs/RECEIPT_SCANNING.md, then take the fixtures in `receipts/fixtures.ts` and try to break `parseReceipt` with
  realistic variations (thousand separators, two dates, no total label, mixed languages). Add failing tests first."_
- _"Review `.github/workflows` for anything that will fail on the first GitHub run (action versions, runner images,
  permissions, secrets)."_

---

## 17 · Where things are (quick index)

| I want to…                     | Look at                                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| understand the allowance maths | `packages/core/src/allowance.ts`, `allowance.test.ts`, `summary.ts`                                              |
| see the store                  | `packages/core/src/store/budgetStore.ts`, `selectors.ts`, `storage.ts`, `react.tsx`                              |
| change a colour/radius/font    | `packages/tokens/src/**` then `pnpm tokens`                                                                      |
| add/modify a component         | `packages/ui-native/src/primitives                                                                               | domain/_`+`_.stories.tsx` + tests |
| edit a screen                  | `packages/screens-native/src/screens/*`                                                                          |
| change how a bill is read      | `packages/core/src/receipts/{parse,locale,printedDates,amounts}.ts` (+ fixtures and tests)                       |
| change the odd-bill rules      | `packages/core/src/receipts/analyze.ts`, `pipeline.ts`                                                           |
| change the AI fallback         | `packages/core/src/receipts/ai.ts`, `screens-native/src/screens/{ReceiptReviewScreen,BillsSettingsCard}.tsx`     |
| change what the phone does     | `apps/mobile/src/scan/{native-services,device}.ts`, `apps/mobile/app.json` plugins                               |
| edit routing                   | `apps/mobile/app/**`                                                                                             |
| add a flow test                | `packages/screens-native/src/flows.test.tsx`, `flows.stories.tsx`, `apps/mobile/.maestro/`                       |
| tweak Storybook                | `apps/storybook/.storybook/{main.ts,preview.tsx,storybook.css}`, `stories/`                                      |
| tweak CI                       | `.github/workflows/*`                                                                                            |
| Jest config                    | `packages/ui-native/jest/{preset.cjs,setup.js}`, `apps/mobile/jest.*`, `packages/screens-native/jest.*`          |
| Tailwind/NativeWind config     | `packages/ui-native/tailwind.cjs`, `apps/mobile/{tailwind.config.js,metro.config.js,babel.config.js,global.css}` |
| test on a phone                | `docs/TESTING_ON_PHONE.md`, `apps/mobile/.maestro/README.md`                                                     |
| build the web app              | `docs/WEB_BUILD_GUIDE.md`                                                                                        |

_Generated at the end of the first build session (29 Sep 2026). Counts and versions above reflect that moment._
