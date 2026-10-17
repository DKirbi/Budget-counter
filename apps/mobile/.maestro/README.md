# Maestro end-to-end flows

Black-box UI tests that drive the real Android/iOS app the way a user does. They select by **`testID`** (`id:`), so they
survive copy and layout changes. Flows F1–F10 are the same journeys as the Jest tests
(`packages/screens-native/src/flows.test.tsx`) and the Storybook stories (`Flows/User journeys`).

```bash
# 1. Install Maestro once (macOS/Linux):  curl -Ls "https://get.maestro.mobile.dev" | bash
# 2. Install a build on an emulator or USB device (see docs/TESTING_ON_PHONE.md), then:
pnpm --filter @tbc/mobile e2e                         # all flows, in order
maestro test apps/mobile/.maestro/f6-split-payment.yaml   # one flow
maestro studio                                        # interactive inspector: click elements, see their ids
```

Notes

- `appId` is `app.budgetcounter.mobile` (`app.json`). Works with the **release/preview APK**; Expo Go has a different app id.
- Every flow starts with `clearState`, so flows are independent and can run in any order or in parallel shards.
- Demo data is created relative to _today_, so numbers in F3/F6/F7/F9 are stable regardless of the calendar date.
- Screenshots and a video of a failed run land in `~/.maestro/tests/<timestamp>`. Add `- takeScreenshot: name` anywhere.
