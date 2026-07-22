# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                     React UI Layer                       │
│   views/  →  organisms  →  molecules  →  atoms          │
└───────────────────────┬─────────────────────────────────┘
                        │ hooks / TanStack Query
┌───────────────────────▼─────────────────────────────────┐
│               Feature Layer (src/features/)              │
│   *.queries.ts   *.service.ts   *.store.ts   *.schema.ts │
│           service functions branch on isTauri()          │
└──────────┬──────────────────────────┬────────────────────┘
           │ Tauri (Android)          │ Web (browser)
┌──────────▼──────────┐   ┌──────────▼────────────────────┐
│   SQLite (local)     │   │   Supabase (cloud)             │
│   tauri-plugin-sql   │   │   @supabase/supabase-js        │
│   src/lib/db.ts      │   │   src/lib/supabase.ts          │
└─────────────────────┘   └───────────────────────────────┘
```

Both platforms share the same codebase. On web, all reads and writes go directly to Supabase — there is no local SQLite and no download step. On Tauri (Android), the local SQLite cache is the primary data source; Supabase is synced on demand.

## Navigation Structure

Bottom tab bar (always visible):
- **Home** — personal climb list
- **Add** — log a new climb
- **Profile** — auth status, sync status
- **Menu (☰)** — hamburger drawer

Drawer (slides in from right):
- Routes — browse location hierarchy
- Settings — app settings + dev tools
- **Admin** section (role-gated):
  - Location Manager
  - Route Verification

---

## Route Structure

```
/                          → HomeView (personal climb list, requireAuth)
/climbs/add                → AddClimbView (requireAuth)
/climbs/$climbId           → ClimbDetailView (requireAuth)
/profile                   → ProfileView (public)
/reset-password            → ResetPasswordView (public)
/auth/callback             → inline spinner — web only; Supabase redirects here after magic link
/map                       → MapView (requireAuth)
/search                    → SearchView (requireAuth)
/routes                    → RoutesView (country/region browser; download UI Android-only, requireAuth)
/routes/add                → AddEditRouteView (requireAuth)
/routes/$routeId           → RouteDetailView (requireAuth)
/routes/$routeId/edit      → AddEditRouteView (requireAuth)
/routes/submit             → SubmitRouteView (requireAuth, search params: wallId, wallName)
/regions/$regionId         → RegionView (requireAuth)
/sub-regions/$subRegionId  → SubRegionView (requireAuth)
/crags/$cragId             → CragView (requireAuth)
/walls/$wallId             → WallView (requireAuth)
/locations/add             → AddLocationView (requireAuth)
/stats                     → StatsView (requireAuth)
/settings                  → SettingsView (public)
/admin/locations           → LocationManagerView (requireAdmin)
/admin/verify              → VerificationView (requireAdmin)
```

---

## Layer Responsibilities

### `src/views/`
Page-level components. Compose organisms with real data. One file per route. The only place that owns page-level routing logic and layout decisions.

Admin views live in `src/views/admin/`.

### `src/components/`
Pure UI — atoms, molecules, organisms, templates. Components receive data as props or read from TanStack Query/Zustand. They never call service functions directly (exception: organisms may use `useQuery` hooks).

### `src/features/`
All business logic. No JSX. Divided by domain:

| Domain | Files | Responsibility |
|---|---|---|
| `climbs` | `climbs.service.ts` | CRUD against local SQLite; push to Supabase |
| `climbs` | `climbs.queries.ts` | TanStack Query hooks + silent push mutations |
| `climbs` | `climbs.store.ts` | Zustand — selectedClimbId, active filters |
| `climbs` | `climbs.schema.ts` | Zod schemas for Climb domain |
| `routes` | `routes.service.ts` | Read from routes_cache; submit/verify/reject/merge via Supabase |
| `routes` | `routes.queries.ts` | TanStack Query hooks for browse + admin verification |
| `routes` | `routes.schema.ts` | Zod schemas for Route domain |
| `locations` | `locations.service.ts` | Read location hierarchy from SQLite cache; downloadRegion orchestration |
| `locations` | `locations.queries.ts` | TanStack Query hooks for location hierarchy + download mutation |
| `locations` | `locations.schema.ts` | Zod schemas for Country, Region, SubRegion, Crag, Wall |
| `grades` | `grades.service.ts` | Read from grades_cache; seed on first install; pull from Supabase |
| `grades` | `grades.queries.ts` | TanStack Query hook for grades list |
| `grades` | `grades-seed.ts` | Hardcoded fallback grades (sport + boulder) |
| `sync` | `sync.service.ts` | Push/pull for climbs + reference data (grades, countries, regions) |
| `sync` | `sync.store.ts` | Sync state — status, lastSyncedAt |
| `auth` | `auth.service.ts` | Sign in/up/out, session restore, role detection via user_roles |
| `auth` | `auth.store.ts` | Auth state — user, session, isAuthenticated |

### `src/lib/`
React-free singletons and utilities:
- `db.ts` — SQLite wrapper; `initSchema()` runs on first load (CREATE TABLE IF NOT EXISTS + ALTER TABLE migrations)
- `supabase.ts` — typed Supabase client (`createClient<Database>`)
- `database.types.ts` — generated via `supabase gen types typescript`; re-run after schema changes
- `cn.ts` — Tailwind class merging utility
- `date.ts` — ISO 8601 / Unix timestamp helpers

### `src-tauri/src/`
Rust backend — minimal. Handles plugin registration only. No custom Tauri commands for data access (all SQLite access is JS-side via `tauri-plugin-sql`).

---

## Data Domains

### User Data (bidirectional sync)
Owned by the authenticated user. Synced to Supabase with RLS (`user_id = auth.uid()`).

- `climbs` — personal log of ascents. `route_id` links to a verified route (nullable; Phase 10).

### Reference Data (one-way pull, admin-managed)
Written only by admin. Read-only for regular users.

- **Grades** — seeded from `grades-seed.ts` on first install; Supabase is authoritative on sync.
- **Countries + Regions** — always pulled on app launch (lightweight).
- **Sub-Regions, Crags, Walls** — pulled per-region on explicit user download.
- **Routes** — pulled per-region on explicit download; only verified routes cached locally. Unverified routes (user submissions) visible to creator only via RLS.

---

## Data Flows

Detailed flows live in the feature READMEs:

| Flow | See |
|---|---|
| Logging a climb (form → SQLite → Supabase) | `src/features/climbs/README.md` |
| Region download | `src/features/locations/README.md` |
| Route submission + admin verification | `src/features/routes/README.md` |
| Sync push/pull + Realtime | `src/features/sync/README.md` |

---

## Auth Flow

### Email/Password
```
ProfileView → signIn(email, password) or signUp(email, password)
      ↓
Supabase auth → session returned
      ↓
fetchOrCreateSupabaseUser(userId) → role from user_roles table
      ↓
[Tauri] upsertLocalUser(id, email, role) → local SQLite users table
[Web]   fetchProfileForWeb(id, email, role) → User built from Supabase profiles
      ↓
auth.store: setUser(), setSession()
      ↓
navigate("/") → runSync() fires (Tauri only)
```

### Magic Link — Android
```
sendMagicLink → emailRedirectTo = Supabase Edge Function URL
User taps link → Edge Function 302s to betaapp://auth/callback
tauri-plugin-deep-link fires → exchangeCodeForSession → handleSession flow
```

### Magic Link — Web
```
sendMagicLink → emailRedirectTo = window.location.origin + '/auth/callback'
User clicks link → browser opens app at /auth/callback (spinner shown)
Supabase JS client detects tokens in URL → onAuthStateChange fires SIGNED_IN
fetchOrCreateSupabaseUser → fetchProfileForWeb → setUser → navigate("/")
Note: window.location.origin must be in Supabase's allowed redirect URL list
```

### Offline Cold Start (Android only)
```
App launch (offline):
  navigator.onLine check → false (or betaapp-debug-offline flag set in DEV)
  restoreSession(3s timeout) → reads localStorage token cache
    if valid non-expired session → setSession + fetchLocalUser → setUser → proceed offline
    if expired token → refresh attempt times out after 3s → falls through
    if no session → falls through
  No session → fetchLocalUser() → setUser (no setSession); login screen shown
  When connectivity returns → useSync.runSync() auto-triggered
```

---

## Admin System

Admin role is managed via the `user_roles` table in Supabase (not `users.role`). On login, `fetchOrCreateSupabaseUser` reads `user_roles` and stores the role in `auth.store`.

**Route guards:**
- `requireAuth` — redirects to `/profile` if not authenticated
- `requireAdmin` — redirects to `/` if authenticated but not admin

**In-app admin views** (accessed via Drawer, gated by `requireAdmin`):
- `LocationManagerView` — add/delete countries and regions
- `LocationVerificationView` — approve or reject pending sub-area, crag, and wall submissions
- `RouteVerificationView` — approve, edit, reject, or merge pending route submissions

**Supabase RLS** enforces the same restrictions on the backend — UI gating is for UX only.

---

## Local-First Principles

These principles apply to the **Tauri (Android)** platform. The web platform is Supabase-direct with no local cache.

1. **All reads come from SQLite (Android).** Supabase is never queried for display data on Android (exception: admin views read unverified routes directly from Supabase). On web, all reads go to Supabase.
2. **The app works offline (Android).** Offline climbs accumulate and sync when connected. Web requires a network connection.
3. **Soft deletes for user data.** `deleted_at` set on delete; never hard-deleted from local SQLite.
4. **Last-write-wins conflict resolution.** The row with the newer `updated_at` wins. Acceptable for a single-user app.
5. **Grades always available (Android).** `grades-seed.ts` ensures grades exist before first sync. On web, grades are fetched live from Supabase.
6. **Reference data is read-only for users.** Users never push to reference tables.

---

## Tauri 2 Capabilities

| Capability | Reason |
|---|---|
| `core:default` | Core Tauri APIs |
| `sql:default`, `sql:allow-execute` | SQLite read/write |
| `deep-link:default` | Magic link callback handling |
