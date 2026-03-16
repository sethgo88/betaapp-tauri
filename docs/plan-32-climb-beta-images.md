# Plan: Climb Beta Images (#32)

**Issue:** https://github.com/sethgo88/betaapp-tauri/issues/32
**Branch:** `feat/climb-beta-images` (branch from `master`)

---

## What we're building

Users attach photos to a climb log and annotate each image with draggable pins marking hand/foot positions (LH / RH / LF / RF). Images are private to the uploading user. Gallery lives on ClimbDetailView; a full-screen viewer handles pin editing.

---

## Key facts from codebase exploration

- **Next migration is v13** — add as the 14th entry (index 13) in the `migrations` array in `src/lib/db.ts`
- **v9 already created a `climb_images` stub** with schema `(id, climb_id, user_id, url, caption, sort_order, created_at, deleted_at)` — v13 must recreate it (rename → recreate → migrate rows → drop old) because column names differ (`url` → `image_url`, `caption` dropped)
- **CSP** already allows `*.supabase.co` for `connect-src` but not `img-src` — must add `https://*.supabase.co` to `img-src`
- **Sync** uses a `since` delta pattern in `sync.service.ts` — four new push/pull functions follow the same shape
- **No Realtime** for images in this phase — consistent with existing climbs/burns which also defer Realtime

---

## New files to create

```
src/features/climb-images/climb-images.schema.ts
src/features/climb-images/climb-images.service.ts
src/features/climb-images/climb-images.queries.ts
src/features/climb-images/README.md
src/lib/image-utils.ts
src/components/atoms/PinMarker.tsx
src/components/molecules/ImageGallery.tsx
src/components/organisms/ImageViewer.tsx
```

## Existing files to modify

```
src/lib/db.ts                         — add v13 migration
src/features/sync/sync.service.ts     — 4 new push/pull functions
src/hooks/useSync.ts                  — call the 4 new sync functions, invalidate new query keys
src/views/ClimbDetailView.tsx         — mount ImageGallery + ImageViewer
src-tauri/tauri.conf.json            — extend img-src to include https://*.supabase.co
src/components/README.md              — document 3 new components
src/features/sync/README.md           — document 4 new sync functions
src/lib/README.md                     — document image-utils.ts
```

---

## Data model

### v13 migration (5 SQL statements run in order)

```sql
-- 1. Rename old stub table
ALTER TABLE climb_images RENAME TO climb_images_v9;

-- 2. Create new table
CREATE TABLE climb_images (
  id         TEXT PRIMARY KEY,
  climb_id   TEXT NOT NULL REFERENCES climbs(id),
  user_id    TEXT NOT NULL,
  image_url  TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

-- 3. Migrate existing rows (url → image_url, caption dropped)
INSERT INTO climb_images (id, climb_id, user_id, image_url, sort_order, created_at, deleted_at)
SELECT id, climb_id, user_id, url, sort_order, created_at, deleted_at
FROM climb_images_v9;

-- 4. Drop old table
DROP TABLE climb_images_v9;

-- 5. Create pins table
CREATE TABLE climb_image_pins (
  id             TEXT PRIMARY KEY,
  climb_image_id TEXT NOT NULL REFERENCES climb_images(id),
  pin_type       TEXT NOT NULL CHECK (pin_type IN ('lh', 'rh', 'lf', 'rf')),
  x_pct          REAL NOT NULL,
  y_pct          REAL NOT NULL,
  description    TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Each statement is a separate `await db.execute(...)` call inside the migration function.

---

## Schema (`climb-images.schema.ts`)

```ts
export const PinType = z.enum(['lh', 'rh', 'lf', 'rf'])
export type PinType = z.infer<typeof PinType>

export const ClimbImageSchema = z.object({
  id: z.string(),
  climb_id: z.string(),
  user_id: z.string(),
  image_url: z.string(),
  sort_order: z.number().int(),
  created_at: z.string(),
  deleted_at: z.string().nullable().optional(),
})
export type ClimbImage = z.infer<typeof ClimbImageSchema>

export const ClimbImagePinSchema = z.object({
  id: z.string(),
  climb_image_id: z.string(),
  pin_type: PinType,
  x_pct: z.number(),
  y_pct: z.number(),
  description: z.string().nullable().optional(),
  sort_order: z.number().int(),
  created_at: z.string(),
})
export type ClimbImagePin = z.infer<typeof ClimbImagePinSchema>

export const AddPinFormSchema = z.object({
  pin_type: PinType,
  x_pct: z.number().min(0).max(100),
  y_pct: z.number().min(0).max(100),
  description: z.string().optional(),
})
export type AddPinFormValues = z.infer<typeof AddPinFormSchema>
```

---

## Image utility (`src/lib/image-utils.ts`)

```ts
export async function resizeAndCompress(
  file: File,
  maxPx = 1920,
  quality = 0.8,
): Promise<Blob>
```

Pure Canvas API — draw file onto a canvas capped at `maxPx` on the longest side, call `canvas.toBlob('image/jpeg', quality)`. No external libraries.

---

## Service functions (`climb-images.service.ts`)

```ts
// Reads
fetchClimbImages(climbId: string): Promise<ClimbImage[]>
  // SELECT * FROM climb_images WHERE climb_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC

fetchClimbImagePins(climbImageId: string): Promise<ClimbImagePin[]>
  // SELECT * FROM climb_image_pins WHERE climb_image_id = ? ORDER BY sort_order ASC

countUserImages(userId: string): Promise<number>
  // SELECT COUNT(*) FROM climb_images WHERE user_id = ? AND deleted_at IS NULL

// Writes
insertClimbImage(climbId, userId, imageUrl, sortOrder): Promise<string>   // returns new id
softDeleteClimbImage(id: string): Promise<void>
updateClimbImageOrder(id: string, sortOrder: number): Promise<void>
insertClimbImagePin(climbImageId, values: AddPinFormValues, sortOrder): Promise<string>
deleteClimbImagePin(id: string): Promise<void>   // hard delete — pins have no soft delete

// Sync apply (used by pull functions)
applyRemoteClimbImage(image: ClimbImage): Promise<void>   // INSERT OR REPLACE
applyRemoteClimbImagePin(pin: ClimbImagePin): Promise<void>   // INSERT OR REPLACE
```

---

## Query hooks (`climb-images.queries.ts`)

```ts
useClimbImages(climbId: string)           // queryKey: ['climb-images', climbId]
useClimbImagePins(climbImageId: string)   // queryKey: ['climb-image-pins', climbImageId]

useAddClimbImage()
// 1. countUserImages — throw if >= 100
// 2. resizeAndCompress(file)
// 3. Upload to Supabase Storage: bucket 'climb-images', path `${userId}/${climbId}/${uuid}.jpg`
// 4. Get public URL
// 5. insertClimbImage(...)
// onSuccess: invalidate ['climb-images', climbId]

useDeleteClimbImage()
// 1. softDeleteClimbImage(id)
// 2. supabase.storage.from('climb-images').remove([storagePath])
// onSuccess: invalidate ['climb-images']

useReorderClimbImages()
// updateClimbImageOrder for each item in the new order
// onSuccess: invalidate ['climb-images']

useAddClimbImagePin()
// insertClimbImagePin(...)
// onSuccess: invalidate ['climb-image-pins', climbImageId]

useDeleteClimbImagePin()
// deleteClimbImagePin(id)
// onSuccess: invalidate ['climb-image-pins', climbImageId]
```

---

## Sync additions (`sync.service.ts`)

```ts
pushClimbImages(userId: string): Promise<void>
  // SELECT all non-deleted climb_images WHERE user_id = ?
  // supabase.from('climb_images').upsert(rows, { onConflict: 'id' })

pullClimbImages(userId: string, since?: string): Promise<void>
  // supabase.from('climb_images').select('*').eq('user_id', userId)[.gt('created_at', since)]
  // applyRemoteClimbImage for each row

pushClimbImagePins(userId: string): Promise<void>
  // JOIN: SELECT cip.* FROM climb_image_pins cip JOIN climb_images ci ON ci.id = cip.climb_image_id WHERE ci.user_id = ?
  // supabase.from('climb_image_pins').upsert(rows, { onConflict: 'id' })

pullClimbImagePins(userId: string, since?: string): Promise<void>
  // supabase.from('climb_image_pins').select('*, climb_images!inner(user_id)').eq('climb_images.user_id', userId)
  // applyRemoteClimbImagePin for each row
```

Add to `runSync` in `useSync.ts` (after burns): call all four, then invalidate `['climb-images']` and `['climb-image-pins']`.

---

## Components

### `PinMarker` (atom)
```ts
interface PinMarkerProps {
  type: PinType
  x_pct: number   // 0–100, absolute positioned over parent
  y_pct: number
  selected?: boolean
  onPress?: () => void
}
```
Small circle, absolutely positioned, colour per type (LH = accent-primary, RH = accent-secondary, LF = amber, RF = emerald). Touch target min 48×48px — inflate with padding around a smaller visual dot.

### `ImageGallery` (molecule)
```ts
interface ImageGalleryProps {
  climbId: string
  onImagePress: (imageId: string) => void
}
```
- Calls `useClimbImages` and `useAddClimbImage` internally
- Horizontal `overflow-x-auto` row of thumbnails
- First item = "+" add button → triggers `<input type="file" accept="image/*">`
- Drag-to-reorder via pointer events (no DnD library), calls `useReorderClimbImages` on drop
- Each thumbnail shows a small pin-count badge (from `useClimbImagePins`)
- Long-press → delete confirmation via inline `useState<string | null>(confirmDeleteId)`

### `ImageViewer` (organism)
```ts
interface ImageViewerProps {
  imageId: string | null   // null = closed
  climbId: string          // needed to navigate prev/next
  onClose: () => void
}
```
- Fixed full-screen overlay when `imageId` is non-null
- Calls `useClimbImagePins(imageId)`, `useAddClimbImagePin()`, `useDeleteClimbImagePin()`
- **View mode** (default): pins non-interactive, tap pin → bottom-sheet description
- **Edit mode** (pencil toggle): tap image surface → place new pin (select type + description modal); pins draggable via pointer events; each pin shows `×` delete button
- Left/right arrows to navigate sibling images (use ordered list from `useClimbImages(climbId)`)
- Internal state:
  ```ts
  const [editMode, setEditMode] = useState(false)
  const [pendingPin, setPendingPin] = useState<{ x_pct: number; y_pct: number } | null>(null)
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null)
  ```

### `ClimbDetailView` integration
```tsx
const [viewerImageId, setViewerImageId] = useState<string | null>(null)

// In JSX (after badge row, before Edit button):
<ImageGallery climbId={climbId} onImagePress={setViewerImageId} />
<ImageViewer imageId={viewerImageId} climbId={climbId} onClose={() => setViewerImageId(null)} />
```

---

## CSP update (`src-tauri/tauri.conf.json`)

Add `https://*.supabase.co` to the `img-src` directive. Already present in `connect-src`.

---

## Supabase setup (manual, outside codebase)

Before integration testing in Phase 6:
1. Create `climb-images` Storage bucket — **private**
2. Storage policy: authenticated users can read/write only their own path prefix (`{userId}/...`)
3. Create `climb_images` table in Supabase (matching SQLite schema)
4. Create `climb_image_pins` table in Supabase
5. RLS on `climb_images`: `user_id = auth.uid()` for all operations
6. RLS on `climb_image_pins`: join to `climb_images`, enforce `climb_images.user_id = auth.uid()`

---

## Implementation phases

| Phase | Work | Files |
|---|---|---|
| 1 | v13 migration + schema | `db.ts`, `climb-images.schema.ts` |
| 2 | Service layer + image util | `climb-images.service.ts`, `image-utils.ts` |
| 3 | Query hooks | `climb-images.queries.ts` |
| 4 | Sync | `sync.service.ts`, `useSync.ts` |
| 5 | CSP | `tauri.conf.json` |
| 6 | Components | `PinMarker.tsx`, `ImageGallery.tsx`, `ImageViewer.tsx` |
| 7 | ClimbDetailView integration | `ClimbDetailView.tsx` |
| 8 | Docs | `climb-images/README.md`, `components/README.md`, `sync/README.md`, `lib/README.md` |

Lint + typecheck after every phase before moving to the next.
