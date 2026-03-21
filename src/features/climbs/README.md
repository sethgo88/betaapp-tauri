# features/climbs

Personal climb log. The user's primary data — local-first, synced bidirectionally with Supabase.

---

## Schema

```ts
// climbs.schema.ts
SentStatus = 'todo' | 'project' | 'sent' | 'redpoint' | 'flash' | 'onsight'
RouteType  = 'sport' | 'boulder'

MoveItem = { id: string; text: string }
Beta     = { id: string; title: string; moves: MoveItem[] }
Betas    = Beta[]   // BetasSchema = z.array(Beta)

ClimbSchema = {
  id: string
  user_id: string
  name: string           // route name (freeform)
  route_type: RouteType
  grade: string
  moves: string          // JSON — either Betas (new) or MoveItem[] (legacy); default '[]'
  sent_status: SentStatus
  country?: string
  area?: string
  sub_area?: string
  crag?: string
  wall?: string
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

### parseBetas(movesJson: string): Beta[]

Migration utility exported from `climbs.schema.ts`. Converts the `moves` JSON string into the new betas format:

- **New format** `[{id, title, moves}]` → returned as-is (empty-text moves filtered out)
- **Legacy format** `[{id, text}]` → wrapped as a single "Beta 1" (empty-text moves filtered out)
- **Empty / invalid** → returns `[]`

Use `parseBetas` everywhere `moves` needs to be displayed or edited. The `ClimbForm` always stores `JSON.stringify(betas)` — i.e., the new betas format — on any save.

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
    crag             TEXT,
    wall             TEXT,
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
| `fetchClimbs(userId, sortKey?)` | All active climbs for user; sort defaults to `name_asc`. Grade sort joins `grades_cache` to rank by `sort_order`. |
| `fetchClimb(id)` | Single climb by id |
| `backfillClimbLocations()` | One-time startup migration: fills `country/area/sub_area/crag/wall` on route-linked climbs that have empty location data, by joining the local location cache hierarchy |
| `insertClimb(userId, data, routeId?)` | Creates new climb; when `routeId` is provided, location fields are auto-populated from the route's wall→crag→sub_region→region→country hierarchy |
| `updateClimb(id, data, routeId?)` | Updates mutable fields; trigger stamps `updated_at` |
| `updateClimbMoves(id, moves)` | Updates only the `moves` JSON string; stores the full betas array |
| `linkClimbToRoute(climbId, routeId)` | Sets `route_id` without changing other fields (upgrade flow) |
| `softDeleteClimb(id)` | Sets `deleted_at = datetime('now')` |
| `applyRemoteClimb(climb)` | `INSERT OR REPLACE` — preserves server `updated_at`; used by sync + Realtime |

**`applyRemoteClimb` vs `insertClimb`:** Always use `applyRemoteClimb` when writing data received from Supabase. It bypasses the `updated_at` trigger so the server timestamp is preserved exactly.

---

## climbs.queries.ts

| Hook | Returns |
|---|---|
| `useClimbs()` | All active climbs for current user, sorted per `sortKey` from `useClimbsStore` |
| `useClimb(id)` | Single climb |
| `useAddClimb()` | Mutation — `{ data, routeId? }` — inserts + silent push |
| `useUpdateClimb()` | Mutation — `{ id, data, routeId? }` — updates + silent push |
| `useUpdateClimbMoves()` | Mutation — `{ id, moves }` — replaces moves JSON string + silent push |
| `useLinkClimbToRoute()` | Mutation — `{ climbId, routeId }` — upgrade flow in EditClimbView |
| `useDeleteClimb()` | Mutation — soft delete + silent push |
| `useClimbStats(discipline)` | Grade distribution, sends per month, and burns per send — all from local SQLite via `climbs.stats.ts` |

After each mutation a **silent push** fires: `pushClimbs(userId)` runs in the background, toasting success or "saved offline" on failure.

---

## climbs.stats.ts

Read-only analytics functions — all query local SQLite, no Supabase calls.

| Function | Returns |
|---|---|
| `fetchGradeDistribution(userId, discipline)` | `GradeStatusBucket[]` — per-grade counts segmented into `sent` (sent/redpoint/flash/onsight), `project`, and `todo`, ordered by `grades_cache.sort_order` |
| `fetchSendsPerMonth(userId, discipline)` | `MonthSendCount[]` — sent count grouped by `YYYY-MM`, ordered chronologically |
| `fetchBurnsPerSend(userId, discipline)` | `BurnsPerSend[]` — average burn count per send at each grade (sent climbs only), ordered by grade |
| `fetchClimbStats(userId, discipline)` | Runs all three above in parallel, returns `ClimbStats` |

---

## climbs.store.ts

```ts
type SortKey =
  | 'name_asc' | 'name_desc'    // alphabetical by climb title
  | 'date_desc' | 'date_asc'    // by created_at
  | 'grade_asc' | 'grade_desc'  // by grades_cache.sort_order, discipline-grouped

interface ClimbsStore {
  selectedClimbId: string | null
  setSelectedClimbId: (id: string | null) => void

  // Filter / sort state — persists across navigation
  searchText: string
  setSearchText: (text: string) => void
  filtersOpen: boolean
  setFiltersOpen: (open: boolean) => void
  statusFilters: Set<string>          // default: sent, project
  toggleStatusFilter: (status: string) => void
  typeFilters: Set<string>            // default: sport, boulder
  toggleTypeFilter: (type: string) => void
  sortKey: SortKey                    // default: name_asc
  setSortKey: (key: SortKey) => void
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
  country text,  area text,  sub_area text,  crag text,  wall text,  route_location text,  link text,
  route_id uuid references public.routes,
  created_at timestamptz,  updated_at timestamptz,  deleted_at timestamptz
)
-- RLS: auth.uid() = user_id
```
