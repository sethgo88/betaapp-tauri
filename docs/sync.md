# Sync Guide

How BetaApp synchronizes data between local SQLite and Supabase.

---

## Overview

Two distinct sync types with different strategies:

| Type | Direction | Trigger | Tables |
|---|---|---|---|
| **User data sync** | Bidirectional | On mutation + startup + Realtime | `climbs`, `users` |
| **Reference data sync** | One-way pull | Startup + on demand | `grades_cache`, location caches |
| **Region download** | One-way pull | Explicit user action | `routes_cache`, sub-location caches |

---

## User Data Sync (Climbs)

### Push — local → Supabase

Triggered immediately after every successful local mutation (create/update/delete):

```
User creates/edits/deletes climb
        ↓
SQLite write succeeds
        ↓
isOnline?
  YES → sync.service.pushClimb(id) → Supabase upsert (match on UUID)
        update sync_meta.last_synced_at
  NO  → climb marked with updated_at < last_synced_at
        → will be caught by next startup pull
```

### Pull — Supabase → local (startup)

```
App launches + user is authenticated
        ↓
read sync_meta.last_synced_at
        ↓
fetch Supabase climbs WHERE updated_at > last_synced_at AND user_id = me
        ↓
for each remote row:
  upsert into local SQLite (INSERT OR REPLACE)
        ↓
update sync_meta.last_synced_at = now()
        ↓
invalidateQueries(['climbs'])
```

**First sync** (when `last_synced_at IS NULL`): fetch all rows for the user. No checkpoint filter.

### Realtime — Supabase → local (live)

Active while the app is open and authenticated:

```ts
supabase
  .channel('climbs-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'climbs', filter: `user_id=eq.${userId}` }, handler)
  .subscribe()
```

On `INSERT` or `UPDATE`: upsert the row into local SQLite → `invalidateQueries(['climbs'])`.
On `DELETE`: soft-delete the local row → `invalidateQueries(['climbs'])`.

Subscribe after login. Unsubscribe on logout.

---

## Conflict Resolution

**Last-write-wins via `updated_at`.**

During a pull, if a remote row has a newer `updated_at` than the local row, the remote wins. The SQLite `updated_at` trigger guarantees this timestamp is the true last-modified time (not application-set).

This is acceptable for a single-user app. Will need a revision strategy (e.g. operational transforms or merge fields) when multi-user editing of shared routes is added.

---

## Soft Deletes

```
User deletes climb
        ↓
isOnline?
  YES → hard delete locally → push DELETE to Supabase immediately
  NO  → set deleted_at = now() locally → hidden from UI
        → on next push cycle: hard delete locally + propagate to Supabase
```

All read queries filter `WHERE deleted_at IS NULL`. Soft-deleted rows never appear in the UI.

---

## Reference Data Sync

### Grades

```
App launch:
  read sync_meta.last_grades_synced_at
  fetch Supabase grades WHERE updated_at > last_grades_synced_at
  upsert into grades_cache
  update sync_meta.last_grades_synced_at = now()
  invalidateQueries(['grades'])

First install (grades_cache empty):
  grades.service.seedIfEmpty() runs from grades-seed.ts
  then pulls from Supabase to override with authoritative data
```

### Location Metadata

Countries and regions are always synced on launch (they are small, ~KB).
Sub-regions, crags, and walls are fetched on demand as the user navigates.

```
App launch:
  fetch all Supabase countries → upsert countries_cache
  fetch all Supabase regions (with route_count) → upsert regions_cache
  update sync_meta.last_locations_synced_at

User opens RegionView (regionId):
  check sub_regions_cache for rows WHERE region_id = regionId
  if stale or empty: fetch from Supabase → upsert sub_regions_cache

User opens CragView (cragId):
  check walls_cache for rows WHERE crag_id = cragId
  if stale or empty: fetch from Supabase → upsert walls_cache
```

---

## Region Download

Users can download all route data for a region to use offline. This mirrors Mountain Project's download feature.

### What a download includes
- All sub-regions, crags, walls for the region (if not already cached)
- All verified routes for every wall in the region
- Unverified routes submitted by the current user

### Download flow

```
User taps "Download Region" on RegionView
        ↓
downloads.service.downloadRegion(regionId):
  1. fetch sub_regions WHERE region_id = regionId → bulk upsert
  2. fetch crags WHERE sub_region_id IN (...) → bulk upsert
  3. fetch walls WHERE crag_id IN (...) → bulk upsert
  4. fetch routes WHERE wall_id IN (...) AND (is_verified = true OR created_by = me)
     → bulk upsert into routes_cache
  5. INSERT OR REPLACE INTO downloaded_regions (region_id, downloaded_at, route_count)
        ↓
invalidateQueries(['routes', regionId])
```

### Remove download

```
downloads.service.removeRegion(regionId):
  DELETE FROM routes_cache WHERE wall_id IN (walls for this region)
  DELETE FROM downloaded_regions WHERE region_id = regionId
  invalidateQueries(['routes', regionId])
```

Location metadata (sub-regions, crags, walls) is retained after removing a download — only routes are cleared.

---

## Sync State (Zustand)

```ts
// src/features/sync/sync.store.ts
interface SyncStore {
  isSyncing: boolean
  lastSyncedAt: string | null
  realtimeConnected: boolean
  error: string | null
}
```

`SyncStatus` molecule in the UI reads from this store to show sync indicators.

---

## Auth + Sync Lifecycle

```
App launch (not authenticated):
  Reference data sync runs (grades, countries, regions) — no auth required for SELECT
  User data sync skipped

User logs in via magic link:
  Session established → auth.store updated
  Full user data sync runs (push pending + pull all since last_synced_at)
  Realtime subscription started

App returns to foreground (authenticated):
  Pull sync runs (delta since last_synced_at)
  Realtime reconnects if disconnected

User logs out:
  Realtime subscription unsubscribed
  Local climbs data retained (local-first — data not deleted on logout)
  auth.store cleared
```
