# BetaApp — CLAUDE.md

> Global rules (workflow, git, TypeScript, Biome) are in `/c/web/CLAUDE.md`. This file covers only what's specific to this project.

## Git Workflow
- **Never commit or write code directly on `master`.** Always create a feature branch first (`feat/`, `fix/`, `chore/`, `docs/`) and check it out before making any changes.
- Branch from `master` for all new work.
- Merge back to `master` via PR.

## Project Overview
Tauri 2 + React 19 + TypeScript **Android-only** app for personal climbing route logging and beta tracking.
Local-first SQLite. Supabase for cloud sync and auth (email/password; magic link planned). Admin-managed reference data (grades, location hierarchy, routes).

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
React 19, TanStack Router (memory history), TanStack Query, TanStack Form, Zustand, Zod v4, Tailwind CSS, Biome, tauri-plugin-sql (SQLite), tauri-plugin-deep-link, @supabase/supabase-js, Leaflet + react-leaflet (interactive maps)

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
  features/burns/          # burns.queries, burns.service, burns.schema
  features/routes/         # routes.queries, routes.service, routes.schema
  features/locations/      # locations.queries, locations.service, downloads.service
  features/map/            # map.service, map.queries (personal crags for map view)
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
| `climbs` | Current user | Bidirectional, full push/pull (Realtime planned) |
| `burns` | Current user | Bidirectional, full push/pull |
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
- **Sync: full push/pull** — push all local climbs then pull all server climbs on demand; delta sync + Realtime planned for a later phase
- **Design tokens** — see `.claude/rules/design.md` for full token/theme/font rules
- **Grades seed** — `grades-seed.ts` populates `grades_cache` on first install; Supabase overrides on sync
- **Admin role** — fetched from `user_roles` Supabase table after login; gates admin views in UI; Supabase RLS enforces on backend
- **Auth details** — see `.claude/rules/auth.md` for Supabase auth, credentials, and RLS rules

## Android
- Bundle ID: `com.betaapp.app`
- Android-only — no desktop target
- Deep link scheme: `betaapp://auth/callback` (plugin registered; magic link auth wired in a future phase)
- Back button: `onBackButtonPress` → navigate back or close from root
- Capabilities: `core:default`, `sql:default`, `sql:allow-execute`, `deep-link:default`
- Permissions: `INTERNET`, `ACCESS_NETWORK_STATE`
- Safe areas: `env(safe-area-inset-top/bottom)` — see `docs/android.md`
- **APK signing:** Sign both debug and release build types with the same keystore (set `signingConfig = signingConfigs.getByName("release")` on the debug build type). Store passwords in `local.properties` (gitignored), not hardcoded in `build.gradle.kts`. This lets you swap between `cargo tauri android dev` and the installed release APK without uninstalling. See moviedb `src-tauri/gen/android/app/build.gradle.kts` for reference.

## Supabase
- Auth: email/password (`signInWithPassword`); magic link planned
- Role: stored in `user_roles` table, fetched after login
- RLS on `climbs`: `user_id = auth.uid()`
- RLS on reference tables: authenticated users SELECT only; service role writes
- RLS on `routes`: `verified = true` visible to all; unverified visible to `created_by` only
- Realtime: planned (not yet implemented)

## Documentation Maintenance

**Docs must be updated before every commit.** Check this table after every code change:

| Change | Update |
|---|---|
| New library or tech choice | `docs/stack.md` |
| Schema change (SQLite or Supabase) | Feature `README.md` in the relevant `src/features/<domain>/` |
| New service function, query hook, or store | Feature `README.md` in the relevant `src/features/<domain>/` |
| New component | `src/components/README.md` |
| New hook | `src/hooks/README.md` |
| New view or route | `src/views/README.md` + `docs/architecture.md` (Route Structure) |
| db.ts change (new table or column) | `src/lib/README.md` |
| Sync or auth flow change | `src/features/sync/README.md` or `src/features/auth/README.md` + `docs/architecture.md` |
| Tauri command / capability / deep link | `docs/android.md` + `docs/architecture.md` |
| Dev environment setup | `docs/setup.md` |

## Task Management

GitHub Issues is the task management system for this project (repo: `sethgo88/betaapp-tauri`).

### Issue structure
- Each feature, bug, or work item gets its own issue
- Use sub-issues to break larger tasks into discrete implementation steps
- Label every issue by type: `feature`, `bug`, `chore`, `docs`
- Use milestones to group issues by release or sprint

### Issue format
- **Title:** short and imperative (e.g. "Add offline map tile caching")
- **Body:** what needs to be done and why, acceptance criteria, relevant links or context
- **Sub-issues:** one per distinct implementation step

### Workflow
1. Before starting any new work, run `list issues` to check open issues and current priorities
2. Never start work without a corresponding issue — create one first if it doesn't exist
3. **Before touching any file, create or checkout the branch for the issue.** Run `git branch --show-current`; if on `master`, run `git checkout -b feat/<description>` (or `fix/`, `phase/` as appropriate). If a branch for the issue already exists, check it out instead.
4. Reference the issue number in every commit message (e.g. `feat: add route snapping, closes #14`)
5. When a task is complete, close the issue and leave a brief comment summarising what was done
6. If work reveals new tasks or edge cases, open new issues rather than expanding scope of the current one

