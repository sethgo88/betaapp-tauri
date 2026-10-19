# features/image-downloads

Download the non-personal images (route images, wall images, wall topos, route topos) for an area **and everything under it** so they display offline. Bytes are stored through `features/image-cache`; this feature decides *which* images belong to an area and tracks what has been downloaded.

## Scopes

`sub_region` → `crag` → `wall` → `route`. A scope includes all descendants (e.g. a crag: its walls' images and topos plus every route's images and topos). A `route` scope includes the route's own images/topo and its wall's topo (shown on the route page when the route has no topo of its own). Images are de-duplicated by URL — a topo that reuses a gallery image counts once.

The hierarchy comes from the local cache tables (`sub_regions_cache` → `crags_cache` → `walls_cache` → `routes_cache`), which are filled by the region data download. Image rows are already local for everything (pulled by sync), so counting and sizing needs no network. If the area's region data isn't on the device, `downloadScopeImages` runs `downloadRegion(regionId)` first and the confirm dialog says so.

## Schema (SQLite, migration v36)

```sql
image_downloads(
  scope_type TEXT, scope_id TEXT,         -- PRIMARY KEY (scope_type, scope_id)
  name TEXT,                              -- area name, for the Image Manager
  status TEXT,                            -- 'complete' | 'partial'
  image_count INTEGER,                    -- unique images in scope at last download
  downloaded_at TEXT                      -- set when complete
)
```

Sizes and counts of what is on disk come from `getCacheStats({ type, id })` (image-cache); files are linked to an area through `cached_image_refs` with `scope_type`/`scope_id` equal to the area, so shared files survive deleting one area.

## Service (`image-downloads.service.ts`)

| Function | Description |
|---|---|
| `resolveScope(type, id)` | `{ regionId, name }` by walking up the local cache |
| `isRegionDataDownloaded(regionId)` | Checks `downloaded_regions` |
| `collectScopeImages(type, id)` | All unique `{ key, sizeBytes }` in the area (chunked `IN` queries) |
| `getScopeSummary(type, id)` | `{ total, toDownload, knownBytes, unknownCount, toRemove, regionDataMissing, areaName, regionName }` for the confirm dialog; only images not yet cached count; images without a recorded size are reported separately (`unknownCount`), not estimated |
| `downloadScopeImages(type, id, { signal, onProgress, fetchImpl })` | Downloads region data if needed, registers the area as `partial`, unlinks images that left the area, links already-cached images, fetches the rest with a pool of 4, then marks `complete` (not if cancelled or any image failed). Re-running resumes without refetching cached files, and doubles as "re-fetch" |
| `deleteScopeImages(type, id)` | `releaseScope` + remove the registry row |
| `fetchImageDownloads()` / `fetchImageDownload(type, id)` | Registry reads |
| `getAreaImageStatuses()` | Per downloaded area: `{ record, stats (on disk), pendingUpdate: { added, removed } \| null }`. An update = images currently in the area that aren't linked to it in `cached_image_refs` (added), or linked images no longer in the area (removed); computed from local data (sync already pulled the newest rows). Partial areas never report updates |
| `getStorageOverview()` | `{ total, personal }` cache stats |
| `listPersonalPhotoClimbs()` | Climbs with photo files under scope `climb`: `{ climbId, label, photoCount, bytes, offlineAvailable }` |

## Store & hooks

`image-downloads.store.ts` — Zustand; holds the single active job (`{ type, id, done, total, preparing, controller }`) so progress survives navigation. `image-downloads.queries.ts`:

| Hook | Description |
|---|---|
| `useImageDownloads()` | All registered areas |
| `useImageDownloadRecord(type, id)` | One area's record |
| `useScopeSummary()` | Mutation → `ScopeSummary` for the dialog |
| `useStartImageDownload()` | Runs a download (one at a time), toasts the outcome, invalidates `image-downloads`, `cached-image`, `downloaded_regions` |
| `useDeleteImageDownload()` | Removes an area's images |
| `useAreaImageStatuses()` / `useImageUpdateCount()` | Manager rows; number of areas with updates (banner). Sync invalidates `image-downloads` so this refreshes after each sync |
| `useStorageOverview()` / `usePersonalPhotoClimbs()` | Totals and per-climb personal photo list |
| `useRemoveClimbOfflinePhotos()` | Releases a climb's uploaded photo files and clears `offline_available`; pending-upload photos are kept |

Deleted gallery images: `pullRouteImages` / `pullWallImages` fully re-pull and prune the local cache (`pruneCacheRows`; an empty server response prunes nothing), so an image an admin deletes disappears from the local lists after the next sync. For a downloaded area it shows as a removed image (`pendingUpdate.removed`, chip "Updates available (−N)"); the Re-fetch dialog says how many will be deleted from the device and re-fetching releases the files.

UI: `components/molecules/DownloadImagesButton`.
