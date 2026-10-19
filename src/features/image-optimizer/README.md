# features/image-optimizer

Admin-run, one-off job that brings **existing** images up to the current standard: legacy JPEGs become small WebP, and every image row gets a `size_bytes`. New uploads already do this at upload time (`src/lib/image-utils.ts`); this covers everything uploaded before that. Runs on the admin's device from `/admin/images` (`views/admin/ImageOptimizerView`). Because the app has a single user today, the admin's own personal climb photos are processed too.

## What it touches

| Table | Bucket | Preset |
|---|---|---|
| `route_images`, `wall_images`, `wall_topos`, `route_topos` | `route-images` (public) | `reference` (1600px, WebP q0.75) |
| `climb_images` (the signed-in user's own, not deleted) | `climb-images` (private) | `beta` (1280px, WebP q0.65) |

Rows whose URL isn't in our public bucket are ignored. A file referenced by several rows (a topo reusing a gallery image) is one **group** and is processed once; all its rows are repointed together.

## Per-group algorithm (`runOptimization`)

1. Skip groups that are already `.webp` with sizes recorded (never downloaded).
2. Download the file (`storage.download`).
3. Legacy `.jpg/.jpeg`: re-encode with the preset. If the result is WebP and at least 10% smaller → upload `…/name.webp`, repoint every row (remote + local cache, new `image_url` + `size_bytes`), then delete the original. If repointing fails, the new upload is removed and the original is kept.
4. Otherwise (already WebP, WebView can't encode WebP, or no worthwhile saving): keep the file and only record `size_bytes`.
5. Personal photos cached on disk under the old path are re-keyed to the new path.

Idempotent and resumable: a converted row is `.webp` with a size, so a re-run does only what's left. 2 groups run at a time (canvas encoding is memory-heavy); cancel via `AbortSignal`; per-group failures are collected, not fatal.

## API (`image-optimizer.service.ts`)

| Function | Description |
|---|---|
| `scanImages()` | `{ total, toReencode, toBackfill, upToDate }` for the confirm screen |
| `runOptimization(backend, { signal, onProgress })` | The job above → `{ reencoded, sizeBackfilled, skipped, failed[], bytesSaved, cancelled }` |
| `planGroups(groups)` | Pure counting helper |
| `supabaseBackend` | Real `OptimizeBackend` (Supabase + local SQLite + image cache); tests inject a fake backend |

Hooks (`image-optimizer.queries.ts`): `useScanImages()`, `useRunImageOptimization()` (invalidates image/topo/download queries when done).

## Sync support

Changing a row's `image_url` must reach other devices, so `useSync` now: fully re-pulls `route_images` / `wall_images` (no `created_at` delta), and runs `pullClimbImageFileUpdates(userId)` which updates `image_url`/`size_bytes` of the user's existing, non-deleted local photos from the server. Downloaded areas pick up the new URLs as "Updates available" in the Image Manager and re-fetch them.

## Notes

- Old public URLs stop working once the original is deleted; devices that haven't synced yet show those images as unavailable until they do.
- Requires the Supabase `size_bytes` migrations to be applied and an admin session (RLS lets admins write the shared tables and the user write their own `climb_images`).
