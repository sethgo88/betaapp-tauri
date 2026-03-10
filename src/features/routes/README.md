# features/routes

Community-contributed climbing routes. Users submit routes; admins verify them. Verified routes are visible to all; unverified routes are visible to the creator only.

---

## Schema

```ts
// routes.schema.ts
RouteSchema = {
  id: string
  wall_id: string
  name: string
  grade: string
  route_type: 'sport' | 'boulder'
  description: string | null
  verified: number     // 0 = pending, 1 = verified (SQLite boolean)
  created_by: string   // Supabase user UUID
  created_at: string
}

RouteSubmitSchema = {
  wall_id: string      // required — must select a wall
  name: string
  grade: string
  route_type: 'sport' | 'boulder'
  description?: string
}
```

---

## SQLite table

```sql
CREATE TABLE IF NOT EXISTS routes_cache (
    id          TEXT PRIMARY KEY,
    wall_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    grade       TEXT NOT NULL,
    route_type  TEXT NOT NULL DEFAULT 'sport',
    description TEXT,
    verified    INTEGER NOT NULL DEFAULT 0,
    created_by  TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Only populated when the user downloads a region (see [`locations/README.md`](../locations/README.md)).

---

## routes.service.ts

### User-facing

| Function | What it does |
|---|---|
| `fetchRoutes(wallId)` | Reads `routes_cache` for a wall, ordered by name |
| `submitRoute(values, userId)` | Inserts into Supabase `routes` (unverified) + local `routes_cache` |
| `searchVerifiedRoutes(query)` | Full-text search against Supabase `routes` (verified only, limit 10) |

### Admin-only

| Function | What it does |
|---|---|
| `fetchUnverifiedRoutes()` | Supabase query — all unverified routes with nested location names |
| `verifyRoute(id)` | Sets `verified = true` in Supabase + `verified = 1` in local cache |
| `rejectRoute(id)` | Hard-deletes from Supabase + local cache |
| `updateRouteFields(id, values)` | Updates name/grade/route_type/description in both Supabase and cache |
| `mergeRoute(unverifiedId)` | Deletes the unverified duplicate (climb `route_id` updates deferred to Phase 10) |

---

## routes.queries.ts

```ts
useRoutes(wallId)          // routes for a wall from local cache
useSubmitRoute()           // mutation
useUnverifiedRoutes()      // admin — from Supabase
useVerifyRoute()           // admin mutation
useRejectRoute()           // admin mutation
useUpdateRoute()           // admin mutation
```

---

## Submission flow

```
User navigates: RoutesView → RegionView → CragView → wall
User taps "Add Route"
  → navigates to /routes/submit?wallId=...&wallName=...
  → fills RouteSubmitSchema fields
  → submitRoute():
      1. INSERT into Supabase routes (verified = false, created_by = userId)
      2. INSERT into local routes_cache (verified = 0)
  → navigates back to CragView
```

Unverified routes appear in the user's local cache immediately but are not visible to other users until an admin verifies them.

---

## Admin verification flow

```
Admin navigates to /admin/routes
  → fetchUnverifiedRoutes() — shows all pending with location breadcrumb

For each route, admin can:
  Verify  → verifyRoute(id)      — makes visible to all
  Edit    → updateRouteFields()  — fix grade/name before verifying
  Reject  → rejectRoute(id)      — hard delete
  Merge   → mergeRoute(id)       — remove duplicate (Phase 10: update climb references)
```

---

## Supabase table

```sql
public.routes (
  id uuid pk,  wall_id uuid references walls,  name text,
  route_type text,  grade text,  description text,
  verified boolean default false,
  created_by uuid references auth.users,
  created_at timestamptz,  deleted_at timestamptz
)
-- RLS: verified = true visible to all authenticated users
--       verified = false visible to created_by only
-- INSERT: auth.uid() = created_by
```
