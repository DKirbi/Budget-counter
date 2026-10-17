# Testing strategy

Every user flow is tested **up to three ways** — as a Jest test (fast, runs on every commit), as a Storybook story with a
`play` function (living documentation you can watch and click), and as a Maestro YAML flow (the real app on a real
Android/iOS runtime). The flows share numbering (F1–F15), so you can go from a failing E2E to the story that documents
it to the unit test that pins it in seconds. F1–F10 have all three; the bill-scanning flows F11–F15 have Jest and
Storybook (Maestro needs a real camera and the native OCR module, so it is a later drop).

```
            fast ◄──────────────────────────────────────────────► realistic
   ┌─────────────┐   ┌──────────────────┐   ┌─────────────────┐   ┌────────────────┐
   │ unit (core) │   │ component + flow │   │ Storybook play  │   │ Maestro E2E    │
   │ ts-jest     │   │ jest-expo + RNTL │   │ + axe a11y      │   │ emulator/phone │
   └─────────────┘   └──────────────────┘   └─────────────────┘   └────────────────┘
        379              63 + 65 + 25            133                  11 flows
```

## The pyramid

| Layer              | What it proves                                                                                                                    | Tooling                               | Where                                           | Run it                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------- | ------------------------------------------------------ |
| **Tokens**         | DTCG source compiles, references resolve, generated files are not stale, colour pairs meet WCAG contrast                          | `node --test`                         | `packages/tokens/test`                          | `pnpm --filter @tbc/tokens test` · `pnpm tokens:check` |
| **Domain (core)**  | Money maths, allowance engine, dates, forms, store, demo data, **receipt parser / categoriser / odd-bill checks / AI client**     | Jest + ts-jest                        | `packages/core/src/*.test.ts`                   | `pnpm --filter @tbc/core test`                         |
| **Components**     | Each primitive / domain component: roles, states, variants, a11y semantics                                                        | jest-expo + RNTL 13                   | `packages/ui-native/src/**/*.test.tsx`          | `pnpm --filter @tbc/ui-native test`                    |
| **Flows (F1–F15)** | Whole journeys through real screens + real store, router-free (`MiniApp`); scan flows use fake OCR / picker / AI                  | jest-expo + RNTL 13                   | `packages/screens-native/src/flows*.test.tsx`   | `pnpm --filter @tbc/screens-native test`               |
| **Navigation**     | expo-router wiring: modals, params, deep links, not-found, persistence, Bills tab, scan and receipt routes                        | expo-router/testing-library           | `apps/mobile/__tests__/navigation.test.tsx`     | `pnpm --filter @tbc/mobile test`                       |
| **Phone adapters** | The OCR / picker / image / secret-store adapters against fake native modules (line mapping, JPEG re-encode sizes, cancel, errors) | Jest + ts-jest-style fakes            | `apps/mobile/__tests__/native-services.test.ts` | `pnpm --filter @tbc/mobile test`                       |
| **Storybook**      | Every story renders; every `play` function passes; **axe a11y violations fail the build**                                         | `@storybook/test-runner` + Playwright | `*.stories.tsx`                                 | `pnpm --filter @tbc/storybook test:build`              |
| **E2E**            | The shipped binary works on Android (and iOS)                                                                                     | Maestro                               | `apps/mobile/.maestro`                          | `pnpm --filter @tbc/mobile e2e`                        |
| **Static guard**   | Every `id:` used by a Maestro flow exists as a `testID` in source (catches drift without an emulator)                             | `scripts/check-maestro-ids.mjs`       | repo root                                       | `pnpm check:maestro`                                   |

## Flow matrix

| ID  | Journey                                                                       | Jest (`flows.test.tsx`)                          | Storybook (`Flows / User journeys`)             | Maestro (`.maestro/`)       |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------- | --------------------------- |
| F0  | App boots, tab bar navigates                                                  | `navigation.test.tsx` › _shows the empty state…_ | — (covered by every story)                      | `f0-smoke.yaml`             |
| F1  | Empty state → create a trip → see today's allowance                           | _F1 · First run_ (2 tests)                       | **F1 First Run**                                | `f1-first-run.yaml`         |
| F2  | Validation: all errors at once, then fixed                                    | _F2 · Validation_                                | **F2 Validation**                               | `f2-validation.yaml`        |
| F3  | Log a spend → balance and ring update immediately                             | _F3 · Log a spend_ (3 tests)                     | **F3 Log Spend**, **F3b Preview Before Saving** | `f3-log-spend.yaml`         |
| F4  | Overspend turns Today red and lowers tomorrow (cascade)                       | _F4 · Overspend cascades_                        | **F4 Overspend Cascades**                       | `f4-overspend-cascade.yaml` |
| F5  | Switch rule to "spread it out"                                                | _F5 · Spread it out_                             | **F5 Spread It Out**                            | `f5-spread-it-out.yaml`     |
| F6  | Split a card payment into tagged parts (must sum)                             | _F6 · Split a card payment_ (2 tests)            | **F6 Split Payment**                            | `f6-split-payment.yaml`     |
| F7  | Edit a spend; delete with confirmation                                        | _F7 · Edit and delete_ (2 tests)                 | **F7 Edit And Delete**                          | `f7-edit-delete.yaml`       |
| F8  | Open another day, log a forgotten spend, step days                            | _F8 · Explore days_ (2 tests)                    | **F8 Other Days**, **F8b Day Stepper**          | `f8-other-days.yaml`        |
| F9  | Summary: totals, pace, breakdown, projection warning, empty                   | _F9 · Summary_ (3 tests)                         | **F9 Summary**                                  | `f9-summary.yaml`           |
| F10 | Settings: theme, demo data, switch / delete trips, erase all                  | _F10 · Settings_ (3 tests)                       | **F10 Settings**                                | `f10-settings.yaml`         |
| F11 | Evening scan: clean bills file themselves onto the timeline                   | `flows.bills.test.tsx` › _F11_                   | `Flows / Bills` › **F11**                       | — (needs a device camera)   |
| F12 | Odd date (older / future / ambiguous) asks; answer sets day                   | › _F12_                                          | **F12**                                         | —                           |
| F13 | Bill outside the trip: move to other trip, re-date, or archive                | › _F13_                                          | **F13**                                         | —                           |
| F14 | Unreadable bill: fill in offline, or finish with AI (consent, limits, errors) | › _F14_                                          | **F14**, **F14b**                               | —                           |
| F15 | Bills tab (timeline / inbox / archive) + Bills & AI settings                  | › _F15_                                          | **F15**                                         | —                           |

> **Rule of thumb when adding a flow:** write the Jest test first (red), build until green, then copy the same steps
> into a story (`play`) and a Maestro flow. The three should read almost identically because they all use `testID`s.

## Conventions

### Select by `testID`, assert by role/text

`testID`s are the contract between the app, Jest, Storybook and Maestro. They are set next to the component that owns
the element and use `kebab-case`. The `check:maestro` script fails CI if a Maestro flow references an id that no longer
exists in source.

### Money and dates are deterministic

- Amounts are integer **minor units** (`1250` = 12.50). Tests never touch floats.
- The engine takes `today` as an argument; tests pass a fixed ISO date. Demo data (`demoPlan()`, `createDemoTrip`) is
  generated _relative to today_ so E2E numbers are stable on any calendar day.

### Test providers

`renderUI()` from `@tbc/ui-native/testing` wraps a component in theme + safe-area + portal providers.
`renderWithStore()` from `@tbc/screens-native/testing` adds a seeded zustand store on top. `@tbc/core/testing` exposes
fixtures (`makeTrip`, `makeSpend`, `demoData`, `demoPlan`, `createTestStore`, `StoryLoaded`, `DEMO_TODAY`) that both
Jest and Storybook reuse, so a story and its unit test cannot diverge.

### Storybook as executable documentation

- **Component stories** (`Primitives/*`, `Domain/*`) have `args`/`argTypes` for the Controls panel and JSDoc-derived
  descriptions on the Docs tab.
- **Flow stories** (`Flows / User journeys`) run a `play` function using `@storybook/test` (`userEvent`, `within`,
  `expect`) against a real store; open the Interactions panel to step through them.
- **Scan stories** take a `parameters.scan` object (`FakeScanOptions`: scripted OCR text per photo, AI replies, failures)
  so a story can show "unreadable bill → AI offered → error" without any network or native module.
- **Accessibility** — `parameters.a11y.test = 'error'` in `.storybook/preview.tsx`. An axe violation fails
  `test-storybook`. This has already caught (and we fixed) missing `aria-*` mappings on react-native-web.

### Fakes for the scan flow

`@tbc/core/testing` exports `createFakeScanServices(options)` (OCR, picker, image store, secret store, `fetch`) and the
bill fixtures (`RECEIPT_FIXTURES`, `fixtureOcr`, `simpleBillText`). `renderWithStore(ui, { services })` injects them via
`ScanServicesProvider`. Tests script exactly what each photo "reads" and what the AI "answers", so every odd-bill rule
and AI failure mode (`LIMIT_REACHED`, `RATE_LIMITED`, `UNAUTHORIZED`, `MODEL_NOT_FOUND`, `NETWORK`, `BAD_RESPONSE`) is
covered without a camera or an API key. The one thing no test here can prove is **real ML Kit accuracy on real paper** —
that needs a development build and a pile of bills (see [TESTING_ON_PHONE.md](./TESTING_ON_PHONE.md)).

### react-native-web quirk worth knowing

React Native Web 0.21 ignores `accessibilityState` / `accessibilityValue`. Components therefore use the `aria-*` props
(`aria-selected`, `aria-checked`, `aria-valuenow`, …), which RN 0.83+ supports natively too. Do not reintroduce the
old props or the Storybook axe run will flag the component.

## Running everything locally

```bash
pnpm install
pnpm tokens:check && pnpm check:maestro   # seconds
pnpm lint && pnpm typecheck               # ~1 min cold
pnpm test                                 # all Jest suites via Turborepo (cached)
pnpm build-storybook && pnpm --filter @tbc/storybook test:ci   # 133 story tests incl. axe (serves the build itself)
# while `pnpm storybook` is running: pnpm test-storybook               # same tests against the dev server
pnpm --filter @tbc/mobile export:check    # Metro can bundle the Android app
```

`pnpm test` (Turborepo) runs the Jest/`node --test` suites only. The Storybook tests need a built or running Storybook, so
they have their own entry points (`test:ci`, `test-storybook`) and their own CI job.

The first navigation test is slow on a cold Jest cache (expo-router + Reanimated transform); `testTimeout` is 120 s in
`apps/mobile/jest.config.cjs` so CI does not flake. Subsequent runs take a few seconds.

## What CI runs

| Workflow               | Trigger                              | Steps                                                                                                                        |
| ---------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`               | every push / PR                      | tokens drift → maestro id guard → lint → typecheck → Jest; Storybook build + 133 story/axe tests; `expo export` bundle check |
| `storybook-deploy.yml` | push to `main`                       | build Storybook → GitHub Pages                                                                                               |
| `android-apk.yml`      | manual / `v*` tag / called           | `expo prebuild` + `gradlew assembleRelease` → `app-release.apk` artifact (+ GitHub Release on tags)                          |
| `e2e-android.yml`      | manual / nightly / PR label          | builds the APK, boots an emulator, runs all Maestro flows, uploads JUnit + screenshots                                       |
| `eas-build.yml`        | manual                               | EAS cloud build (`preview` APK / `production` AAB) — needs `EXPO_TOKEN`                                                      |
| `tokens-autofix.yml`   | PR touching `packages/tokens/src`    | regenerates `generated/` and pushes the fix commit                                                                           |
| `chromatic.yml`        | PR, only if `vars.CHROMATIC_ENABLED` | visual regression on Storybook (needs `CHROMATIC_PROJECT_TOKEN`)                                                             |

> ⚠️ The workflows were validated as YAML and every command they run was executed locally, except the parts that need
> GitHub-hosted infrastructure (Android SDK build, KVM emulator, EAS, Chromatic). Expect to fix small things on the
> first real run.
