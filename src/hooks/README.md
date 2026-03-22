# src/hooks

Custom React hooks for cross-cutting concerns. Each hook encapsulates a single behaviour that would otherwise be repeated across multiple views.

**Rule:** Hooks may use Zustand stores and TanStack Query, but must not contain JSX or raw DB/Supabase calls — delegate those to `*.service.ts` or `*.queries.ts`.

---

## useSync

**File:** `useSync.ts`
**Call from:** Root layout (`AppLayout`) — once, with `userId` from `auth.store`

```ts
import { useSync } from '@/hooks/useSync'

// In AppLayout or root component:
const userId = useAuthStore((s) => s.user?.id)
useSync(userId)
```

**What it does:**
- Runs a full sync on mount (push climbs → pull climbs → pull grades → pull countries → pull regions)
- Opens a Supabase Realtime channel on `climbs` filtered by `user_id`
- Applies live Realtime changes via `applyRemoteClimb()`
- Cleans up the Realtime channel on unmount / when `userId` becomes undefined (logout)
- Updates `sync.store` throughout (`setSyncing` / `setSuccess` / `setError`)

**When `userId` is undefined:** hook is a no-op — no sync, no Realtime.

See [`features/sync/README.md`](../features/sync/README.md) for full sync flow details.

---

---

## useAndroidBackButton

**File:** `useAndroidBackButton.ts`
**Call from:** `AppLayout` — once, unconditionally.

```ts
import { useAndroidBackButton } from '@/hooks/useAndroidBackButton'

// In AppLayout:
useAndroidBackButton()
```

**What it does:**
- Registers `onBackButtonPress` from `@tauri-apps/api/app`
- If `router.history.length > 1`: calls `router.history.back()`
- At root: does nothing — the OS closes the app naturally
- Cleans up via `listener.unregister()` on unmount

---

## useCurrentRoute

**File:** `useCurrentRoute.ts`
**Call from:** `NavBar` — used to highlight the active tab.

```ts
import { useCurrentRoute } from '@/hooks/useCurrentRoute'

const currentRoute = useCurrentRoute() // e.g. "/" or "/search"
```

**What it does:**
- Returns the current pathname from TanStack Router state via `useRouterState`
- Used by `NavBar` to apply `text-accent-primary` to the active icon

---

## useTopBar

**File:** `useTopBar.ts`
**Call from:** `AppLayout` — once, unconditionally.

```ts
import { useTopBar } from '@/hooks/useTopBar'

const topBar = useTopBar()
// topBar.backLabel   — parent name for back button ("Astral Wall", "Home", etc.), null if no back button
// topBar.goBack()    — navigate to parent
// topBar.siblings    — sibling items at current level [{id, label, sublabel?, isCurrent}]
// topBar.goToSibling(id) — navigate to a sibling
```

**What it does:**
- Parses the current route to determine the back button target and sibling context
- Hierarchy views (region, sub-region, crag, wall, route detail): back goes to parent, siblings show peers at the same level
- Edit views: back goes to the detail view being edited
- Most other views: back goes to Home
- HomeView and ResetPasswordView: no back button (backLabel is null)

---

## Planned hooks

| Hook | Purpose |
|---|---|
| `useOnlineStatus` | Returns `{ isOnline: boolean }` using the Network Information API. Used to gate sync attempts. |
| `useAuth` | Wraps session restore on launch + exposes `login` / `logout` actions backed by `auth.service`. |
