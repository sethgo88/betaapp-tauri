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
| `/routes` | `RoutesView` | required | Browse countries → regions; download regions |
| `/regions/$regionId` | `RegionView` | required | Sub-regions for a region; shows download status |
| `/crags/$cragId` | `CragView` | required | Walls → routes; tap a route to log it; "Add wall" inline form |
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
Loads `useClimbs()`. Renders a list of `ClimbCard` molecules. Navigates to `/climbs/$climbId` on tap. Calls `useDeleteClimb()` for inline delete.

### AddClimbView `/climbs/add`
Renders `ClimbForm` organism in "add" mode. Reads optional search params (`routeId`, `routeName`, `grade`, `routeType`) to pre-fill the form when logging a specific route from `CragView`. On success navigates to `/`.

### ClimbDetailView `/climbs/$climbId`
Loads `useClimb(climbId)`. Displays all climb fields. Has "Edit" button → `/climbs/$climbId/edit`.

### EditClimbView `/climbs/$climbId/edit`
Loads `useClimb(climbId)`. Renders `ClimbForm` in "edit" mode with prefilled values. If `climb.route_id` is null, shows a "Link to route" search section (`useLinkClimbToRoute`). On success navigates back to detail.

### ProfileView `/profile`
Public (no auth guard). Shows login form when unauthenticated (`signIn` / `signUp` / `forgot password`). Shows user info + logout when authenticated.

### ResetPasswordView `/reset-password`
Public (no auth guard). Shown after user taps a password reset link from email. The `PASSWORD_RECOVERY` auth event in `App.tsx` navigates here automatically. Calls `updatePassword()` on submit, then redirects to `/profile`.

### RoutesView `/routes`
Loads `useCountries()` and `useDownloadedRegionIds()`. Renders country list → inline region list per country. Each region shows download status and a download button. Navigates to `/regions/$regionId` on tap.

### RegionView `/regions/$regionId`
Loads `useSubRegions(regionId)`. Lists sub-regions. Navigates to `/crags/$cragId` on tap.

### CragView `/crags/$cragId`
Loads `useWalls(cragId)` and `useRoutes(wallId)`. Lists walls with their routes. Tap a verified route to navigate to `/climbs/add` with route pre-filled. Has "Add wall" inline form (`useSubmitWall`) and "Submit a route" button per wall.

### SubmitRouteView `/routes/submit`
Reads `wallId` and `wallName` from search params. Renders route submission form. Calls `useSubmitRoute()`. On success navigates back.

### admin/LocationManagerView `/admin/locations`
Admin only. Loads countries + regions. Inline forms to add/delete entries. Calls admin mutation functions from `locations.service`.

### admin/RouteVerificationView `/admin/routes`
Admin only. Loads `useUnverifiedRoutes()`. For each route: verify, edit fields inline, reject, or merge duplicate.

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
