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
└──────────┬──────────────────────────┬────────────────────┘
           │                          │
┌──────────▼──────────┐   ┌──────────▼────────────────────┐
│   SQLite (local)     │   │   Supabase (cloud)             │
│   tauri-plugin-sql   │   │   @supabase/supabase-js        │
│   src/lib/db.ts      │   │   src/lib/supabase.ts          │
└─────────────────────┘   └───────────────────────────────┘
           │                          │
┌──────────▼──────────┐   ┌──────────▼────────────────────┐
│   Rust / Tauri       │   │   Supabase Realtime            │
│   plugin reg only    │   │   WebSocket channel (climbs)   │
│   migrations         │   │   live push to local SQLite    │
└─────────────────────┘   └───────────────────────────────┘
```

## Layer Responsibilities

### `src/views/`
Page-level components. Compose organisms with real data. One file per route. The only place that owns page-level routing logic and layout decisions.

### `src/components/`
Pure UI — atoms, molecules, organisms, templates. Components receive data as props or read from TanStack Query/Zustand. They never call service functions directly (exception: organisms may use `useQuery` hooks).

### `src/features/`
All business logic. No JSX. Divided by domain:

| Domain | Files | Responsibility |
|---|---|---|
| `climbs` | `climbs.service.ts` | CRUD against SQLite for user's climbs |
| `climbs` | `climbs.queries.ts` | TanStack Query hooks for climbs |
| `climbs` | `climbs.store.ts` | Zustand — active filters, UI state |
| `climbs` | `climbs.schema.ts` | Zod schemas for Climb domain |
| `routes` | `routes.service.ts` | Read routes from SQLite cache, submit new routes to Supabase |
| `routes` | `routes.queries.ts` | TanStack Query hooks for route browsing |
| `routes` | `routes.schema.ts` | Zod schemas for Route domain |
| `locations` | `locations.service.ts` | Read location hierarchy from SQLite cache |
| `locations` | `locations.queries.ts` | TanStack Query hooks for location browsing |
| `locations` | `downloads.service.ts` | Download region route data from Supabase to local cache |
| `grades` | `grades.service.ts` | Read grades from local cache, seed on first install |
| `grades` | `grades.queries.ts` | TanStack Query hook for grades list |
| `grades` | `grades-seed.ts` | Hardcoded fallback grades (sport + boulder) |
| `sync` | `sync.service.ts` | Push/pull logic for user data (climbs) ↔ Supabase |
| `sync` | `sync.store.ts` | Sync state — isSyncing, lastSyncedAt, realtimeStatus |
| `auth` | `auth.service.ts` | Magic link sign-in/out, session management |
| `auth` | `auth.store.ts` | Auth state — user, session, role |

### `src/lib/`
React-free singletons and utilities:
- `db.ts` — typed wrapper around `@tauri-apps/plugin-sql`
- `supabase.ts` — configured Supabase client singleton
- `cn.ts` — Tailwind class merging utility (`clsx` + `tailwind-merge`)
- `date.ts` — ISO 8601 / Unix timestamp helpers

### `src-tauri/src/`
Rust backend — minimal. Handles:
- Plugin registration (`tauri-plugin-sql`, `tauri-plugin-deep-link`)
- Migration definitions (passed to `tauri-plugin-sql` — run automatically on launch)
- No custom Tauri commands for data access (all SQLite access is JS-side)

---

## Route Structure

```
/                              → HomeView (personal climb list)
/add                           → AddClimbView
/climb/:id                     → ClimbDetailView
/edit/:id                      → EditClimbView
/routes                        → RoutesView (browse countries/regions)
/routes/:regionId              → RegionView (sub-regions in a region)
/routes/:regionId/:subRegionId → SubRegionView (crags in a sub-region)
/routes/:regionId/:subRegionId/:cragId → CragView (walls + routes)
/profile                       → ProfileView
/settings                      → SettingsView (auth + sync status)
/admin                         → AdminView (role-gated)
/admin/locations               → LocationManagerView
/admin/grades                  → GradesManagerView
/admin/routes/verify           → RouteVerificationView
```

---

## Data Domains

### User Data (bidirectional sync)
Owned by the authenticated user. Synced to Supabase with RLS (`user_id = auth.uid()`).

- `climbs` — personal log of ascents. May link to a `route_id` or use freeform location fields.

### Reference Data (one-way pull, admin-managed)
Written only by admin (via in-app admin views or Supabase Studio). Read-only for regular users.

- **Grades** — seeded from `grades-seed.ts` on first install; Supabase is authoritative.
- **Location hierarchy** — Countries → Regions → Sub-Regions → Crags → Walls. Countries and Regions are always synced (lightweight metadata). Sub-Regions, Crags, and Walls are cached on demand as the user navigates.
- **Routes** — linked to a Wall. Only cached locally when the user explicitly downloads the containing Region. Pending routes (submitted by users, not yet admin-verified) are visible only to their creator.

---

## Data Flow: Logging a Climb

### With a known route (region downloaded)
```
AddClimbView → user searches/browses routes
      ↓
LocationPicker: Country → Region → Sub-Region → Crag → Wall → Route
      ↓
ClimbForm filled (grade auto-populated from route)
      ↓
form.handleSubmit() → ClimbSchema.parse() → useCreateClimb mutation
      ↓
climbs.service.createClimb() → db.ts → SQLite
      ↓
onSuccess: invalidateQueries(['climbs'])
      ↓
If online: sync.service.pushClimb(id) → Supabase upsert
```

### Without a downloaded region (custom location)
```
AddClimbView → user types freeform location fields
      ↓
Climb saved with is_custom_location = true, route_id = null
      ↓
Later: EditClimbView → "Link to official location" option
      ↓
User downloads region → selects route → climb updated with route_id
      → is_custom_location = false
```

---

## Data Flow: Sync (User Data)

### Push (local → Supabase)
```
Climb created/updated locally
      ↓
If online: immediately upsert to Supabase climbs table
      ↓
On failure: mark climb as unsynced → retry on next runSync()
```

### Pull (Supabase → local) — startup + Realtime
```
App launch:
  read sync_meta.last_synced_at
  fetch Supabase climbs WHERE updated_at > last_synced_at AND user_id = me
  upsert into local SQLite
  update sync_meta.last_synced_at

While app is open (Supabase Realtime):
  subscribe to climbs channel for current user_id
  on INSERT/UPDATE: upsert row to local SQLite → invalidateQueries(['climbs'])
  on DELETE: soft-delete local row → invalidateQueries(['climbs'])
```

---

## Data Flow: Reference Data Sync

### Grades
```
First install:
  grades_cache is empty
  grades.service.seedGrades() → insert from grades-seed.ts

On sync:
  fetch Supabase grades WHERE updated_at > last_grades_synced_at
  upsert into grades_cache
  → invalidateQueries(['grades'])
```

### Location metadata (always-on)
```
App launch:
  fetch all countries from Supabase → upsert countries_cache
  fetch all regions (with route_count) from Supabase → upsert regions_cache

On user navigation into a region:
  fetch sub_regions for region_id → upsert sub_regions_cache
  fetch crags for sub_region_id → upsert crags_cache
  fetch walls for crag_id → upsert walls_cache
```

### Region download (explicit user action)
```
User taps "Download Region" on RegionView
      ↓
downloads.service.downloadRegion(regionId):
  fetch all sub_regions, crags, walls, routes for the region
  bulk upsert into local cache tables
  insert into downloaded_regions (region_id, downloaded_at, route_count)
      ↓
invalidateQueries(['routes', regionId])
Region is now available offline
```

---

## Auth Flow (Magic Link)

```
SettingsView → user enters email → auth.service.signInWithMagicLink(email)
      ↓
Supabase sends magic link email → link contains token
      ↓
User taps link on device → Android deep link opens app (betaapp://auth/callback?token=...)
      ↓
tauri-plugin-deep-link fires event → auth.service.handleDeepLink(url)
      ↓
Supabase client exchanges token for session
      ↓
Session stored in Tauri secure store
      ↓
auth.store updates (user, session, role)
      ↓
sync.service.runSync() fires (initial full sync)
```

---

## Admin System

Admin role is determined by `users.role = 'admin'` in Supabase. On login, the user's profile is fetched and the role is stored in `auth.store`.

**In-app admin views** (gated by `role === 'admin'`):
- `LocationManagerView` — add/edit countries, regions, sub-regions, crags, walls
- `GradesManagerView` — add/edit grades by route type
- `RouteVerificationView` — approve or reject user-submitted routes

**Supabase RLS** enforces the same restrictions on the backend — UI gating is for UX only.

---

## Local-First Principles

1. **All reads come from SQLite.** Supabase is never queried for display data.
2. **The app works offline.** Offline climbs accumulate and sync when connected.
3. **Soft deletes for safety.** `deleted_at` set on delete; hard delete after sync confirmation.
4. **Last-write-wins conflict resolution.** The row with the newer `updated_at` wins during merge. Acceptable for a single-user app; will need revision for multi-user.
5. **Grades always available.** `grades-seed.ts` ensures grades exist even before first sync.
6. **Reference data is read-only for users.** Users never push to reference tables.

---

## Tauri 2 Capabilities

Tauri 2 uses a capabilities-based permission system. Missing capability = silent failure. Declared in `src-tauri/capabilities/`.

| Capability | Reason |
|---|---|
| `core:default` | Core Tauri APIs |
| `sql:default`, `sql:allow-execute` | SQLite read/write |
| `deep-link:default` | Magic link callback handling |
