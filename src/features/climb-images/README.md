# features/climb-images

User-owned photos attached to a climb log, with pin annotations marking hand/foot positions. Private to the uploading user — stored in the `climb-images` Supabase Storage bucket (authenticated access only).

---

## Schema

### SQLite (local)

```sql
-- climb_images: one row per photo
CREATE TABLE climb_images (
  id          TEXT PRIMARY KEY,
  climb_id    TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  image_url   TEXT NOT NULL,   -- storage path, e.g. "{userId}/{climbId}/{imageId}.jpg"
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at  TEXT             -- soft delete
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
| `ClimbImage` | Row shape from `climb_images` table |
| `ClimbImageWithUrl` | `ClimbImage` + `signed_url: string` (short-lived display URL) |
| `ClimbImagePin` | Row shape from `climb_image_pins` table (includes `pointer_dir`) |

---

## climb-images.service.ts

| Function | Description |
|---|---|
| `fetchClimbImages(climbId)` | Returns images ordered by `sort_order`; generates a 1hr signed URL per image |
| `getUserImageCount(userId)` | Count of non-deleted images across all climb logs (for 100-cap enforcement) |
| `insertClimbImage(climbId, userId, storagePath, sortOrder)` | Inserts a new row; `storagePath` is stored in `image_url` |
| `softDeleteClimbImage(id)` | Sets `deleted_at` |
| `reorderClimbImages(ids[])` | Updates `sort_order` for each id in the given order |
| `applyRemoteClimbImage(image)` | `INSERT OR REPLACE` — used by sync pull |
| `fetchClimbImagePins(climbImageId)` | Returns pins ordered by `sort_order` |
| `insertClimbImagePin(climbImageId, pinType, xPct, yPct, sortOrder, pointerDir?)` | Inserts a new pin; defaults `pointer_dir` to `'bottom'` |
| `updateClimbImagePin(id, patch)` | Partial update of `x_pct`, `y_pct`, `description`, and/or `pointer_dir` |
| `deleteClimbImagePin(id)` | Hard delete (pins have no sync tombstone requirement) |
| `applyRemoteClimbImagePin(pin)` | `INSERT OR REPLACE` — used by sync pull |

---

## climb-images.queries.ts

| Hook | Description |
|---|---|
| `useClimbImages(climbId)` | Query; `staleTime: 50min` to avoid signed URL expiry |
| `useUserImageCount()` | Query; reads userId from auth store |
| `useAddClimbImage(climbId)` | Mutation; enforces 100-image cap, uploads to Storage, inserts row |
| `useDeleteClimbImage(climbId)` | Mutation; soft-deletes row + removes from Storage |
| `useReorderClimbImages(climbId)` | Mutation; updates sort_order for all images |
| `useClimbImagePins(climbImageId)` | Query; disabled when `climbImageId` is null |
| `useAddPin(climbImageId)` | Mutation; inserts pin at given x_pct/y_pct with optional `pointerDir` (default `'bottom'`) |
| `useUpdatePin(climbImageId)` | Mutation; partial patch (position, description, or pointer_dir) |
| `useDeletePin(climbImageId)` | Mutation; hard deletes pin |

---

## Storage

- **Bucket:** `climb-images` (private)
- **Path pattern:** `{userId}/{climbId}/{imageId}.jpg`
- **Upload:** `uploadToStorage('climb-images', path, file)` from `@/lib/image-utils` — resizes to max 1920px, JPEG 80% quality before upload
- **Display:** `createSignedUrl(path, 3600)` — 1hr expiry; query staleTime is 50min to ensure refresh before expiry

## Per-user cap

100 images total across all climb logs. Enforced in `useAddClimbImage` before upload. Current usage shown in `ClimbImageGallery` as "n / 100".
