# Topos Feature

Admin-managed climbing route topo photos with drawn route lines. All users can view topos; only admins can create and edit them.

## Concepts

- **Wall topo** — one photo per wall with multiple route lines drawn on it (one per route). Lines are stored as arrays of `{x_pct, y_pct}` points (0–1 normalized to image dimensions).
- **Route topo** — an optional separate close-up photo for an individual route with a single route line. Falls back to the wall topo (filtered to that route's line) when no dedicated topo exists.

## Schema

### TypeScript

```ts
Point         = { x_pct: number, y_pct: number }  // 0-1 normalized
WallTopo      = { id, wall_id, image_url, size_bytes?, created_by, created_at }
WallTopoLine  = { id, topo_id, route_id, points: Point[], color, sort_order, created_at }
RouteTopo     = { id, route_id, image_url, points: Point[], color, size_bytes?, created_by, created_at }
```

### SQLite (migration v19; `size_bytes` added in v34)

| Table | Key columns |
|---|---|
| `wall_topos_cache` | `id`, `wall_id`, `image_url`, `size_bytes`, `created_by` |
| `wall_topo_lines_cache` | `id`, `topo_id`, `route_id`, `points` (JSON), `color`, `sort_order` |
| `route_topos_cache` | `id`, `route_id`, `image_url`, `points` (JSON), `color`, `size_bytes`, `created_by` |

`size_bytes` is the encoded image size in bytes (null for images uploaded before it was recorded). Topos that reuse a gallery image inherit its size via `getImageSizeByUrl`.

### Supabase tables

Mirror the SQLite schema: `wall_topos`, `wall_topo_lines`, `route_topos`.

**Storage:** `route-images` bucket under `topos/walls/{wallId}/{uuid}.webp` and `topos/routes/{routeId}/{uuid}.webp` (older: `.jpg`).

**RLS:** authenticated SELECT; admin-only INSERT/UPDATE/DELETE.

## Service functions (`topos.service.ts`)

| Function | Description |
|---|---|
| `fetchWallTopo(wallId)` | Get wall topo from local cache |
| `fetchWallTopoLines(topoId)` | Get all lines for a topo, JSON points parsed |
| `fetchRouteTopo(routeId)` | Get route topo from local cache |
| `upsertWallTopo(wallId, imageUrl, createdBy, sizeBytes?)` | Create or update wall topo (and its `size_bytes`) in Supabase + cache |
| `upsertWallTopoLine(topoId, routeId, points, color, sortOrder)` | Create or update a route line |
| `deleteWallTopoLine(id)` | Remove a route line |
| `deleteWallTopo(id, imageUrl)` | Remove topo + all lines + storage file |
| `upsertRouteTopo(routeId, imageUrl, points, color, createdBy, sizeBytes?)` | Create or update route topo; a points-only edit keeps the stored size |
| `applyRemoteWallTopo` / `applyRemoteWallTopoLine` / `applyRemoteRouteTopo` | `INSERT OR REPLACE` into the cache — used by sync pull |
| `pruneTopoCache(table, remoteIds)` | Delete cache rows missing from the server after a full pull |
| `deleteRouteTopo(id, imageUrl)` | Remove route topo + storage file |

## Query hooks (`topos.queries.ts`)

| Hook | Purpose |
|---|---|
| `useWallTopo(wallId)` | Fetch wall topo |
| `useWallTopoLines(topoId)` | Fetch wall topo lines |
| `useRouteTopo(routeId)` | Fetch route topo |
| `useUploadWallTopoImage(wallId)` | Upload image and create/update wall topo |
| `useSetWallTopoFromUrl(wallId)` | Set wall topo from existing gallery image URL (no upload) |
| `useUpsertWallTopoLine(wallId)` | Save a route line |
| `useDeleteWallTopoLine(topoId)` | Delete a route line |
| `useDeleteWallTopo(wallId)` | Delete entire wall topo |
| `useUpsertRouteTopo(routeId)` | Save route topo (image + points); accepts optional `imageUrl` for gallery images |
| `useDeleteRouteTopo(routeId)` | Delete route topo |

## Colors

Fixed palette of 8 colors (`TOPO_COLORS`), assigned by route sort_order index mod 8 via `topoColor(index)`.
