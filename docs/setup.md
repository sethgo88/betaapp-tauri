# Setup Guide

Full environment setup for BetaApp development on Windows.

---

## Prerequisites

### 1. Rust
```bash
# Install rustup from https://rustup.rs
rustup update stable

# Add Android targets
rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android i686-linux-android
```

### 2. Node.js + pnpm
```bash
# Node 20+ via nvm or direct installer
npm install -g pnpm
```

### 3. Android Studio
- Download from https://developer.android.com/studio
- Install Android SDK (API 34+) via SDK Manager
- Install NDK via SDK Manager → SDK Tools → NDK (Side by side)

### 4. Environment variables

Add to your shell profile (`~/.bashrc`, `~/.zshrc`, or Windows System Environment Variables):

```bash
export ANDROID_HOME="$HOME/AppData/Local/Android/Sdk"   # Windows path
export NDK_HOME="$ANDROID_HOME/ndk/$(ls $ANDROID_HOME/ndk)"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
```

On Windows (PowerShell):
```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:NDK_HOME = "$env:ANDROID_HOME\ndk\<version>"
```

Verify:
```bash
echo $ANDROID_HOME
adb --version
```

---

## Project Setup

```bash
# Navigate to project
cd /c/web/betaapp/tauri/betaapp

# Install dependencies
pnpm install

# Initialize Android target (first time only)
cargo tauri android init
```

---

## Supabase Setup

You'll need a Supabase project for cloud sync and auth. This is required from Phase 4 onward. The app works fully offline without it for Phases 1–3.

### 1. Create project
- Go to supabase.com → New project
- Note your **Project URL** and **anon public key** from Settings → API

### 2. Apply database schema
Run the SQL from `docs/database.md` → "Supabase Schema" section in the Supabase SQL Editor.

### 3. Configure auth
- Authentication → URL Configuration → Redirect URLs → Add `betaapp://auth/callback`
- Authentication → Providers → Email → Enable "Magic Links"

### 4. Store credentials in Tauri secure store
Credentials are stored at runtime via `tauri-plugin-store` — not in `.env`. On first app launch after Phase 4, the app will prompt for the Supabase URL and anon key (or these can be hardcoded in development only via a `.env.local` that is gitignored).

---

## Running the App

```bash
# Android device or emulator (primary dev target)
cargo tauri android dev

# Lint + typecheck (run before every commit)
pnpm lint
pnpm tsc --noEmit
```

---

## Git Setup

```bash
cd /c/web/betaapp/tauri/betaapp
git init        # if not already initialized
```

Branching strategy: `phase/<n>-<description>`. See `CLAUDE.md` for details.

---

## Recommended `.gitignore` additions

```
# Supabase local dev
.env
.env.local

# Android generated files (safe to regenerate)
src-tauri/gen/android/

# Keystore files
*.keystore
*.jks
```

---

## Useful Tools

| Tool | Purpose |
|---|---|
| `adb devices` | List connected Android devices |
| `adb logcat` | Stream device logs (useful for Tauri crashes) |
| `adb shell am start -W -a android.intent.action.VIEW -d "betaapp://auth/callback?code=test" com.betaapp.app` | Test deep link manually |
| Supabase Studio | Web dashboard — use as admin CMS for reference data |
