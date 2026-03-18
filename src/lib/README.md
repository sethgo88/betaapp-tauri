# src/lib

Shared singletons and utilities. Nothing in this folder contains JSX or feature-specific logic.

---

## db.ts — SQLite client

```ts
import { getDb } from '@/lib/db'

const db = await getDb()
const rows = await db.select<MyType[]>('SELECT * FROM my_table WHERE id = ?', [id])
await db.execute('INSERT INTO my_table (id, name) VALUES (?, ?)', [id, name])
```

`getDb()` is lazy — it opens the database connection once, runs `runMigrations()` to apply any pending schema migrations, then returns the same instance on every subsequent call.

### runMigrations()

Versioned migration runner. Maintains a `schema_version` table (single row) and applies each pending migration in order, incrementing the version after each one.

**Bootstrapping existing installs** — on first run after upgrading from the old `initSchema()` pattern, if the `climbs` table already exists the runner bootstraps at v3 (the last migration already applied by the old try/catch pattern), then applies only new migrations.

**Adding a new migration** — append a new async function to the `migrations` array. Do not modify existing migrations.

### Tables managed by db.ts

| Table | Purpose |
|---|---|
| `schema_version` | Single-row version counter for the migration runner |
| `users` | Local user profile (single row per device) |
| `climbs` | User climb log (local-first, synced to Supabase) |
| `grades_cache` | Grade reference data (seeded + Supabase sync) |
| `countries_cache`, `regions_cache` | Location reference (always synced on launch) |
| `sub_regions_cache`, `crags_cache`, `walls_cache` | Location reference (on-demand download) |
| `routes_cache` | Route reference (downloaded per region) |
| `downloaded_regions` | Tracks which regions have been downloaded; `server_updated_at` stores the server timestamp at download time for staleness checks |
| `sync_meta` | Single-row singleton; persists `last_synced_at` for delta sync |
| `burns` | Individual attempt/send records per climb (#14) |
| `route_links` | External video/image/beta links attached to routes (#13) |
| `route_images_cache` | Admin-managed route photos (read-only cache) (#11) |
| `wall_images_cache` | Admin-managed wall photos (read-only cache) (#11) |
| `climb_images` | User-uploaded photos per climb log entry (#12) |

### Migration history

| Version | Change |
|---|---|
| v1 | Baseline tables: users, climbs, grades/location/routes caches, downloaded_regions, sync_meta, updated_at triggers |
| v2 | `climbs.route_id` |
| v3 | `routes_cache.status`; `status` + `created_by` on sub_regions/crags/walls caches |
| v4 | User profile fields: display_name, height_cm, ape_index_cm, max_redpoint_sport, max_redpoint_boulder, default_unit (#5) |
| v5 | `description` on sub_regions/crags/walls caches (#8) |
| v6 | `burns` table + updated_at trigger (#14) |
| v7 | `route_links` table (#13) |
| v8 | `route_images_cache` + `wall_images_cache` tables (#11) |
| v9 | `climb_images` table (#12) |
| v10 | `lat`, `lng` on crags_cache (#15) |
| v11 | `lat`, `lng` on walls_cache (#15) |
| v12 | `wall_type`, `sport_count`, `trad_count`, `boulder_count` on walls_cache; `sport_count`, `trad_count`, `boulder_count` on crags_cache (#25) |
| v13 | Restructure `route_images_cache` + `wall_images_cache` (`url`→`image_url`, drop `caption`, add `uploaded_by`) (#11) |
| v14 | Restructure `climb_images` (`url`→`image_url`, drop `caption`); add `climb_image_pins` table (#32) |
| v15 | `server_updated_at` on `downloaded_regions` for staleness detection (#31) |
| v16 | `pointer_dir` on `climb_image_pins` (#38) |
| v17 | Backfill `server_updated_at` on `downloaded_regions` for devices that skipped v15 |

### Rules
- Always use `?` positional parameters — never string interpolation (SQL injection)
- Always filter `WHERE deleted_at IS NULL` on every read
- Never import `db.ts` directly in views or components — only in `*.service.ts` files
- `updated_at` is maintained by DB trigger on UPDATE — never set it on UPDATE from app code
- Dates: stored as `TEXT` in `datetime('now')` format (`YYYY-MM-DD HH:MM:SS`)

### Type conventions

| TypeScript | SQLite | Notes |
|---|---|---|
| `string` (UUID) | `TEXT` | All primary and foreign keys |
| `string` (datetime) | `TEXT` | `datetime('now')` format |
| `boolean` | `INTEGER` | 0 = false, 1 = true |
| `number` | `REAL` or `INTEGER` | |
| `string \| null` | `TEXT` | Nullable columns |

---

## image-utils.ts — image resize, compress, and upload

```ts
import { resizeAndCompress, uploadToStorage } from '@/lib/image-utils'
```

### `resizeAndCompress(file, maxPx?, quality?): Promise<Blob>`

Resizes and compresses an image file using the Canvas API. Caps the longest dimension at `maxPx` (default 1920px) and encodes as JPEG at `quality` (default 0.8 ≈ 80%). Returns a `Blob`. No external libraries.

```ts
const blob = await resizeAndCompress(file)           // ~400KB average output
const blob = await resizeAndCompress(file, 800, 0.7) // thumbnail variant
```

### `uploadToStorage(bucket, path, file): Promise<string>`

Calls `resizeAndCompress` then uploads the result to Supabase Storage. Returns the **storage path** (e.g. `userId/climbId/uuid.jpg`) — not a full URL. Callers derive a displayable URL:

```ts
// Public bucket (e.g. route-images):
const { data } = supabase.storage.from(bucket).getPublicUrl(path)
const url = data.publicUrl

// Private bucket (e.g. climb-images):
const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
const url = data?.signedUrl
```

Storage buckets used by this app:
| Bucket | Access | Used by |
|---|---|---|
| `route-images` | Public | #11 — admin route/wall photos |
| `climb-images` | Private (RLS: `user_id`) | #32 — user climb beta photos |

---

## supabase.ts — Supabase client

```ts
import { supabase } from '@/lib/supabase'
```

Configured singleton using `@supabase/supabase-js` with the generated `Database` type from `database.types.ts`.

Credentials come from environment variables — create a `.env` or `.env.local` in the project root (both are gitignored):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

The client throws at import time if either variable is missing.

---

## cn.ts — conditional class composition

```ts
import { cn } from '@/lib/cn'

<div className={cn('base-class', isActive && 'active-class', className)} />
```

Wraps `clsx` + `tailwind-merge`. Use for all conditional Tailwind class composition.

---

## units.ts — imperial/metric conversion

```ts
import { cmToFt, ftToCm, cmToIn, inToCm } from '@/lib/units'
```

Helpers for converting between cm and ft/in. Used by the profile page for height and ape index inputs. All values stored as cm in the database.

---

## map-tiles.ts — shared tile layer definitions

```ts
import { tileLayers } from '@/lib/map-tiles'
```

Array of `TileLayerDef` objects (id, name, url, attribution, icon) used by both `MapView` and `CoordinatePicker`. Layers: Street (OSM), Satellite (Stadia Alidade Satellite — requires `VITE_STADIA_API_KEY` in `.env`).

---

## database.types.ts

Auto-generated Supabase TypeScript types. Regenerate with:

```bash
pnpm supabase gen types typescript --project-id <id> > src/lib/database.types.ts
```

Do not edit this file manually.
