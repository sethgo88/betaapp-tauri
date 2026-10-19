# features/climb-images

User-owned photos attached to a climb log, with pin annotations marking hand/foot positions. Private to the uploading user — stored in the `climb-images` Supabase Storage bucket (authenticated access only).

---

## Schema

### SQLite (local)

```sql
-- climb_images: one row per photo
CREATE TABLE climb_images (
  id            TEXT PRIMARY KEY,
  climb_id      TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  image_url     TEXT NOT NULL,      -- storage path, e.g. "{userId}/{climbId}/{imageId}.webp" (older rows: .jpg)
  sort_order    INTEGER NOT NULL DEFAULT 0,
  local_data    TEXT,               -- LEGACY base64 data URI; no longer written, converted to files on launch by migrateLocalDataToFiles
  size_bytes    INTEGER,            -- encoded size; null for images uploaded before v33
  upload_status TEXT NOT NULL DEFAULT 'uploaded',  -- 'pending' | 'uploaded' | 'error'
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at    TEXT                -- soft delete
);

-- climb_image_pins: annotation pins per photo
CREATE TABLE climb_image_pins (
  id             TEXT PRIMARY KEY,
  climb_image_id TEXT NOT NULL,
  pin_type       TEXT NOT NULL,  -- 'lh' | 'rh' | 'lf' | 'rf'
  x_pct          REAL NOT NULL,  -- 0.0–1.0 relative to image width
  y_pct          REAL NOT NULL,  -- 0.0–1.0 relative to image height
  description    TEXT,
  pointer_dir    TEXT NOT NULL DEFAULT 'bottom',  -- 'top' | 'bottom' | 'left' | 'right'
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Supabase (mirror)
- `climb_images` — same columns; RLS: `user_id = auth.uid()` for all operations
- `climb_image_pins` — same columns; RLS: authenticated users can manage pins for their own images
- `climb-images` Storage bucket — private; storage policy: `(storage.foldername(name))[1] = auth.uid()`

---

## climb-images.schema.ts

| Type | Description |
|---|---|
| `PinType` | `'lh' \| 'rh' \| 'lf' \| 'rf'` |
| `PointerDir` | `'top' \| 'bottom' \| 'left' \| 'right'` — direction the pin triangle points |
| `UploadStatus` | `'pending' \| 'uploaded' \| 'error'` |
| `ClimbImage` | Row shape from `climb_images` table |
| `ClimbImageWithUrl` | `ClimbImage` + `signed_url: string` (signed URL when uploaded and not cached locally; empty string when the image is cached as a file — the UI resolves it with `useCachedImageUrl(climbImageKey(image_url), signed_url)` / `CachedImage`; legacy rows may still carry a base64 URI until converted) |
| `ClimbImagePin` | Row shape from `climb_image_pins` table (includes `pointer_dir`) |

---

## climb-images.service.ts

| Function | Description |
|---|---|
| `fetchClimbImages(climbId)` | Returns images ordered by `sort_order`; skips signing for images cached as files (works offline), otherwise generates a signed URL for uploaded images; if signing fails (e.g. offline) that image gets `signed_url: ""` instead of rejecting the whole list |
| `getUserImageCount(userId)` | Count of non-deleted images across all climb logs (for 100-cap enforcement) |
| `insertClimbImage(climbId, userId, storagePath, sortOrder, uploadStatus?, sizeBytes?)` | Inserts a new row; defaults to `upload_status='uploaded'` |
| `markImageUploaded(id)` | Sets `upload_status='uploaded'` after a successful upload |
| `uploadPendingImages(userId)` | Finds all `pending`/`error` rows, uploads each from its cached file, marks as `uploaded`; sets `error` on failure |
| `softDeleteClimbImage(id)` | Sets `deleted_at` |
| `reorderClimbImages(ids[])` | Updates `sort_order` for each id in the given order |
| `applyRemoteClimbImage(image)` | `INSERT OR REPLACE` — always sets `upload_status='uploaded'` — used by sync pull |
| `cacheImagesForOfflineClimb(climbId)` | Downloads bytes for uploaded images not yet cached and writes them to the file cache (scope `climb`); already-cached images just get the climb ref |
| `clearClimbImageCache(climbId)` | Releases the climb ref for all uploaded images (files are deleted when no other scope references them); called when offline mode is turned off |
| `cacheNewOfflineImages(userId)` | Calls `cacheImagesForOfflineClimb` for every climb with `offline_available=1`; called after each sync |
| `fetchClimbImagePins(climbImageId)` | Returns pins ordered by `sort_order` |
| `insertClimbImagePin(climbImageId, pinType, xPct, yPct, sortOrder, pointerDir?)` | Inserts a new pin; defaults `pointer_dir` to `'bottom'` |
| `updateClimbImagePin(id, patch)` | Partial update of `x_pct`, `y_pct`, `description`, and/or `pointer_dir` |
| `deleteClimbImagePin(id)` | Hard delete (pins have no sync tombstone requirement) |
| `applyRemoteClimbImagePin(pin)` | `INSERT OR REPLACE` — used by sync pull |

---

## climb-images.queries.ts

| Hook | Description |
|---|---|
| `useClimbImages(climbId)` | Query; `staleTime: 50min` to avoid signed URL expiry; `networkMode: 'offlineFirst'` so it runs offline |
| `useUserImageCount()` | Query; reads userId from auth store |
| `useAddClimbImage(climbId)` | Mutation; enforces 100-image cap; compresses → saves locally (pending) → uploads if online |
| `useDeleteClimbImage(climbId)` | Mutation; soft-deletes row; removes from Storage only if `upload_status='uploaded'` |
| `useReorderClimbImages(climbId)` | Mutation; updates sort_order for all images |
| `useClimbImagePins(climbImageId)` | Query; disabled when `climbImageId` is null |
| `useAddPin(climbImageId)` | Mutation; inserts pin at given x_pct/y_pct with optional `pointerDir` (default `'bottom'`) |
| `useUpdatePin(climbImageId)` | Mutation; partial patch (position, description, or pointer_dir) |
| `useDeletePin(climbImageId)` | Mutation; hard deletes pin |
| `useSetClimbOfflineAvailable(climbId)` | Mutation; `(enable: boolean)` — when enabling: sets flag + downloads image bytes; when disabling: clears cache + clears flag |

---

## Storage

- **Bucket:** `climb-images` (private)
- **Path pattern:** `{userId}/{climbId}/{imageId}.webp` (extension follows the encoded format; compressed with the `beta` preset: 1280px, WebP q0.65)
- **Upload flow:** compress → `blobToBase64` → insert row with `upload_status='pending'` → upload if online → `markImageUploaded`
- **Offline fallback:** cached files (see `features/image-cache`) are used when present — either pending upload or cached for offline access. `local_data` is legacy and converted to files at launch by `migrateLocalDataToFiles()`.
- **Per-climb offline caching:** when `climbs.offline_available=1`, all image bytes are stored as files in the image cache; `cacheNewOfflineImages` is called after each sync to auto-cache new images
- **Retry:** `uploadPendingImages(userId)` runs at the start of each sync cycle (via `useSync`) to flush the queue
- **Display:** `createSignedUrl(path, 3600)` — 1hr expiry; query staleTime is 50min to ensure refresh before expiry

## Per-user cap

100 images total across all climb logs. Enforced in `useAddClimbImage` before upload. Current usage shown in `ClimbImageGallery` as "n / 100".
