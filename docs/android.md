# Android Guide

BetaApp is Android-only. This document covers build setup, deep links, back button handling, safe areas, and APK signing.

---

## Requirements

- Android Studio (for SDK and emulator)
- Android SDK (API level 24+ recommended)
- Java 17+
- Rust with Android targets:
  ```bash
  rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android i686-linux-android
  ```
- NDK installed via Android Studio SDK Manager
- `ANDROID_HOME` and `NDK_HOME` environment variables set

---

## Key Commands

```bash
cargo tauri android dev                   # run on connected device or emulator
cargo tauri android build --debug         # debug APK (auto-signed with debug keystore)
cargo tauri android build --release       # release APK (requires keystore config)
```

For device development: enable **Developer Options** and **USB Debugging** on the Android device. Use `adb devices` to confirm it's detected.

---

## Bundle Identifier

`com.betaapp.app` — set in `src-tauri/tauri.conf.json`.

This identifier is used for:
- Android package name
- Deep link intent filter registration
- APK signing

---

## Deep Link Setup (Magic Link Auth)

Supabase magic link emails redirect to `betaapp://auth/callback?...`. Tauri's `tauri-plugin-deep-link` intercepts this on Android.

### 1. Android manifest intent filter

In `src-tauri/gen/android/app/src/main/AndroidManifest.xml`, add inside the `<activity>` block:

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="betaapp" android:host="auth" />
</intent-filter>
```

### 2. Supabase redirect URL

In your Supabase project → Authentication → URL Configuration, add to **Redirect URLs**:
```
betaapp://auth/callback
```

### 3. App-side listener (`auth.service.ts`)

```ts
import { onOpenUrl } from '@tauri-apps/plugin-deep-link'

// Call once at app startup (before router renders)
export async function initDeepLinkHandler() {
  await onOpenUrl(async (urls) => {
    for (const url of urls) {
      if (url.startsWith('betaapp://auth/callback')) {
        const params = new URL(url.replace('betaapp://', 'https://placeholder/'))
        const code = params.searchParams.get('code')
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (data.session) {
            authStore.setSession(data.session)
            await syncService.runSync()
          }
        }
      }
    }
  })
}
```

### Troubleshooting
- If the deep link doesn't fire, verify the intent filter in the manifest and rebuild (`cargo tauri android build --debug`)
- The `gen/android/` folder is auto-generated — changes there may be overwritten on `cargo tauri android init`. Check if deep link config needs to be re-applied after regeneration.
- Test with `adb shell am start -W -a android.intent.action.VIEW -d "betaapp://auth/callback?code=test" com.betaapp.app`

---

## Back Button Handling

The Android back button must be intercepted — without this, the OS kills the app instead of navigating back.

```ts
// src/hooks/useAndroidBackButton.ts
import { onBackButtonPress } from '@tauri-apps/api/app'
import { useEffect } from 'react'
import { useRouter } from '@tanstack/react-router'

export function useAndroidBackButton() {
  const router = useRouter()

  useEffect(() => {
    const unlisten = onBackButtonPress(() => {
      if (router.history.length > 1) {
        router.history.back()
      } else {
        // On root: let the OS handle it (closes app)
        // Do not call preventDefault() at root
      }
    })
    return () => { unlisten.then((fn) => fn()) }
  }, [router])
}
```

Call `useAndroidBackButton()` in the root layout component (`AppLayout`).

**Important:** `onBackButtonPress` returns a `PluginListener` (a Promise resolving to an unlisten function). Always clean up in the `useEffect` return.

---

## Safe Areas

The app runs edge-to-edge on Android. Device cutouts (camera notch at top) and gesture navigation bar (bottom) overlap content if not handled.

### Rules

- **Top:** Any fixed element at the top of the screen must clear `env(safe-area-inset-top)`:
  ```tsx
  style={{ paddingTop: 'env(safe-area-inset-top)' }}
  // Or with additional offset:
  style={{ top: 'calc(env(safe-area-inset-top) + 16px)' }}
  ```

- **Bottom:** Any fixed element at the bottom must clear `env(safe-area-inset-bottom)` plus 15px:
  ```tsx
  style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 15px)' }}
  ```

- **Scrollable content:** Add bottom padding so last items aren't hidden behind the gesture bar:
  ```tsx
  <div
    className="flex-1 overflow-y-auto"
    style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 15px)' }}
  >
  ```

### Required in `index.html`

The viewport meta tag must opt into edge-to-edge:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

---

## Capabilities

Declared in `src-tauri/capabilities/`. Missing capability = silent failure with no error message.

| Capability | Reason |
|---|---|
| `core:default` | Core Tauri APIs |
| `sql:default`, `sql:allow-execute` | SQLite read/write |
| `deep-link:default` | Magic link callback |

If a Tauri API call silently fails on Android, check the capabilities file first.

---

## APK Signing

### Debug builds
Auto-signed with the debug keystore at `~/.android/debug.keystore`. No configuration needed.

### Release builds

1. Generate a release keystore (do this once, store it safely outside the project):
   ```bash
   keytool -genkey -v -keystore betaapp-release.keystore -alias betaapp -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Create `.env` in project root (never commit this file):
   ```
   TAURI_SIGNING_PRIVATE_KEY=/path/to/betaapp-release.keystore
   TAURI_SIGNING_PRIVATE_KEY_PASSWORD=your-keystore-password
   ```
   Or set the equivalent Tauri Android signing config in `src-tauri/tauri.conf.json`.

3. Build:
   ```bash
   cargo tauri android build --release
   ```

4. APK output: `src-tauri/gen/android/app/build/outputs/apk/universal/release/`

**Never commit:** the keystore file, `.env` with credentials, or any file containing the signing password.

---

## Android Permissions

Required in `src-tauri/gen/android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

---

## CSP (Content Security Policy)

Supabase domains must be allowed in the CSP. Set in `src-tauri/tauri.conf.json`:

```json
{
  "app": {
    "security": {
      "csp": "default-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; img-src 'self' data: blob:"
    }
  }
}
```

- `https://*.supabase.co` — Supabase REST and Auth API
- `wss://*.supabase.co` — Supabase Realtime WebSocket
- `data: blob:` — local image data URLs

---

## Common Troubleshooting

| Issue | Fix |
|---|---|
| Blank screen on app launch | Check memory history is used (not browser history) in TanStack Router |
| Deep link not firing | Verify intent filter in manifest, rebuild, test with `adb shell am start` |
| Supabase call silently fails | Check CSP allows `*.supabase.co`, check capabilities file |
| Back button closes app instead of navigating | Ensure `useAndroidBackButton()` is called in root layout |
| SQLite migration fails | Check migration SQL for syntax errors; migrations run on every launch |
| Release APK won't install | Verify signing keystore and password are correct; debug and release keystores are different |
