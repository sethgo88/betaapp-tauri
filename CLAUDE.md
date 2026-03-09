# BetaApp — CLAUDE.md

> Global rules (workflow, git, TypeScript, Biome) are in `/c/web/CLAUDE.md`. This file covers only what's specific to this project.

## Project Overview
Tauri 2 + React 19 + TypeScript **Android-only** app for personal climbing route logging and beta tracking.
Local-first SQLite. Supabase for cloud sync and auth (magic link). Admin-managed reference data (grades, location hierarchy, routes).

## Key Commands
```bash
cargo tauri android dev
cargo tauri android build --debug
cargo tauri android build --release
pnpm lint          # biome check .
pnpm format        # biome format --write .
pnpm typecheck     # tsc --noEmit
```

## Stack
React 19, TanStack Router (memory history), TanStack Query, TanStack Form, Zustand, Zod v4, Tailwind CSS, Biome, tauri-plugin-sql (SQLite), tauri-plugin-deep-link (magic link), @supabase/supabase-js

## Folder Structure
```
src/
  components/atoms/        # Button, Badge, Input, Select, Spinner, TextArea
  components/molecules/    # FormField, ClimbCard, SyncStatus, GradeSelector, LocationPicker
  components/organisms/    # ClimbList, NavBar, ClimbForm, FilterPanel, RouteCard
  components/templates/    # AppLayout, ModalLayout
  views/                   # HomeView, AddClimbView, ClimbDetailView, EditClimbView
                           # RoutesView, RegionView, CragView
                           # ProfileView, SettingsView
                           # admin/LocationManagerView, GradesManagerView, RouteVerificationView
  features/climbs/         # climbs.store, climbs.queries, climbs.service, climbs.schema
  features/routes/         # routes.queries, routes.service, routes.schema
  features/locations/      # locations.queries, locations.service, downloads.service
  features/grades/         # grades.queries, grades.service, grades.schema, grades-seed.ts
  features/sync/           # sync.store, sync.service
  features/auth/           # auth.store, auth.service, auth.schema
  lib/                     # db.ts, supabase.ts, cn.ts, date.ts
  hooks/                   # useAndroidBackButton, useOnlineStatus, useSync, useAuth
```

## Path Aliases
`@/` resolves to `src/`. Use in all imports: `import { db } from '@/lib/db'`

## Data Domains
| Domain | Owner | Sync direction |
|---|---|---|
| `climbs` | Current user | Bidirectional, real-time |
| `users` | Current user | Bidirectional |
| `grades_cache` | Admin | One-way pull; seeded from `grades-seed.ts` |
| `countries_cache`, `regions_cache` | Admin | One-way pull; always synced on launch |
| `sub_regions_cache`, `crags_cache`, `walls_cache` | Admin | One-way pull; on-demand |
| `routes_cache` | Community (admin-verified) | One-way pull; only on region download |

## Key Architectural Decisions
- **Memory history** — `createMemoryHistory({ initialEntries: ['/'] })` required for Android WebView
- **JS-side SQLite** — all DB access via `@tauri-apps/plugin-sql` through `src/lib/db.ts`, no Rust data commands
- **TanStack Query for everything async** — no useEffect for data fetching
- **Zod v4 + safeParse** — no zod-form-adapter; use `.safeParse()` directly in TanStack Form validators
- **updated_at trigger** — never set from app layer on UPDATE; trigger maintains it
- **Soft deletes** — `deleted_at` column; all reads filter `WHERE deleted_at IS NULL`
- **Sync: last-write-wins** — via `updated_at`; Supabase Realtime for live updates while online
- **Grades seed** — `grades-seed.ts` populates `grades_cache` on first install; Supabase overrides on sync
- **Custom location fallback** — `is_custom_location = true` when no region downloaded; upgradeable in edit view
- **Admin role** — `users.role = 'admin'` gates admin views in UI; Supabase RLS enforces on backend
- **Supabase credentials** — stored in Tauri secure store, never hardcoded

## Android
- Bundle ID: `com.betaapp.app`
- Android-only — no desktop target
- Deep link scheme: `betaapp://auth/callback` (magic link)
- Back button: `onBackButtonPress` → navigate back or close from root
- Capabilities: `core:default`, `sql:default`, `sql:allow-execute`, `deep-link:default`
- Permissions: `INTERNET`, `ACCESS_NETWORK_STATE`
- Safe areas: `env(safe-area-inset-top/bottom)` — see `docs/android.md`

## Supabase
- RLS on `climbs`: `user_id = auth.uid()`
- RLS on reference tables: authenticated users SELECT only; service role writes
- RLS on `routes`: verified visible to all; unverified visible to creator only
- Realtime channel: `climbs` filtered by `user_id`

## Documentation Maintenance
| Change | Update |
|---|---|
| New library | `docs/stack.md` |
| New pattern | `docs/patterns.md` |
| Schema change | `docs/database.md` |
| Tauri command / capability / deep link | `docs/android.md` + `docs/architecture.md` |
| Sync or auth flow | `docs/sync.md` + `docs/architecture.md` |
| Setup step | `docs/setup.md` |

## Phase Status
- [x] Phase 1: Docs + CLAUDE.md
- [ ] Phase 2: Frontend architecture (TanStack Router, Zustand, TanStack Query, Zod, Add/Edit split, react-icons → lucide-react)
- [ ] Phase 3: SQLite schema modernization (updated_at triggers, soft deletes, reference cache tables)
- [ ] Phase 4: Supabase setup + auth (magic link, deep link, session storage, role detection)
- [ ] Phase 5: Climb sync (climbs ↔ Supabase, Realtime subscription)
- [ ] Phase 6: Grades (seed + Supabase sync)
- [ ] Phase 7: Location metadata sync (countries + regions)
- [ ] Phase 8: Admin — location management views
- [ ] Phase 9: Route system (browse → download → add route)
- [ ] Phase 10: Custom location + upgrade flow
- [ ] Phase 11: Android polish (CSP, deep links, back button, APK signing)
