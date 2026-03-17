# features/sync

Orchestrates data synchronisation between local SQLite and Supabase. Also manages the Supabase Realtime subscription for live climb updates.

---

## sync.service.ts

### `getSyncMeta()`
Reads the `sync_meta` singleton row from SQLite. Returns `{ last_synced_at: string | null }`.

### `setSyncMeta(lastSyncedAt)`
Writes the new `last_synced_at` timestamp to the `sync_meta` singleton row.

### `pushClimbs(userId, since?)`
Upserts local climbs to Supabase (matching on `id`), including soft-deleted rows.
- **Full push** (no `since`): pushes all climbs for the user — used on first sync.
- **Delta push** (`since` provided): only pushes climbs with `updated_at > since`.

### `pullClimbs(userId, since?)`
Fetches climbs from Supabase and applies them locally via `INSERT OR REPLACE` (preserves server timestamps, bypasses the `updated_at` trigger).
- **Full pull** (no `since`): fetches all climbs for the user.
- **Delta pull** (`since` provided): only fetches climbs with `updated_at > since`.

### `pushClimbImages(userId, since?)` / `pullClimbImages(userId, since?)`
Push/pull `climb_images` rows scoped by `user_id`. Delta uses `created_at` (images are immutable once created — only soft-deleted).

### `pushClimbImagePins(userId, since?)` / `pullClimbImagePins(userId, since?)`
Push/pull `climb_image_pins` rows scoped to the user's images (via JOIN on `climb_images.user_id`). Pull strips the JOIN column before applying locally.

### `pushRouteLinks(userId, since?)` / `pullRouteLinks(since?)`
Push/pull community-shared `route_links`. Push is scoped to `user_id`; pull fetches all links (no user filter — community data). Delta uses `created_at`. Deletions are handled directly in `deleteRouteLink()` (Supabase soft-delete + local hard-delete) rather than via sync.

---

## sync.store.ts

```ts
type SyncStatus = 'idle' | 'syncing' | 'error'

interface SyncStore {
  status: SyncStatus
  lastSyncedAt: string | null  // in-memory only; persisted copy is in sync_meta SQLite table
  error: string | null
  setSyncing: () => void
  setSuccess: () => void
  setError: (error: string) => void
}
```

`SyncStatus` molecule reads from this store to render sync indicators in the UI.

---

## useSync hook

`src/hooks/useSync.ts` — the main sync orchestrator. Call it once in the root layout, passing `userId` from `auth.store`.

**What it does on mount (when `userId` is defined):**
1. Reads `last_synced_at` from `sync_meta` (persisted in SQLite)
2. **First sync** (`last_synced_at = null`): full `pushClimbs` + full `pullClimbs`
3. **Subsequent syncs**: delta `pushClimbs(since)` + delta `pullClimbs(since)` — only climbs modified after the last sync timestamp
4. `pullGrades()` → `pullCountries()` → `pullRegions()` (always full — reference data is small)
5. Writes new `last_synced_at` to `sync_meta`
6. Invalidates all relevant query keys → UI refreshes

**Realtime subscription (live updates between syncs):**
- Subscribes to `postgres_changes` on `climbs` filtered by `user_id`
- On INSERT/UPDATE: calls `applyRemoteClimb(payload.new)` + invalidates `['climbs']`
- Soft deletes arrive as UPDATE with `deleted_at` set — handled correctly

**Cleanup:** Realtime channel is removed when `userId` becomes undefined (logout).

---

## Conflict resolution

Last-write-wins via `updated_at`. During a pull, `INSERT OR REPLACE` applies the server row unconditionally. The server is considered the source of truth after a successful push. The SQLite trigger guarantees `updated_at` is the true last-modified time — never set by application code on UPDATE.

---

## Auth + sync lifecycle

```
App launch:
  useSync receives userId = undefined → no sync, no Realtime

User logs in → userId set in auth.store:
  useSync fires
  Reads last_synced_at from sync_meta
  → null: full push → full pull → reference data pull → write last_synced_at
  → set: delta push → delta pull → reference data pull → write last_synced_at
  Realtime subscription starts (live updates from this point)

User logs out → userId becomes undefined:
  useSync cleanup: Realtime channel removed
  Local data retained (local-first — not deleted on logout)
  last_synced_at persists in sync_meta for next login
```
