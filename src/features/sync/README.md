# features/sync

Orchestrates data synchronisation between local SQLite and Supabase. Also manages the Supabase Realtime subscription for live climb updates.

---

## sync.service.ts

Two functions, always called in order (push before pull):

### `pushClimbs(userId)`
Reads **all** local climbs for the user (including soft-deleted) and upserts them to Supabase, matching on `id`. Soft-deleted rows carry their `deleted_at` timestamp to Supabase.

### `pullClimbs(userId)`
Fetches **all** climbs from Supabase for `user_id = userId` and applies them locally via `INSERT OR REPLACE`. This bypasses the `updated_at` trigger so the server timestamp is preserved exactly.

> **No delta sync yet.** Both push and pull are full operations. A checkpoint-based approach (filtering by `last_synced_at`) is planned for a later phase.

---

## sync.store.ts

```ts
type SyncStatus = 'idle' | 'syncing' | 'error'

interface SyncStore {
  status: SyncStatus
  lastSyncedAt: string | null
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
1. Calls `setSyncing()`
2. `pushClimbs(userId)` → `pullClimbs(userId)`
3. `pullGrades()` → `pullCountries()` → `pullRegions()`
4. Invalidates all relevant query keys
5. Calls `setSuccess()` (or `setError()` on failure)
6. Opens a Supabase Realtime channel on `climbs` filtered by `user_id`

**Realtime handler:**
- On INSERT/UPDATE: calls `applyRemoteClimb(payload.new)` + invalidates `['climbs']`
- Does not handle DELETE events yet (soft deletes come through as UPDATE with `deleted_at` set)

**Cleanup:** The Realtime channel is removed when `userId` becomes undefined (logout).

---

## Conflict resolution

Last-write-wins via `updated_at`. During a pull, `INSERT OR REPLACE` applies the server row unconditionally. The server is considered the source of truth after a successful push. The SQLite trigger guarantees `updated_at` is the true last-modified time — never set by application code on UPDATE.

---

## Auth + sync lifecycle

```
App launch:
  useSync receives userId = undefined → no sync, no Realtime

User logs in → userId set in auth.store:
  useSync fires: full push → full pull → reference data pull
  Realtime subscription starts

User logs out → userId becomes undefined:
  useSync cleanup: Realtime channel removed
  Local data retained (local-first — not deleted on logout)
```
