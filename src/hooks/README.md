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

## Planned hooks

These are not yet implemented but are part of the planned architecture:

| Hook | Purpose |
|---|---|
| `useAndroidBackButton` | Intercepts hardware back button; navigates back or exits app at root. Call in `AppLayout`. |
| `useOnlineStatus` | Returns `{ isOnline: boolean }` using the Network Information API. Used to gate sync attempts. |
| `useAuth` | Wraps session restore on launch + exposes `login` / `logout` actions backed by `auth.service`. |
