# Web Version Feasibility Research

> Research spike for issue #50. This is a read-only document — no implementation begins until a technical approach is agreed on.

---

## Motivation

BetaApp is currently Android-only, distributed as a Tauri 2 APK. A web build target would allow access from any browser without installation — useful for route browsing, climb logging from a desktop, and reducing friction for new users.

**Agreed scope for web:** cloud-only. The web version will have no local SQLite. All data is read from and written to Supabase directly.

---

## Plugin Inventory

The following Tauri/native plugins are in use on Android. Each needs a web replacement or can be dropped.

### 1. `@tauri-apps/plugin-sql` — Critical

**Usage:** Every data operation in the app. Accessed via `src/lib/db.ts` which wraps `Database.load("sqlite:betaapp.db")`. All 14 service files call `db.execute()` or `db.select()`.

**Web approach:** Drop entirely. The web version calls Supabase directly for all data — climbs, burns, locations, routes, grades, images. No `db.ts` adapter is needed.

**Impact:**
- All 14 service files need a web implementation that queries Supabase instead of SQLite
- `src/lib/db.ts` is not used on web
- Sync service (`sync.service.ts`) is irrelevant on web — there is nothing to sync between local and remote
- Schema migrations and `grades-seed.ts` are irrelevant on web

### 2. `@tauri-apps/plugin-geolocation` — Moderate

**Usage:** 3 files — `App.tsx` (startup permission check + position fetch), `CoordinatePicker.tsx` (pre-populate GPS coords), `MapView.tsx` ("locate me" button).

**Web approach:** Replace with the standard browser Geolocation API (`navigator.geolocation.getCurrentPosition`). The API shape is nearly identical. Requires HTTPS (already a given for web).

**Impact:** Minor. Each call site needs a platform check or a thin abstraction function that calls the Tauri plugin on Android and `navigator.geolocation` on web.

### 3. `@tauri-apps/plugin-deep-link` — Moderate

**Usage:** 2 files — `App.tsx` listens for incoming deep links while the app is running; `auth.service.ts` reads the pending deep link on launch. Both handle the `betaapp://auth/callback` scheme for password reset and magic link flows.

**Web approach:** Standard OAuth redirect. Supabase redirects the browser to `https://betaapp.example.com/auth/callback?code=...`. Parse `window.location.search` on that route. No plugin needed.

**Impact:** The auth callback URL needs to be an HTTPS URL registered in Supabase Auth settings. The deep-link listener and `getCurrent()` calls are replaced with URL param parsing in the router.

### 4. `@tauri-apps/plugin-opener` — Minor

**Usage:** 1 file — `RouteDetailView.tsx` calls `openUrl(link.url)` to open route beta links in the system browser.

**Web approach:** `window.open(url, '_blank', 'noopener,noreferrer')`.

**Impact:** Trivial. One call site.

### 5. `@tauri-apps/api/app` (back button) — Minor

**Usage:** `src/hooks/useAndroidBackButton.ts` intercepts the Android hardware back button to drive router history.

**Web approach:** Drop entirely on web. The browser back button drives `window.history` natively. TanStack Router with `createBrowserHistory` handles it automatically.

**Impact:** The hook becomes a no-op or is simply not mounted on web.

---

## Architecture: Cloud-Only Web

The web version bypasses the local SQLite layer entirely. All data flows between the React frontend and Supabase.

```
Android                              Web
-------                              ---
React UI                             React UI (same components)
    ↓                                    ↓
TanStack Query hooks             TanStack Query hooks (same hooks, different services)
    ↓                                    ↓
*.service.ts (SQLite)            *.service.ts (Supabase direct)
    ↓                                    ↓
src/lib/db.ts                    @supabase/supabase-js
    ↓                                    ↓
tauri-plugin-sql (SQLite)        Supabase Postgres (via HTTPS / Realtime)
    ↑                                    ↑
tauri-plugin-sql ←→ Supabase     [no sync step needed]
(bidirectional sync on demand)
```

The TanStack Query hooks and React components are identical across both targets. The service layer diverges.

---

## What Transfers Directly (No Changes)

| Area | Status |
|---|---|
| React 19 components (atoms, molecules, organisms, templates, views) | Unchanged |
| TanStack Query hooks (`*.queries.ts`) | Unchanged (services swap underneath) |
| TanStack Router + routes | Minor: switch from `createMemoryHistory` to `createBrowserHistory` |
| TanStack Form + Zod schemas | Unchanged |
| Zustand stores | Unchanged |
| Supabase client (`src/lib/supabase.ts`) | Unchanged |
| Leaflet / react-leaflet maps | Unchanged (web-native) |
| Tailwind CSS styles | Unchanged |
| Auth flow (email/password) | Unchanged; only the callback URL mechanism changes |

---

## Implementation Scope Estimate

| Area | Effort | Notes |
|---|---|---|
| New `*.service.ts` (web variants) for climbs, burns, routes, locations, grades, images | High | 14 service files; logic is largely a 1:1 mapping of SQL queries to Supabase `.from().select()` calls |
| Platform-conditional service loading | Medium | Need a way to load the Tauri service on Android and the Supabase service on web (e.g. `import.meta.env.TAURI_ENV_TARGET` or a build flag) |
| Router history switch | Trivial | `createMemoryHistory` → `createBrowserHistory` on web |
| Geolocation adapter | Minor | Thin function that dispatches to Tauri plugin or `navigator.geolocation` |
| Auth callback (deep link → URL params) | Minor | Parse `?code=` from `window.location.search` on the callback route |
| URL opener | Trivial | `window.open()` on web |
| Back button hook | Trivial | Skip mounting on web |
| Vite build config / deploy pipeline | Medium | Add a web build target; configure HTTPS; set up hosting (Vercel, Netlify, or Supabase hosting) |
| Supabase RLS audit | Medium | Verify all RLS policies allow the correct reads/writes for web auth tokens; currently designed for Android but should already be compatible |

---

## Open Questions

1. **Hosting:** Where does the web app live? A subdomain (`app.betaapp.com`) or the same origin as any future marketing site?
2. **Auth redirect URL:** What is the canonical HTTPS callback URL? Needs to be registered in Supabase Auth → URL Configuration → Redirect URLs.
3. **Platform detection:** What mechanism determines whether to load the Tauri or Supabase service layer? Options:
   - `window.__TAURI__` runtime check (available when running inside Tauri)
   - A build-time env var (`VITE_PLATFORM=android|web`) set in the build command
   - Separate Vite entry points (`main.android.tsx` / `main.web.tsx`)
4. **Feature parity:** Are all views in scope for web? Some (admin views, image pinning, video frame capture) may be deprioritised for an initial web release.
5. **Offline:** Confirmed out of scope for web. Any future offline requirement would revisit OPFS-backed WASM SQLite (e.g. wa-sqlite), but that is not planned.

---

## Recommended Next Steps

Once a technical approach is agreed:

1. Open a tracking issue for the web build target and break it into sub-issues per domain (auth, climbs, routes, locations, etc.)
2. Create a `feat/web-target` branch from `master`
3. Start with the platform detection mechanism and the router history switch — these are the cheapest changes and validate the build setup
4. Implement web service variants domain by domain, starting with `auth` and `climbs` (highest value)
5. Add a web deploy target to CI once the first domain is working end-to-end
