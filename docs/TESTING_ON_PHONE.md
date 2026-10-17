# Testing the app on a phone

There is no single "standard" — the industry uses a ladder, and you pick the rung that matches what you're checking.
This guide is ordered from _fastest feedback_ to _closest to what users get_. Everything below is wired up in this repo.

| #   | Method                                                                            | Needs                                          | Feedback loop               | Use it for                                                     |
| --- | --------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------- | -------------------------------------------------------------- |
| 1   | **Expo Go** (QR code)                                                             | Expo Go app, same Wi-Fi                        | seconds (Fast Refresh)      | daily UI work, showing a colleague                             |
| 2   | **Development build** (dev-client APK)                                            | Android phone or emulator                      | seconds after first install | anything Expo Go can't do: Android widgets, custom native code |
| 3   | **Preview APK** (release-mode, installable file)                                  | GitHub Actions _or_ EAS _or_ local Android SDK | minutes per build           | testers, QA, "does the real bundle behave?"                    |
| 4   | **Emulator + Maestro** (automated E2E)                                            | CI or local emulator                           | ~10–15 min per run          | regression on every flow (F0–F10)                              |
| 5   | **Store tracks** (Play Internal Testing / Firebase App Distribution / TestFlight) | store account                                  | build + review              | wider beta, real-device coverage, staged rollout               |
| 6   | **Device farms** (Firebase Test Lab, BrowserStack, AWS Device Farm)               | account                                        | minutes                     | many models / OS versions in parallel                          |

> Which is "standard"? For React Native/Expo teams: **Expo Go or a dev build while developing → an EAS/CI-built APK (AAB
> for the store) for testers → Maestro/Detox on an emulator in CI → Play Internal Testing / TestFlight for beta.** That is
> exactly the ladder above.

---

## 1 · Expo Go (30 seconds)

```bash
pnpm install
pnpm start            # = expo start; prints a QR code
```

- **Android:** open _Expo Go_ → _Scan QR code_. **iOS:** scan with the Camera app.
- Phone and laptop must be on the same network. If the office Wi-Fi isolates clients, use a tunnel:
  `pnpm --filter @tbc/mobile exec expo start --tunnel`.
- Shake the device (or press `m` in the terminal) for the dev menu; `r` reloads.

Limits: Expo Go ships a fixed set of native modules. This MVP only uses modules Expo Go includes (Reanimated, SVG,
Gesture Handler, Screens, AsyncStorage), so it runs. The **home-screen widgets** planned for later cannot run in Expo Go
— move to method 2 before starting them. Expo Go also only supports the current SDK (57 here); if the store version is
newer/older, use method 2.

## 2 · Development build (dev-client)

A dev build is _your own_ Expo Go: same JS hot reloading, but with your exact native modules (`expo-dev-client` is
already a dependency).

**Cloud (no Android SDK needed):**

```bash
cd apps/mobile
npx eas-cli login && npx eas-cli init            # once
npx eas-cli build --profile development --platform android
```

EAS prints a QR/link to the `.apk`; install it, then on your laptop:

```bash
pnpm --filter @tbc/mobile start:dev-client        # open the app, it finds the dev server
```

**Local (Android Studio installed, phone with USB debugging or an emulator):**

```bash
cd apps/mobile
npx expo run:android            # prebuilds, compiles the debug APK and launches it on the connected device
```

## 3 · Preview APK — the installable file

You get a real, release-mode `.apk` (JS bundle embedded, no laptop needed). Three ways, pick one:

### 3a · GitHub Actions (no Expo account, free) — recommended default

1. GitHub → _Actions_ → **Android APK** → _Run workflow_ (also runs automatically on tags `v*`).
2. When it finishes, open the run → _Artifacts_ → **app-release-apk** → download `app-release.apk`.
   On a `v*` tag it is also attached to the GitHub Release, so testers can download it from the phone's browser.
3. Install: open the file on the phone (allow _Install unknown apps_ for your browser/Files app once), **or**
   ```bash
   adb install -r app-release.apk      # USB debugging on, `adb devices` shows the phone
   ```

The workflow runs `expo prebuild` (generates `android/` from `app.json`, Continuous Native Generation — the folder is
git-ignored) and `./gradlew assembleRelease`. The APK is signed with the debug keystore from Expo's template: fine
for internal testing, **not** for the Play Store (see 5).

### 3b · EAS Build (cloud, shareable install page)

```bash
cd apps/mobile && npx eas-cli build --profile preview --platform android
```

or Actions → **EAS build & update** (needs the `EXPO_TOKEN` secret). EAS gives testers an install link/QR. Bonus:
**EAS Update** ships JS-only fixes over the air to installed preview builds without a new APK
(`publish_update: true` in that workflow).

### 3c · Local

```bash
pnpm --filter @tbc/mobile build:apk:release
adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

Requires JDK 17 and the Android SDK (`ANDROID_HOME`).

## 4 · Automated E2E with Maestro

Maestro drives the installed app through YAML flows (`apps/mobile/.maestro`), one per user journey F0–F10.

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash      # once
adb install -r app-release.apk                         # emulator or USB phone
pnpm --filter @tbc/mobile e2e                          # all flows
maestro studio                                         # click through the UI to discover ids and record steps
```

In CI, `e2e-android.yml` does all of it: builds the APK, boots an API 34 emulator (KVM-accelerated), installs, runs
every flow, and uploads a JUnit report and screenshots. Nightly + on demand + on PRs labelled `e2e`.

Why Maestro and not Detox/Appium? YAML flows readable by designers, no app instrumentation, and the same file works on
iOS. Detox is faster and more deterministic for gray-box tests but needs native build integration; Appium is the
heavyweight cross-language option. Reconsider Detox only if Maestro flakes.

## 5 · Store tracks (beta)

1. **Build an AAB** (Play requires bundles): `eas build --profile production --platform android`.
2. **Signing:** let EAS manage the upload keystore, or supply your own (`eas credentials`). Never ship the debug keystore.
3. **Google Play → Testing → Internal testing:** up to 100 testers, available in minutes, no review. Upload with
   `eas submit --platform android` (needs a Play service-account key; the first upload must be manual).
4. **Firebase App Distribution** is a lighter alternative for APKs/AABs: testers get an email + in-app updates, no Play
   Console required.
5. **iOS:** `eas build --platform ios` → **TestFlight** (needs the paid Apple Developer Program). Internal testers need no review.

## 6 · Device farms

For "does it work on a Samsung with Android 12 and a low-RAM Xiaomi?": upload the APK to **Firebase Test Lab** (Robo
test needs no scripts; Maestro flows can also be run on BrowserStack / Maestro Cloud) or AWS Device Farm.

---

## Troubleshooting

| Symptom                                                | Fix                                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| QR scans but the app can't load                        | Same Wi-Fi? Try `--tunnel`; disable VPN; allow the port through the firewall                     |
| "Project is incompatible with this version of Expo Go" | Store Expo Go is on a different SDK → use a dev build (method 2)                                 |
| `adb: no devices`                                      | Enable USB debugging, accept the RSA prompt, `adb kill-server && adb devices`                    |
| "App not installed" over an older build                | Different signing key → `adb uninstall app.budgetcounter.mobile` first                           |
| Styles missing in a release build only                 | `global.css` must be imported in `app/_layout.tsx`; run `pnpm --filter @tbc/mobile export:check` |
| Maestro can't find an element                          | Run `pnpm check:maestro`; open `maestro studio` and compare the id with the `testID` in source   |
| First Gradle build takes 15+ min                       | Normal (cold cache). The workflow uses `gradle/actions/setup-gradle` to cache afterwards         |

## What has and has not been verified

Verified in the authoring sandbox: the Android JS bundle builds (`expo export --platform android`), all Jest/Storybook
tests pass, Maestro flows' selectors match source (`check:maestro`). **Not** verifiable there (no Android SDK, emulator or
device): the APK build itself, installing it, Maestro on a real emulator, EAS and Play/TestFlight steps. Treat the first
Actions run as the verification, and expect to adjust small things (SDK image, memory, signing).
