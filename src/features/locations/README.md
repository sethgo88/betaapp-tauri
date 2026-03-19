# features/locations

5-level location hierarchy: Country → Region → Sub-Region → Crag → Wall.

**Ownership:** Countries and Regions are admin-only. Sub-Regions, Crags, and Walls are user-submitted and admin-verified (same `status` model as Routes).

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
SubRegionSchema  = { id, region_id, name, description?, sort_order, status, created_by?, created_at }
CragSchema       = { id, sub_region_id, name, description?, sort_order, status, created_by?, created_at, lat?, lng?, sport_count, trad_count, boulder_count }
WallSchema       = { id, crag_id, name, description?, sort_order, status, created_by?, created_at, lat?, lng?, wall_type, sport_count, trad_count, boulder_count }

// wall_type: 'wall' | 'boulder' — physical feature type, set at creation

// status: 'pending' | 'verified' | 'rejected'
```

---

## SQLite tables

```sql
-- Replaced wholesale on launch sync
CREATE TABLE IF NOT EXISTS countries_cache (id, name, code, sort_order, created_at);
CREATE TABLE IF NOT EXISTS regions_cache   (id, country_id, name, sort_order, created_at);

-- Populated on-demand / region download
CREATE TABLE IF NOT EXISTS sub_regions_cache (id, region_id, name, description, sort_order, status, created_by, created_at);
CREATE TABLE IF NOT EXISTS crags_cache       (id, sub_region_id, name, description, sort_order, status, created_by, created_at, lat, lng, sport_count, trad_count, boulder_count);
CREATE TABLE IF NOT EXISTS walls_cache       (id, crag_id, name, description, sort_order, status, created_by, created_at, lat, lng, wall_type, sport_count, trad_count, boulder_count);

-- Download tracking
CREATE TABLE IF NOT EXISTS downloaded_regions (region_id TEXT PRIMARY KEY, downloaded_at TEXT, server_updated_at TEXT);
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
| `fetchSubRegion(id)` | Single sub-region by ID |
| `fetchCrag(id)` | Single crag by ID |
| `fetchWall(id)` | Single wall by ID |
| `fetchDownloadedRegionIds()` | IDs of all downloaded regions |
| `fetchDownloadedRegions()` | Full rows from `downloaded_regions` including `server_updated_at` |
| `checkRegionStaleness()` | Fetches `updated_at` from Supabase for all downloaded regions; returns IDs where server timestamp is newer than `server_updated_at` |
| `searchLocations(query)` | LIKE search across sub_regions/crags/walls cache; returns typed results with `kind` |
| `fetchAllCragsWithCoords()` | All crags with non-null lat/lng + sport/trad/boulder counts (for map Discovery mode); reads stored counts directly — no route JOIN |
| `fetchAllWallsWithCoords()` | All walls with non-null lat/lng + wall_type + sport/trad/boulder counts + crag_name (for map Discovery mode); reads stored counts directly — no route JOIN |

### Sync pulls (Supabase → cache)

| Function | When called |
|---|---|
| `pullCountries()` | Every sync run (via `useSync`) |
| `pullRegions()` | Every sync run (via `useSync`) |

Both are full replace (DELETE + INSERT).

### Region download

`downloadRegion(regionId)` — fetches the full hierarchy for a region in a single transaction:
1. Fetches `regions.updated_at` from Supabase (stored in `server_updated_at` for staleness tracking)
2. Sub-regions for the region
3. Crags for those sub-regions
4. Walls for those crags
5. **Verified routes** for those walls (only `status = 'verified'`)
6. Records `downloaded_regions` row with `server_updated_at`

If any level has no data, the download still completes and records the region as downloaded.

### User submissions (Supabase + local cache)

| Function | What it does |
|---|---|
| `submitSubRegion(values, userId, isAdmin)` | Inserts into Supabase `sub_regions` with `status='verified'` (admin) or `status='pending'` (user) + local cache |
| `submitCrag(values, userId, isAdmin)` | Inserts into Supabase `crags` with `status='verified'` (admin) or `status='pending'` (user) + local cache |
| `submitWall(values, userId, isAdmin)` | Inserts into Supabase `walls` with `status='verified'` (admin) or `status='pending'` (user) + local cache |

Admin submissions are auto-verified and immediately visible to all users. Non-admin submissions remain pending until an admin verifies them.

### Admin location verification (Supabase + local cache)

| Function | What it does |
|---|---|
| `fetchPendingLocations()` | Parallel Supabase queries for pending sub_regions, crags, and walls; sorted by date |
| `verifyLocation(table, id)` | Sets `status='verified'` in Supabase + local cache |
| `rejectLocation(table, id)` | Sets `status='rejected'` + `deleted_at` in Supabase; `status='rejected'` in local cache |
| `updateLocationDescription(table, id, description)` | Admin: updates description in Supabase + local cache |

`table` is `'sub_regions' | 'crags' | 'walls'`.

### Admin writes (Supabase direct)

| Function | What it does |
|---|---|
| `adminAddCountry(name, code, sortOrder)` | Inserts into Supabase `countries` |
| `adminDeleteCountry(id)` | Deletes from Supabase `countries` |
| `adminAddRegion(countryId, name, sortOrder)` | Inserts into Supabase `regions` |
| `adminDeleteRegion(id)` | Deletes from Supabase `regions` |
| `adminUpdateCragCoords(id, lat, lng)` | Sets crag lat/lng in Supabase + local cache |
| `adminUpdateWallCoords(id, lat, lng, cragId)` | Sets wall lat/lng in local cache + Supabase (warns on Supabase failure); triggers `inheritWallCoordsToCrag` |
| `adminUpdateWallType(id, wallType)` | Sets wall_type in Supabase + local cache |
| `inheritWallCoordsToCrag(cragId, lat, lng)` | One-time write-back: copies wall coords to crag if crag has no coords |

Admin writes go directly to Supabase. The local cache refreshes on next `pullCountries()` / `pullRegions()`.

---

## locations.queries.ts

```ts
useCountries()
useRegions(countryId)
useSubRegions(regionId)
useCrags(subRegionId)
useWalls(cragId)
useSubRegion(id)            // single entity
useCrag(id)                 // single entity
useWall(id)                 // single entity
useDownloadedRegionIds()
useStaleRegionIds()         // IDs of downloaded regions where server data is newer; populated by useSync on launch
useDownloadRegion()         // mutation
useSubmitSubRegion()        // mutation — user submission
useSubmitCrag()             // mutation — user submission
useSubmitWall()             // mutation — user submission
useSearchLocations(query)      // LIKE search across location caches (min 2 chars)
useUpdateLocationDescription() // admin mutation — { table, id, description }
usePendingLocations()       // admin — all pending items
useVerifyLocation()         // admin mutation — { table, id }
useRejectLocation()         // admin mutation — { table, id }
useAllCragsWithCoords()     // map Discovery mode — crags with lat/lng
useAllWallsWithCoords()     // map Discovery mode — walls with lat/lng
useAdminUpdateCragCoords()  // admin mutation — { id, lat, lng }
useAdminUpdateWallType()    // admin mutation — { id, wallType }
useAdminUpdateWallCoords()  // admin mutation — { id, lat, lng, cragId }
```

---

## Supabase tables

```sql
public.countries   (id, name, code, sort_order, created_at)
public.regions     (id, country_id, name, sort_order, created_at, updated_at)
-- updated_at: maintained by trigger; bumped whenever a sub_region/crag/wall/route in this region is changed
public.sub_regions (id, region_id, name, sort_order, created_at)
public.crags       (id, sub_region_id, name, sort_order, created_at, lat, lng, sport_count, trad_count, boulder_count)
public.walls       (id, crag_id, name, sort_order, created_at, lat, lng, wall_type, sport_count, trad_count, boulder_count)
-- RLS: authenticated users SELECT only; service role writes
-- crags and walls have optional lat/lng REAL columns for map coordinates
-- wall_type: 'wall' | 'boulder' — physical feature type
-- sport/trad/boulder counts maintained by Supabase trigger on route verification (see docs/migrations/025_wall_type_counts.sql)
```
