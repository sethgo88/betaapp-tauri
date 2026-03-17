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
  status: 'pending' | 'verified' | 'rejected'
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
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Only populated when the user downloads a region (see [`locations/README.md`](../locations/README.md)).

---

## routes.service.ts

### User-facing

| Function | What it does |
|---|---|
| `fetchRoute(id)` | Reads a single route from `routes_cache` by id; returns `null` if not found |
| `fetchRoutes(wallId)` | Reads `routes_cache` for a wall, ordered by name |
| `submitRoute(values, userId)` | Inserts into Supabase `routes` (unverified) + local `routes_cache` |
| `searchVerifiedRoutes(query)` | Full-text search against Supabase `routes` (verified only, limit 10) |
| `searchLocalRoutes(query)` | LIKE search on local `routes_cache` by name or grade (verified only, limit 30) |
| `updateRouteDescription(id, description)` | Updates description in Supabase + local cache |

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
| `fetchUnverifiedRoutes()` | Supabase query — pending routes only with nested location names |
| `fetchAllRoutes()` | Supabase query — all routes (all statuses) with nested location names, ordered by created_at desc |
| `verifyRoute(id)` | Sets `status = 'verified'` in Supabase + local cache |
| `rejectRoute(id)` | Sets `status = 'rejected'` in Supabase + local cache (soft — stays visible to creator) |
| `updateRouteFields(id, values)` | Updates name/grade/route_type/description in both Supabase and cache |
| `mergeRoute(unverifiedId, targetId)` | Reassigns climbs from unverified to target route (Supabase + local), then deletes the unverified route |

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
useRouteLinks(routeId)     // non-deleted links for a route from local cache
useAddRouteLink(routeId)   // mutation — { url, title?, userId }
useDeleteRouteLink(routeId) // mutation — id
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
  verified boolean default false,
  created_by uuid references auth.users,
  created_at timestamptz,  deleted_at timestamptz
)
-- RLS: status = 'verified' visible to all authenticated users
--       status = 'pending'/'rejected' visible to created_by only
-- INSERT: auth.uid() = created_by
```
