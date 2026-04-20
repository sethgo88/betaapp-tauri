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
  route_type: 'sport' | 'boulder' | 'trad'
  description: string | null
  status: 'pending' | 'verified' | 'rejected'
  created_by: string   // Supabase user UUID
  created_at: string
  sort_order: number   // admin-defined display order; default 0
  avg_rating?: number | null  // v29; denormalised average of linked climbs' ratings (#212)
  rating_count: number        // v30; count of rated climbs; default 0 (#212)
  sun_data?: SunData | null   // v31; JSON sun/aspect data overriding wall-level sun_data (#220)
}

// Admin-only type — not stored in SQLite
UnverifiedRoute = RouteSchema & {
  walls: { ... } | null    // nested location breadcrumb
  submitter?: {
    email: string
    display_name: string | null
  }
}

RouteSubmitSchema = {
  wall_id: string      // required — must select a wall
  name: string
  grade: string
  route_type: 'sport' | 'boulder' | 'trad'
  description?: string
}

RouteLinkSchema = {
  id: string
  route_id: string
  user_id: string
  url: string
  title: string | null
  link_type: string    // defaults to 'link'
  created_at: string
  deleted_at: string | null
}

RouteLinkSubmitSchema = {
  url: string          // must start with http:// or https://
  title?: string
}

// Returned by the get_route_body_stats Supabase RPC (not stored locally)
RouteBodyStat = {
  height_cm: number
  ape_index_cm: number | null
  grade: string
  count: number           // number of climbers at this height/ape + grade combination
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
    status      TEXT NOT NULL DEFAULT 'verified',
    created_by  TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    sort_order  INTEGER NOT NULL DEFAULT 0,   -- v23; admin-defined display order
    avg_rating  REAL,                          -- v29; denormalised avg of linked climb ratings (#212)
    rating_count INTEGER NOT NULL DEFAULT 0,   -- v30; count of rated climbs (#212)
    sun_data    TEXT                           -- v31; JSON-encoded SunData (#220)
);
```

Only populated when the user downloads a region (see [`locations/README.md`](../locations/README.md)).

---

## routes.service.ts

### User-facing

| Function | What it does |
|---|---|
| `refreshRouteAvgRating(routeId)` | Recomputes `avg_rating` (rounded to 1 decimal) and `rating_count` from local climbs (`WHERE route_id = ? AND rating IS NOT NULL AND deleted_at IS NULL`); writes both to `routes_cache`. Called by `climbs.service` after any rating change. |
| `fetchRoute(id)` | Reads a single route from `routes_cache` by id; returns `null` if not found |
| `fetchRoutes(wallId)` | Reads `routes_cache` for a wall, ordered by `sort_order ASC, name ASC` |
| `reorderRoutes(orderedIds)` | Admin — updates `sort_order` for each route id in Supabase + local cache |
| `addRoute(values, userId, isAdmin)` | Inserts into Supabase `routes` + local `routes_cache`; returns the new route `id` |
| `searchVerifiedRoutes(query)` | Full-text search against Supabase `routes` (verified only, limit 10) |
| `searchLocalRoutes(query)` | LIKE search on local `routes_cache` by name or grade (verified only, limit 30) |
| `updateRouteDescription(id, description)` | Updates description in Supabase + local cache |
| `updateRouteSunData(routeId, data)` | Sets route-level sun_data (JSON-serialised `SunData`, or `null` to clear) in Supabase + local cache |

### Route body stats

| Function | What it does |
|---|---|
| `fetchRouteBodyStats(routeId)` | Calls `get_route_body_stats` Supabase RPC; returns aggregated height/ape index vs grade data for all climbers who have sent the route (SECURITY DEFINER — bypasses RLS to include all users) |

### Route links

| Function | What it does |
|---|---|
| `fetchRouteLinks(routeId)` | Reads non-deleted links for a route from local `route_links` table |
| `addRouteLink(routeId, userId, url, title)` | Inserts into Supabase `route_links` + local cache |
| `deleteRouteLink(id)` | Soft-deletes in Supabase; hard-deletes locally |
| `applyRemoteRouteLink(link)` | Upserts a remote link into local cache (handles soft deletes) |

### Admin-only

| Function | What it does |
|---|---|
| `fetchUnverifiedRoutes()` | Supabase query — pending routes only with nested location names; enriches each route with submitter `email` and `display_name` from the `users` table |
| `fetchAllRoutes()` | Supabase query — all routes (all statuses) with nested location names, ordered by created_at desc |
| `verifyRoute(id)` | Sets `status = 'verified'` in Supabase + local cache |
| `rejectRoute(id)` | Sets `status = 'rejected'` in Supabase + local cache (soft — stays visible to creator) |
| `updateRouteFields(id, values)` | Updates name/grade/route_type/description in both Supabase and cache |
| `mergeRoute(unverifiedId, targetId)` | Reassigns climbs from unverified to target route (Supabase + local), then deletes the unverified route |
| `adminDeleteRoute(id)` | Unlinks any climbs referencing this route (`route_id = NULL`), soft-deletes in Supabase, hard-deletes from local cache |

---

## routes.queries.ts

```ts
useRoute(id)               // single route from local cache (null if not found)
useRoutes(wallId)          // routes for a wall from local cache
useSearchLocalRoutes(query) // LIKE search on local cache (min 2 chars)
useUpdateRouteDescription() // mutation — { id, description }
useSubmitRoute()           // mutation
useUnverifiedRoutes()      // admin — pending routes only, from Supabase
useAllRoutes()             // admin — all routes (all statuses), from Supabase
useVerifyRoute()           // admin mutation
useRejectRoute()           // admin mutation
useUpdateRouteFields()     // admin mutation
useMergeRoute()            // admin mutation
useRouteBodyStats(routeId) // body dimension vs grade scatter data from Supabase RPC
useRouteLinks(routeId)     // non-deleted links for a route from local cache
useAddRouteLink(routeId)   // mutation — { url, title?, userId }
useDeleteRouteLink(routeId) // mutation — id
useReorderRoutes(wallId)   // admin mutation — orderedIds: string[]; invalidates routes for wall
useAdminDeleteRoute()      // admin mutation — { id, wallId }; unlinks climbs then deletes route
useUpdateRouteSunData(routeId) // admin mutation — SunData | null; null clears override; invalidates route
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

## Admin route manager flow

```
Admin navigates to /admin/routes
  → fetchAllRoutes() — shows all routes with status badges

For each route, admin can:
  Edit    → updateRouteFields()  — always available
  Approve → verifyRoute(id)      — pending only; makes visible to all
  Reject  → rejectRoute(id)      — pending only
  Merge   → mergeRoute(id)       — pending only; reassign climbs + delete duplicate
```

---

## Supabase table

```sql
public.routes (
  id uuid pk,  wall_id uuid references walls,  name text,
  route_type text,  grade text,  description text,
  status text default 'pending',
  created_by uuid references auth.users,
  created_at timestamptz,  deleted_at timestamptz,
  sort_order integer default 0,
  sun_data jsonb          -- v224; null = inherit from wall
)
-- RLS: status = 'verified' visible to all authenticated users
--       status = 'pending'/'rejected' visible to created_by only
-- sun_data: readable by all authenticated; writable by admin/service role only
-- INSERT: auth.uid() = created_by
```
