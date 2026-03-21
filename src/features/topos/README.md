# Topos Feature

Admin-managed climbing route topo photos with drawn route lines. All users can view topos; only admins can create and edit them.

## Concepts

- **Wall topo** — one photo per wall with multiple route lines drawn on it (one per route). Lines are stored as arrays of `{x_pct, y_pct}` points (0–1 normalized to image dimensions).
- **Route topo** — an optional separate close-up photo for an individual route with a single route line. Falls back to the wall topo (filtered to that route's line) when no dedicated topo exists.

## Schema

### TypeScript

```ts
Point         = { x_pct: number, y_pct: number }  // 0-1 normalized
WallTopo      = { id, wall_id, image_url, created_by, created_at }
WallTopoLine  = { id, topo_id, route_id, points: Point[], color, sort_order, created_at }
RouteTopo     = { id, route_id, image_url, points: Point[], color, created_by, created_at }
```

### SQLite (migration v19)

| Table | Key columns |
|---|---|
| `wall_topos_cache` | `id`, `wall_id`, `image_url`, `created_by` |
| `wall_topo_lines_cache` | `id`, `topo_id`, `route_id`, `points` (JSON), `color`, `sort_order` |
| `route_topos_cache` | `id`, `route_id`, `image_url`, `points` (JSON), `color`, `created_by` |

### Supabase tables

Mirror the SQLite schema: `wall_topos`, `wall_topo_lines`, `route_topos`.

**Storage:** `route-images` bucket under `topos/walls/{wallId}/{uuid}.jpg` and `topos/routes/{routeId}/{uuid}.jpg`.

**RLS:** authenticated SELECT; admin-only INSERT/UPDATE/DELETE.

## Service functions (`topos.service.ts`)

| Function | Description |
|---|---|
| `fetchWallTopo(wallId)` | Get wall topo from local cache |
| `fetchWallTopoLines(topoId)` | Get all lines for a topo, JSON points parsed |
| `fetchRouteTopo(routeId)` | Get route topo from local cache |
| `upsertWallTopo(wallId, imageUrl, createdBy)` | Create or update wall topo in Supabase + cache |
| `upsertWallTopoLine(topoId, routeId, points, color, sortOrder)` | Create or update a route line |
| `deleteWallTopoLine(id)` | Remove a route line |
| `deleteWallTopo(id, imageUrl)` | Remove topo + all lines + storage file |
| `upsertRouteTopo(routeId, imageUrl, points, color, createdBy)` | Create or update route topo |
| `deleteRouteTopo(id, imageUrl)` | Remove route topo + storage file |

## Query hooks (`topos.queries.ts`)

| Hook | Purpose |
|---|---|
| `useWallTopo(wallId)` | Fetch wall topo |
| `useWallTopoLines(topoId)` | Fetch wall topo lines |
| `useRouteTopo(routeId)` | Fetch route topo |
| `useUploadWallTopoImage(wallId)` | Upload image and create/update wall topo |
| `useUpsertWallTopoLine(wallId)` | Save a route line |
| `useDeleteWallTopoLine(topoId)` | Delete a route line |
| `useDeleteWallTopo(wallId)` | Delete entire wall topo |
| `useUpsertRouteTopo(routeId)` | Save route topo (image + points) |
| `useDeleteRouteTopo(routeId)` | Delete route topo |

## Colors

Fixed palette of 8 colors (`TOPO_COLORS`), assigned by route sort_order index mod 8 via `topoColor(index)`.
