# Database

## Overview

The app uses two databases:
- **SQLite** (local, always available) — primary data store and display source
- **Supabase** (hosted Postgres) — cloud sync mirror and reference data source

All reads come from SQLite. Supabase is only touched during sync, auth, and reference data pulls.

SQLite access is JS-side via `@tauri-apps/plugin-sql`. No Rust commands for data access.

---

## SQLite Schema

### `climbs` table — user's personal log

```sql
CREATE TABLE IF NOT EXISTS climbs (
    id               TEXT PRIMARY KEY,       -- UUID via crypto.randomUUID()
    user_id          TEXT,                   -- Supabase auth.users UUID (null = not yet linked to account)
    route_id         TEXT,                   -- references routes_cache.id, null = custom location
    is_custom_location INTEGER NOT NULL DEFAULT 0,  -- 1 when no official route linked

    -- log data
    route_type       TEXT NOT NULL,          -- 'sport' | 'boulder'
    grade            TEXT NOT NULL,          -- denormalized from route or custom
    moves            TEXT,                   -- beta description (freeform)
    sent_status      TEXT NOT NULL,          -- 'send' | 'project' | 'redpoint' | 'flash' | 'onsight'
    notes            TEXT,

    -- freeform location (used when is_custom_location = 1)
    custom_name      TEXT,
    custom_country   TEXT,
    custom_region    TEXT,
    custom_crag      TEXT,
    custom_wall      TEXT,

    -- sync
    deleted_at       TEXT,                   -- null = active, ISO 8601 = soft-deleted
    created_at       TEXT NOT NULL,          -- ISO 8601
    updated_at       TEXT NOT NULL           -- ISO 8601 — maintained by trigger
);

CREATE INDEX IF NOT EXISTS idx_climbs_user_id ON climbs(user_id);
CREATE INDEX IF NOT EXISTS idx_climbs_route_id ON climbs(route_id);
```

**`updated_at` trigger:**
```sql
CREATE TRIGGER climbs_updated_at
AFTER UPDATE ON climbs
FOR EACH ROW
BEGIN
    UPDATE climbs
    SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = OLD.id;
END;
```

**Rules:**
- Never set `updated_at` from the application layer on UPDATE — the trigger handles it.
- Always filter `WHERE deleted_at IS NULL` on every read query.
- `sent_status` display: Phase 2–5 shows only `'send'` and `'project'` in UI. All five values are valid in the schema.

---

### `users` table — local profile cache

```sql
CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,   -- Supabase auth.users UUID
    email       TEXT,
    first_name  TEXT,
    last_name   TEXT,
    role        TEXT NOT NULL DEFAULT 'user',  -- 'user' | 'admin'
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
```

Single row. Populated and updated from Supabase after login.

---

### `grades_cache` table — reference data, seeded locally

```sql
CREATE TABLE IF NOT EXISTS grades_cache (
    id          TEXT PRIMARY KEY,   -- UUID from Supabase (or 'seed-{n}' for seed data)
    route_type  TEXT NOT NULL,      -- 'sport' | 'boulder'
    value       TEXT NOT NULL,      -- '5.10a', 'V5', etc.
    sort_order  INTEGER,
    updated_at  TEXT NOT NULL
);
```

Seeded from `src/features/grades/grades-seed.ts` on first install. Overwritten by Supabase on sync. UI always reads from this table.

---

### Location hierarchy cache tables

These mirror the Supabase reference tables. Admin-managed, read-only for users.

```sql
-- Always synced on app launch (lightweight)
CREATE TABLE IF NOT EXISTS countries_cache (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    code        TEXT,               -- ISO 3166-1 alpha-2
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS regions_cache (
    id           TEXT PRIMARY KEY,
    country_id   TEXT NOT NULL,
    name         TEXT NOT NULL,
    route_count  INTEGER DEFAULT 0,
    updated_at   TEXT NOT NULL
);

-- Cached on-demand as user navigates
CREATE TABLE IF NOT EXISTS sub_regions_cache (
    id          TEXT PRIMARY KEY,
    region_id   TEXT NOT NULL,
    name        TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS crags_cache (
    id             TEXT PRIMARY KEY,
    sub_region_id  TEXT NOT NULL,
    name           TEXT NOT NULL,
    description    TEXT,
    latitude       REAL,
    longitude      REAL,
    updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS walls_cache (
    id          TEXT PRIMARY KEY,
    crag_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    updated_at  TEXT NOT NULL
);
```

---

### `routes_cache` table — populated on region download

```sql
CREATE TABLE IF NOT EXISTS routes_cache (
    id              TEXT PRIMARY KEY,
    wall_id         TEXT NOT NULL,
    name            TEXT NOT NULL,
    route_type      TEXT NOT NULL,
    grade           TEXT NOT NULL,   -- denormalized (grade value string)
    moves           TEXT,            -- beta description
    description     TEXT,
    created_by      TEXT,            -- Supabase user UUID who submitted it
    is_verified     INTEGER NOT NULL DEFAULT 0,
    updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_routes_cache_wall_id ON routes_cache(wall_id);
```

Only populated when the user explicitly downloads a region. Routes where `is_verified = 0` are only shown if `created_by = current_user_id`.

---

### `downloaded_regions` table — download tracking (local only)

```sql
CREATE TABLE IF NOT EXISTS downloaded_regions (
    region_id      TEXT PRIMARY KEY,
    downloaded_at  TEXT NOT NULL,    -- ISO 8601
    route_count    INTEGER
);
```

---

### `sync_meta` table

```sql
CREATE TABLE IF NOT EXISTS sync_meta (
    id              INTEGER PRIMARY KEY DEFAULT 1,
    last_synced_at  TEXT,    -- null = never synced
    last_grades_synced_at TEXT,
    last_locations_synced_at TEXT
);

INSERT INTO sync_meta (id) VALUES (1);
```

---

## Migrations

Migrations are defined in `src-tauri/src/lib.rs` as a Rust array passed to `tauri-plugin-sql`. They run in version order on every app launch (skipping already-applied).

```rust
let migrations = vec![
    tauri_plugin_sql::Migration {
        version: 1,
        description: "initial_schema",
        sql: "
            CREATE TABLE IF NOT EXISTS climbs ( ... );
            CREATE TRIGGER climbs_updated_at ...;
            CREATE TABLE IF NOT EXISTS users ( ... );
            CREATE TABLE IF NOT EXISTS grades_cache ( ... );
            CREATE TABLE IF NOT EXISTS countries_cache ( ... );
            CREATE TABLE IF NOT EXISTS regions_cache ( ... );
            CREATE TABLE IF NOT EXISTS sub_regions_cache ( ... );
            CREATE TABLE IF NOT EXISTS crags_cache ( ... );
            CREATE TABLE IF NOT EXISTS walls_cache ( ... );
            CREATE TABLE IF NOT EXISTS routes_cache ( ... );
            CREATE TABLE IF NOT EXISTS downloaded_regions ( ... );
            CREATE TABLE IF NOT EXISTS sync_meta ( ... );
            INSERT INTO sync_meta (id) VALUES (1);
        ",
        kind: tauri_plugin_sql::MigrationKind::Up,
    },
];
```

**Rules:**
- Never modify existing migration SQL — it has already run on deployed devices
- Each migration is immutable once released
- New column? New migration. New table? New migration.
- Always use `IF NOT EXISTS` / `IF EXISTS` in DDL

---

## Supabase Schema

Supabase is the cloud source of truth for user data and reference data.

### User data tables (RLS: users see only their own rows)

```sql
-- Mirrors local users table
create table public.users (
    id          uuid primary key references auth.users,
    email       text,
    first_name  text,
    last_name   text,
    role        text not null default 'user',
    created_at  timestamptz default now(),
    updated_at  timestamptz default now(),
    deleted_at  timestamptz
);

-- RLS
alter table public.users enable row level security;
create policy "Users manage own profile"
    on public.users for all using (auth.uid() = id);

-- Mirrors local climbs table
create table public.climbs (
    id               uuid primary key,
    user_id          uuid references auth.users not null,
    route_id         uuid references public.routes,
    is_custom_location boolean default false,
    route_type       text not null,
    grade            text not null,
    moves            text,
    sent_status      text not null default 'project',
    notes            text,
    custom_name      text,
    custom_country   text,
    custom_region    text,
    custom_crag      text,
    custom_wall      text,
    created_at       timestamptz default now(),
    updated_at       timestamptz default now(),
    deleted_at       timestamptz
);

-- RLS
alter table public.climbs enable row level security;
create policy "Users manage own climbs"
    on public.climbs for all using (auth.uid() = user_id);
```

### Reference data tables (RLS: authenticated users SELECT only, service role writes)

```sql
create table public.grades (
    id          uuid primary key default gen_random_uuid(),
    route_type  text not null,
    value       text not null,
    sort_order  integer,
    updated_at  timestamptz default now()
);

create table public.countries   (id uuid pk, name text, code text, updated_at);
create table public.regions     (id uuid pk, country_id uuid references countries, name text, route_count integer default 0, updated_at);
create table public.sub_regions (id uuid pk, region_id uuid references regions, name text, updated_at);
create table public.crags       (id uuid pk, sub_region_id uuid references sub_regions, name text, description text, latitude decimal, longitude decimal, updated_at);
create table public.walls       (id uuid pk, crag_id uuid references crags, name text, description text, updated_at);

-- Routes (user-contributed, admin-verified)
create table public.routes (
    id          uuid primary key default gen_random_uuid(),
    wall_id     uuid references public.walls not null,
    name        text not null,
    route_type  text not null,
    grade       text not null,
    moves       text,
    description text,
    created_by  uuid references auth.users,
    is_verified boolean default false,
    updated_at  timestamptz default now(),
    deleted_at  timestamptz
);

-- RLS for reference tables: all authenticated users can SELECT
-- Only verified routes visible to all; unverified visible to creator only
create policy "Authenticated users can read grades"
    on public.grades for select using (auth.role() = 'authenticated');

create policy "Authenticated users can read locations"
    on public.countries for select using (auth.role() = 'authenticated');
-- (repeat for regions, sub_regions, crags, walls)

create policy "Users can read verified routes or own submissions"
    on public.routes for select using (
        is_verified = true OR auth.uid() = created_by
    );

create policy "Users can submit routes"
    on public.routes for insert with check (auth.uid() = created_by);
```

---

## Sync Strategy

### User data (climbs) — last-write-wins via `updated_at`

1. **Push:** On mutation (create/update), immediately upsert to Supabase if online. Match on `id` (same UUID in both stores).
2. **Startup pull:** Fetch all `climbs` where `updated_at > last_synced_at` and `user_id = me`. Upsert into local SQLite.
3. **Realtime:** Supabase Realtime subscription on `climbs` for current `user_id`. On INSERT/UPDATE: upsert locally. On DELETE: soft-delete locally.
4. **Soft deletes:** Set `deleted_at = now()` locally, propagate to Supabase on next sync. Hard-delete once confirmed pushed.

### Reference data — one-way pull only

- **Grades:** Pull from Supabase `grades` where `updated_at > last_grades_synced_at`. Upsert into `grades_cache`.
- **Countries/Regions:** Pull all on app launch (they are small). Upsert into local cache.
- **Sub-regions/Crags/Walls:** Fetch on demand as user navigates. Cache locally.
- **Routes:** Only fetched when user downloads a region. Stored in `routes_cache`.

### ID strategy
All records use the same UUID in both SQLite and Supabase — no ID mapping layer. `crypto.randomUUID()` generates IDs client-side before insert.

---

## SQLite Type Conventions

| TypeScript | SQLite | Notes |
|---|---|---|
| `string` (UUID) | `TEXT` | Primary and foreign keys |
| `string` (ISO 8601) | `TEXT` | Dates — sort as strings correctly |
| `boolean` | `INTEGER` | 0 = false, 1 = true |
| `number` | `REAL` or `INTEGER` | |
| `string \| null` | `TEXT` | Nullable |
