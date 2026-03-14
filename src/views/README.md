# src/views

One view per route. Views are the only place where layout, data hooks, and navigation come together. They contain no raw DB or Supabase calls — data comes exclusively from `*.queries.ts` hooks.

Router defined in `src/router.tsx` using `createMemoryHistory` (required for Android WebView).

---

## Route table

| Route | View | Auth | Description |
|---|---|---|---|
| `/` | `HomeView` | required | Climb log list; tap to detail, swipe/tap to delete |
| `/climbs/add` | `AddClimbView` | required | New climb form; accepts optional `?routeId=&routeName=&grade=&routeType=` to pre-fill from a route |
| `/climbs/$climbId` | `ClimbDetailView` | required | Full climb detail; navigate to edit |
| `/climbs/$climbId/edit` | `EditClimbView` | required | Edit existing climb |
| `/profile` | `ProfileView` | public | Login / logout / forgot password; shows user info when authenticated |
| `/reset-password` | `ResetPasswordView` | public | Set new password after tapping reset link from email |
| `/map` | `MapView` | required | Interactive map with Discovery (all downloaded crags) and Personal (crags with user's climbs) modes |
| `/search` | `SearchView` | required | Real-time search across downloaded locations and routes |
| `/routes` | `RoutesView` | required | Route Manager — browse countries → regions; download regions |
| `/regions/$regionId` | `RegionView` | required | Sub-regions for a region; tap navigates to SubRegionView |
| `/sub-regions/$subRegionId` | `SubRegionView` | required | Crags list with admin-editable description |
| `/crags/$cragId` | `CragView` | required | Walls list with admin-editable description; tap navigates to WallView |
| `/walls/$wallId` | `WallView` | required | Routes list with admin-editable description; tap navigates to RouteDetailView |
| `/routes/$routeId` | `RouteDetailView` | required | Route detail with grade, type, description; "Log this climb" button |
| `/routes/submit` | `SubmitRouteView` | required | Submit a new route (`?wallId=&wallName=`) |
| `/admin/locations` | `admin/LocationManagerView` | admin | Add/delete countries and regions in Supabase |
| `/admin/locations/pending` | `admin/LocationVerificationView` | admin | Verify or reject pending sub-area/crag/wall submissions |
| `/admin/routes` | `admin/RouteVerificationView` | admin | Verify, edit, reject, or merge pending routes |

---

## Auth guards

`requireAuth` — redirects to `/profile` if not authenticated. Applied to all routes except `/profile`.

`requireAdmin` — redirects to `/profile` if not authenticated, or `/` if authenticated but not admin. Applied to `/admin/*` routes.

---

## View responsibilities

### HomeView `/`
Loads `useClimbs()`. Renders search input, `FilterPanel` molecule, and filtered list of `ClimbCard` molecules. Filters by status (sent/project/todo), type (sport/boulder), and free-text search across name, grade, country, area, and sub-area. Filter state lives in `climbs.store` and persists across navigation. Navigates to `/climbs/$climbId` on tap. Calls `useDeleteClimb()` for inline delete.

### AddClimbView `/climbs/add`
Renders `ClimbForm` organism in "add" mode. Reads optional search params (`routeId`, `routeName`, `grade`, `routeType`) to pre-fill the form when logging a specific route from `CragView`. On success navigates to `/`.

### ClimbDetailView `/climbs/$climbId`
Loads `useClimb(climbId)` and `useBurns(climbId)`. Displays all climb fields. Has "Edit" button → `/climbs/$climbId/edit`. Burns section with inline add/edit forms and soft-delete. Each burn has a date and optional notes.

### EditClimbView `/climbs/$climbId/edit`
Loads `useClimb(climbId)`. Renders `ClimbForm` in "edit" mode with prefilled values. If `climb.route_id` is null, shows a "Link to route" search section (`useLinkClimbToRoute`). On success navigates back to detail.

### ProfileView `/profile`
Public (no auth guard). Shows login form when unauthenticated (`signIn` / `signUp` / `forgot password`). Shows user info + logout when authenticated. Settings panel includes a Dark/Light theme toggle (persisted to localStorage via `ui.store`).

### ResetPasswordView `/reset-password`
Public (no auth guard). Shown after user taps a password reset link from email. The `PASSWORD_RECOVERY` auth event in `App.tsx` navigates here automatically. Calls `updatePassword()` on submit, then redirects to `/profile`.

### MapView `/map`
Loads `useAllCragsWithCoords()` and `usePersonalCrags()`. Two modes: Discovery shows all downloaded crags with coordinates as emerald pins; Personal shows crags where user has logged climbs as amber pins with climb count and sent/project badges. Mode toggle and filter checkboxes (Sport/Boulder for Discovery, Sent/Project for Personal). Tapping a pin popup navigates to `/crags/$cragId`. Uses Leaflet + OpenStreetMap tiles via `react-leaflet`.

### SearchView `/search`
Real-time search across all downloaded locations (sub-regions, crags, walls) and routes. Two checkboxes filter by Locations and Routes. Minimum 2 characters to search. Results link to their respective detail views. Local SQLite cache only — no network requests.

### RoutesView `/routes`
Route Manager. Loads `useCountries()` and `useDownloadedRegionIds()`. Renders country list → inline region list per country. Each region shows download status and a download button. Navigates to `/regions/$regionId` on tap.

### RegionView `/regions/$regionId`
Loads `useSubRegions(regionId)`. Lists sub-regions as tappable cards. Tap navigates to `/sub-regions/$subRegionId`. Has "Add sub-area" inline form. Back button navigates to `/routes`.

### SubRegionView `/sub-regions/$subRegionId`
Loads `useSubRegion(id)` and `useCrags(subRegionId)`. Shows name, admin-editable description (`EditableDescription`), and list of crags. Tap navigates to `/crags/$cragId`. Back button navigates up to `/regions/$regionId`.

### CragView `/crags/$cragId`
Loads `useCrag(id)` and `useWalls(cragId)`. Shows name, admin-editable description, and list of walls. Tap navigates to `/walls/$wallId`. Has "Add wall" inline form (`useSubmitWall`). Back button navigates up to `/sub-regions/$subRegionId`.

### WallView `/walls/$wallId`
Loads `useWall(id)` and `useRoutes(wallId)`. Shows name, admin-editable description, and list of routes. Tap a verified route to navigate to `/routes/$routeId`. Has "Submit a route" button. Back button navigates up to `/crags/$cragId`.

### RouteDetailView `/routes/$routeId`
Loads `useRoute(id)`. Shows route name, grade, route type badge, and description. "Log this climb" button navigates to `/climbs/add` with route pre-filled. Back button navigates up to `/walls/$wallId`.

### SubmitRouteView `/routes/submit`
Reads `wallId` and `wallName` from search params. Renders route submission form. Calls `useSubmitRoute()`. On success navigates back.

### admin/LocationManagerView `/admin/locations`
Admin only. Loads countries + regions. Inline forms to add/delete entries. Calls admin mutation functions from `locations.service`.

### admin/RouteVerificationView `/admin/routes`
Admin only. Loads `useUnverifiedRoutes()`. For each route: verify, edit fields inline, reject, or merge duplicate.

---

## Typography

All view-level `<h1>` headings, route/climb names, and grade displays use `font-display` (Lora serif). Body text, labels, and form elements use the default `font-body` (Source Sans 3 sans-serif, set on `<body>`).

---

## Navigation patterns

```ts
// Navigate to a route
const navigate = useNavigate()
navigate({ to: '/climbs/$climbId', params: { climbId: id } })

// Navigate with search params
navigate({ to: '/routes/submit', search: { wallId, wallName } })

// Go back
const router = useRouter()
router.history.back()
```
