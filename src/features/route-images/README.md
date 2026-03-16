# features/route-images

Admin-managed image galleries for routes and walls. Images are stored in the Supabase `route-images` public bucket and cached locally in `route_images_cache` / `wall_images_cache`.

Non-admins can view images; only admins can upload or delete.

---

## Tables

### `route_images_cache`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (UUID) | `crypto.randomUUID()` |
| `route_id` | TEXT | Foreign key to `routes_cache.id` |
| `image_url` | TEXT | Full public URL from Supabase Storage |
| `sort_order` | INTEGER | Display order (0-based, ascending) |
| `uploaded_by` | TEXT | User ID of the admin who uploaded |
| `created_at` | TEXT | `datetime('now')` |

### `wall_images_cache`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (UUID) | `crypto.randomUUID()` |
| `wall_id` | TEXT | Foreign key to `walls_cache.id` |
| `image_url` | TEXT | Full public URL from Supabase Storage |
| `sort_order` | INTEGER | Display order (0-based, ascending) |
| `uploaded_by` | TEXT | User ID of the admin who uploaded |
| `created_at` | TEXT | `datetime('now')` |

Storage path conventions:
- Routes: `routes/{routeId}/{uuid}.jpg`
- Walls: `walls/{wallId}/{uuid}.jpg`

---

## Service functions (`route-images.service.ts`)

```ts
fetchRouteImages(routeId)        → Promise<RouteImage[]>
insertRouteImage(routeId, uploadedBy, imageUrl, sortOrder) → Promise<string>
deleteRouteImage(id)             → Promise<void>   // hard delete (cache table)
applyRemoteRouteImage(image)     → Promise<void>   // INSERT OR REPLACE (used by sync pull)

fetchWallImages(wallId)          → Promise<WallImage[]>
insertWallImage(wallId, uploadedBy, imageUrl, sortOrder)   → Promise<string>
deleteWallImage(id)              → Promise<void>
applyRemoteWallImage(image)      → Promise<void>
```

---

## Query hooks (`route-images.queries.ts`)

```ts
useRouteImages(routeId)          // queryKey: ['route-images', routeId]
useAddRouteImage(routeId)        // upload → Storage → insertRouteImage; invalidates route-images
useDeleteRouteImage(routeId)     // deleteRouteImage + Storage remove; invalidates route-images

useWallImages(wallId)            // queryKey: ['wall-images', wallId]
useAddWallImage(wallId)          // upload → Storage → insertWallImage; invalidates wall-images
useDeleteWallImage(wallId)       // deleteWallImage + Storage remove; invalidates wall-images
```

Upload flow (both route and wall):
1. `uploadToStorage('route-images', path, file)` — resize/compress + upload, returns storage path
2. `supabase.storage.from('route-images').getPublicUrl(path)` — get full public URL
3. `insertRouteImage` / `insertWallImage` — persist URL to local SQLite

---

## Sync

Pull-only — images are admin-managed content. No push from client.

```ts
// In sync.service.ts:
pullRouteImages(since?)   // supabase → route_images → applyRemoteRouteImage for each row
pullWallImages(since?)    // supabase → wall_images → applyRemoteWallImage for each row
```

Called from `useSync.ts` after `pullRegions()`. Query keys `['route-images']` and `['wall-images']` are invalidated after sync completes.

---

## Supabase setup (manual — required before feature works end-to-end)

- `route-images` Storage bucket: **public**
- Storage policy: authenticated users can INSERT; public can SELECT (or use signed URLs if preferred)
- `route_images` table: mirrors `route_images_cache` schema
- `wall_images` table: mirrors `wall_images_cache` schema
- RLS on both tables: authenticated SELECT; admin role required for INSERT/DELETE
