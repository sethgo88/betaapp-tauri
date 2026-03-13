# features/climbs

Personal climb log. The user's primary data — local-first, synced bidirectionally with Supabase.

---

## Schema

```ts
// climbs.schema.ts
SentStatus = 'todo' | 'project' | 'sent' | 'redpoint' | 'flash' | 'onsight'
RouteType  = 'sport' | 'boulder'

ClimbSchema = {
  id: string
  user_id: string
  name: string           // route name (freeform)
  route_type: RouteType
  grade: string
  moves: string          // JSON array default '[]'
  sent_status: SentStatus
  country?: string
  area?: string
  sub_area?: string
  route_location?: string
  link?: string
  route_id?: string      // optional link to routes_cache
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

ClimbFormSchema = ClimbSchema minus (id, route_id, created_at, updated_at, deleted_at)
// route_id is passed separately to insertClimb/updateClimb, not part of the form
```

---

## SQLite table

```sql
CREATE TABLE IF NOT EXISTS climbs (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL,
    name             TEXT NOT NULL,
    route_type       TEXT NOT NULL DEFAULT 'sport',
    grade            TEXT NOT NULL,
    moves            TEXT NOT NULL DEFAULT '[]',
    sent_status      TEXT NOT NULL DEFAULT 'project',
    country          TEXT,
    area             TEXT,
    sub_area         TEXT,
    route_location   TEXT,
    link             TEXT,
    route_id         TEXT,
    deleted_at       TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
-- updated_at maintained by trigger (climbs_updated_at)
```

---

## climbs.service.ts

| Function | What it does |
|---|---|
| `fetchClimbs(userId)` | All active climbs for user, newest first |
| `fetchClimb(id)` | Single climb by id |
| `insertClimb(userId, data, routeId?)` | Creates new climb; `routeId` links to a verified route |
| `updateClimb(id, data, routeId?)` | Updates mutable fields; trigger stamps `updated_at` |
| `linkClimbToRoute(climbId, routeId)` | Sets `route_id` without changing other fields (upgrade flow) |
| `softDeleteClimb(id)` | Sets `deleted_at = datetime('now')` |
| `applyRemoteClimb(climb)` | `INSERT OR REPLACE` — preserves server `updated_at`; used by sync + Realtime |

**`applyRemoteClimb` vs `insertClimb`:** Always use `applyRemoteClimb` when writing data received from Supabase. It bypasses the `updated_at` trigger so the server timestamp is preserved exactly.

---

## climbs.queries.ts

| Hook | Returns |
|---|---|
| `useClimbs()` | All active climbs for current user |
| `useClimb(id)` | Single climb |
| `useAddClimb()` | Mutation — `{ data, routeId? }` — inserts + silent push |
| `useUpdateClimb()` | Mutation — `{ id, data, routeId? }` — updates + silent push |
| `useLinkClimbToRoute()` | Mutation — `{ climbId, routeId }` — upgrade flow in EditClimbView |
| `useDeleteClimb()` | Mutation — soft delete + silent push |

After each mutation a **silent push** fires: `pushClimbs(userId)` runs in the background, toasting success or "saved offline" on failure.

---

## climbs.store.ts

```ts
interface ClimbsStore {
  selectedClimbId: string | null
  setSelectedClimbId: (id: string | null) => void

  // Filter state — persists across navigation
  searchText: string
  setSearchText: (text: string) => void
  filtersOpen: boolean
  setFiltersOpen: (open: boolean) => void
  statusFilters: Set<string>          // default: sent, project
  toggleStatusFilter: (status: string) => void
  typeFilters: Set<string>            // default: sport, boulder
  toggleTypeFilter: (type: string) => void
}
```

---

## Soft delete pattern

```ts
// Hide from all queries:
'SELECT * FROM climbs WHERE deleted_at IS NULL'

// Soft delete (always — hard delete is handled by sync):
softDeleteClimb(id)  // sets deleted_at = datetime('now')
```

Soft-deleted rows are included in sync pushes so Supabase receives the `deleted_at` timestamp.

---

## Supabase table

```sql
public.climbs (
  id uuid pk,  user_id uuid,  name text,  route_type text,
  grade text,  moves text,  sent_status text,
  country text,  area text,  sub_area text,  route_location text,  link text,
  route_id uuid references public.routes,
  created_at timestamptz,  updated_at timestamptz,  deleted_at timestamptz
)
-- RLS: auth.uid() = user_id
```
