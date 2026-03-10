# features/locations

5-level location hierarchy: Country → Region → Sub-Region → Crag → Wall.

Admin-managed reference data. Read-only for users. Cached locally; route data only available after a region download.

---

## Hierarchy

```
Country
  └─ Region           (always cached on launch)
       └─ Sub-Region  (cached on region download or navigation)
            └─ Crag   (cached on region download or navigation)
                 └─ Wall  (cached on region download or navigation)
                       └─ Route  (only after explicit region download)
```

---

## Schema

```ts
CountrySchema    = { id, name, code, sort_order, created_at }
RegionSchema     = { id, country_id, name, sort_order, created_at }
SubRegionSchema  = { id, region_id, name, sort_order, created_at }
CragSchema       = { id, sub_region_id, name, sort_order, created_at }
WallSchema       = { id, crag_id, name, sort_order, created_at }
```

---

## SQLite tables

```sql
-- Replaced wholesale on launch sync
CREATE TABLE IF NOT EXISTS countries_cache (id, name, code, sort_order, created_at);
CREATE TABLE IF NOT EXISTS regions_cache   (id, country_id, name, sort_order, created_at);

-- Populated on-demand / region download
CREATE TABLE IF NOT EXISTS sub_regions_cache (id, region_id, name, sort_order, created_at);
CREATE TABLE IF NOT EXISTS crags_cache       (id, sub_region_id, name, sort_order, created_at);
CREATE TABLE IF NOT EXISTS walls_cache       (id, crag_id, name, sort_order, created_at);

-- Download tracking
CREATE TABLE IF NOT EXISTS downloaded_regions (region_id TEXT PRIMARY KEY, downloaded_at TEXT);
```

---

## locations.service.ts

### Local reads

| Function | What it does |
|---|---|
| `fetchCountries()` | All countries from cache, ordered by `sort_order` |
| `fetchRegions(countryId)` | Regions for a country |
| `fetchSubRegions(regionId)` | Sub-regions for a region |
| `fetchCrags(subRegionId)` | Crags for a sub-region |
| `fetchWalls(cragId)` | Walls for a crag |
| `fetchDownloadedRegionIds()` | IDs of all downloaded regions |

### Sync pulls (Supabase → cache)

| Function | When called |
|---|---|
| `pullCountries()` | Every sync run (via `useSync`) |
| `pullRegions()` | Every sync run (via `useSync`) |

Both are full replace (DELETE + INSERT).

### Region download

`downloadRegion(regionId)` — fetches the full hierarchy for a region in a single transaction:
1. Sub-regions for the region
2. Crags for those sub-regions
3. Walls for those crags
4. **Verified routes** for those walls (only `verified = true`)
5. Records `downloaded_regions` row

If any level has no data, the download still completes and records the region as downloaded.

### Admin writes (Supabase direct)

| Function | What it does |
|---|---|
| `adminAddCountry(name, code, sortOrder)` | Inserts into Supabase `countries` |
| `adminDeleteCountry(id)` | Deletes from Supabase `countries` |
| `adminAddRegion(countryId, name, sortOrder)` | Inserts into Supabase `regions` |
| `adminDeleteRegion(id)` | Deletes from Supabase `regions` |

Admin writes go directly to Supabase. The local cache refreshes on next `pullCountries()` / `pullRegions()`.

---

## locations.queries.ts

```ts
useCountries()
useRegions(countryId)
useSubRegions(regionId)
useCrags(subRegionId)
useWalls(cragId)
useDownloadedRegionIds()
useDownloadRegion()   // mutation
```

---

## Supabase tables

```sql
public.countries   (id, name, code, sort_order, created_at)
public.regions     (id, country_id, name, sort_order, created_at)
public.sub_regions (id, region_id, name, sort_order, created_at)
public.crags       (id, sub_region_id, name, sort_order, created_at)
public.walls       (id, crag_id, name, sort_order, created_at)
-- RLS: authenticated users SELECT only; service role writes
```
