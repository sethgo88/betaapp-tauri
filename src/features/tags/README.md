# features/tags

Route and wall tag reference data. Seeded locally on first install, overwritten by Supabase on sync.

---

## Schema

```ts
// tags.schema.ts
TagSchema = {
  id: string
  name: string       // e.g. 'crimpy', 'roof', 'juggy'
  sort_order: number
}
```

---

## SQLite tables

```sql
CREATE TABLE tags_cache (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE route_tags_cache (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL,
  tag_id TEXT NOT NULL
);

CREATE TABLE wall_tags_cache (
  id TEXT PRIMARY KEY,
  wall_id TEXT NOT NULL,
  tag_id TEXT NOT NULL
);
```

No `updated_at` — tags are replaced wholesale on sync (DELETE + re-insert). Route/wall join rows are replaced per-entity during region download.

---

## tags.service.ts

| Function | What it does |
|---|---|
| `fetchTags()` | Reads all tags from `tags_cache` ordered by `sort_order` |
| `pullTags()` | Fetches all rows from Supabase `tags`, clears cache, re-inserts |
| `fetchRouteTags(routeId)` | Joins `route_tags_cache` + `tags_cache` for a route |
| `setRouteTags(routeId, tagIds)` | Admin: deletes existing + inserts new in Supabase + SQLite |
| `applyRemoteRouteTags(routeId, rows)` | Deletes + re-inserts `route_tags_cache` rows for a route (used during region download) |
| `fetchWallTags(wallId)` | Joins `wall_tags_cache` + `tags_cache` for a wall |
| `setWallTags(wallId, tagIds)` | Admin: deletes existing + inserts new in Supabase + SQLite |
| `applyRemoteWallTags(wallId, rows)` | Deletes + re-inserts `wall_tags_cache` rows for a wall (used during region download) |

`pullTags()` is a full replace (DELETE + INSERT), same as `pullGrades()`. Called from `useSync` on every sync run.

---

## tags.queries.ts

```ts
useTags()                      // all tags from cache
useRouteTags(routeId)          // tags for a route
useSetRouteTags(routeId)       // mutation; invalidates ["route_tags", routeId]
useWallTags(wallId)            // tags for a wall
useSetWallTags(wallId)         // mutation; invalidates ["wall_tags", wallId]
```

---

## Seed data

`tags-seed.ts` contains the 21 seed tags (alphabetical by name = sort_order 0–20):
bouldery, chossy, crimpy, dynamic, juggy, morpho, polished, pockety, powerful, pumpy, reachy, roof, scrunchy, short, slaby, slopey, steep, sustained, tall, techy, vert

`seedTags()` runs during app initialization alongside `seedGrades()`. If `tags_cache` row count matches the expected total, it skips. Otherwise clears and re-seeds. Supabase data overwrites on first sync.

---

## Supabase tables

```sql
CREATE TABLE tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- RLS: SELECT authenticated; service role writes

CREATE TABLE route_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(route_id, tag_id)
);
-- RLS: SELECT authenticated; admin role writes

CREATE TABLE wall_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wall_id uuid NOT NULL REFERENCES walls(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(wall_id, tag_id)
);
-- RLS: SELECT authenticated; admin role writes
```
