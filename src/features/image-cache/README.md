# features/image-cache

File-based offline image cache. Image bytes live as files in app-private storage (`$APPDATA/image-cache/`, via `src/lib/image-cache.ts` / `tauri-plugin-fs`); SQLite only tracks them. Replaces the old base64 `climb_images.local_data`.

## Schema (SQLite, migration v35)

```sql
cached_images(
  key        TEXT PRIMARY KEY,   -- remote identity of the image (see keys)
  local_path TEXT NOT NULL,      -- file name inside image-cache/ ("{sha256(key)}.{webp|jpg|png}")
  bytes      INTEGER NOT NULL,
  created_at TEXT
)
cached_image_refs(
  key TEXT, scope_type TEXT, scope_id TEXT,
  PRIMARY KEY (key, scope_type, scope_id)
)
```

A file is deleted only when its last ref is released, so an image shared by several downloaded areas survives deleting one of them.

## Keys and scopes (`image-cache.keys.ts`)

| Key | Image |
|---|---|
| public URL | route / wall / topo images |
| `climbImageKey(path)` → `climb:{storagePath}` | personal climb photos (private bucket) |

Scope `{ type, id }`: `climb` + climbId for personal photos today. Area downloads (#253) add sub-region / crag / route scopes.

## Service (`image-cache.service.ts`)

| Function | Description |
|---|---|
| `cacheImage(key, blob, scope)` | Writes the file (if the key isn't cached yet), records it, adds the scope ref |
| `addRef(key, scope)` | Link an already-cached key to another scope |
| `releaseRef(key, scope)` | Unlink; deletes file + row when no refs remain |
| `releaseScope(scope)` | Unlink every key from a scope (delete a downloaded area / climb) |
| `getCachedKeys(keys)` | Which of the given keys are cached |
| `readCachedBlob(key)` | Blob from disk, or `null` (stale rows whose file vanished are dropped) |
| `getCacheStats(scope?)` | `{ count, bytes }` overall, for one scope (`{ type, id }`), or for every scope of a type (`{ type }`, e.g. all personal photos) — feeds the Image Manager |
| `migrateLocalDataToFiles()` | One-time launch job: legacy base64 `local_data` → files, clears the column; failures retry next launch |

## Hook (`image-cache.queries.ts`)

`useCachedImageUrl(cacheKey, remoteUrl)` — resolves a cached file to an object URL (revoked on unmount) and falls back to `remoteUrl`. Runs with `networkMode: 'offlineFirst'`. Mutations that change the cache invalidate `[CACHED_IMAGE_KEY]`. UI should use the `CachedImage` atom rather than calling this directly.

## Notes

- Images are displayed via blob object URLs, so no asset-protocol or CSP changes are needed (`img-src` already allows `blob:`).
- Requires the Tauri `fs` plugin and capability scoped to `$APPDATA/image-cache/**` (see `docs/android.md`).
