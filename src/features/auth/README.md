# features/auth

Handles Supabase authentication, local user profile, and admin role detection.

---

## Schema

```ts
// auth.schema.ts
UserSchema = {
  id: string          // Supabase auth.users UUID
  email: string
  role: 'user' | 'admin'
  display_name: string | null
  height_cm: number | null
  ape_index_cm: number | null
  max_redpoint_sport: string | null
  max_redpoint_boulder: string | null
  default_unit: 'imperial' | 'metric'   // defaults to 'imperial'
  created_at: string
  updated_at: string
  deleted_at: string | null
}
```

---

## SQLite table

```sql
CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    email       TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'user',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at  TEXT
);
-- updated_at maintained by trigger (users_updated_at)
```

Single row per device. Written after login, cleared on logout (row retained for offline access).

---

## Supabase tables

```sql
-- User profile — display name, height, ape index, hardest grades, unit preference
public.profiles (
  id uuid pk references auth.users(id),
  display_name text,
  height_cm integer,
  ape_index integer,
  hardest_sport text,
  hardest_boulder text,
  default_unit text default 'imperial',
  updated_at timestamptz
)
-- RLS: id = auth.uid() for all operations

-- Role lookup — source of truth for admin access
public.user_roles (user_id uuid pk, role text default 'user')
```

Column name mapping (Supabase → local SQLite `users`):
- `ape_index` → `ape_index_cm`
- `hardest_sport` → `max_redpoint_sport`
- `hardest_boulder` → `max_redpoint_boulder`

Role is **not** read from `public.users.role` — always fetched from `user_roles` after login.

---

## auth.service.ts

| Function | What it does |
|---|---|
| `signIn(email, password)` | `signInWithPassword` → returns Session |
| `signUp(email, password)` | Creates account + returns Session (email confirm must be off) |
| `sendPasswordReset(email)` | `resetPasswordForEmail` — sends reset link; redirects via Supabase Edge Function → `betaapp://auth/callback` |
| `updatePassword(newPassword)` | `updateUser({ password })` — call from ResetPasswordView after `PASSWORD_RECOVERY` event |
| `sendMagicLink(email)` | `signInWithOtp` — sends magic link email; redirects via Supabase Edge Function → `betaapp://auth/callback` |
| `restoreSession(timeoutMs?)` | `supabase.auth.getSession()` with a configurable timeout (default 5s; 3s in the offline branch). Rejects on timeout so Bootstrap can fall back to local cache. Called on app launch for both online and offline paths. |
| `fetchLocalUser()` | Reads the last-cached user from local SQLite `users`. Used as the offline fallback in Bootstrap. Returns `null` if never logged in. |
| `signOut()` | Clears Supabase session |
| `updateUserProfile(userId, profile)` | Upserts to Supabase `profiles` (throws on error), then updates local SQLite; returns updated User |
| `fetchAndApplyProfile(userId)` | Fetches from Supabase `profiles`, merges into local SQLite `users`; returns updated User |
| `upsertLocalUser(id, email, role)` | Writes/updates the local `users` row; migrates climbs if a pre-auth UUID exists |
| `fetchOrCreateSupabaseUser(userId, email)` | Reads role from `user_roles` → returns `'user' \| 'admin'` |
| `initDeepLinkHandler(onSession)` | Listens for `betaapp://auth/callback`, exchanges `code` for session, calls `onSession` |

---

## auth.store.ts

```ts
interface AuthStore {
  user: User | null
  session: Session | null
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
}
```

`isAuthenticated` is `true` when either `setSession(session)` is called with a non-null session (online login / successful token restore) **or** `setUser(user)` is called with a non-null user (offline local-cache fallback). Setting either to `null` clears `isAuthenticated`.

---

## Session lifecycle

```
App launch (online):
  navigator.onLine check → true
  restoreSession() [5s timeout] → if session exists → setSession
  fetchOrCreateSupabaseUser(id) → get role
  upsertLocalUser(id, email, role)
  fetchAndApplyProfile(id) → merge Supabase profile into local SQLite → setUser
  useSync fires (userId now defined)

App launch (offline):
  isOnline = navigator.onLine && !(DEV && betaapp-debug-offline flag)  → false
  restoreSession(3s timeout) → reads localStorage token cache (no network for valid token)
    if session returned → setSession + fetchLocalUser() → setUser; proceed offline
    if expired token → Supabase attempts refresh; times out after 3s → falls through
    if no session → falls through
  No session path: fetchLocalUser() → setUser (sets isAuthenticated=true if user exists)
  onAuthStateChange INITIAL_SESSION + null → ignored (guarded); does not wipe auth state
  When connectivity returns → window 'online' event fires → useSync.runSync() auto-triggered

App launch (online but restoreSession times out):
  restoreSession() [5s timeout] throws → fetchLocalUser() → setUser (sets isAuthenticated=true if user exists)
  App renders with cached data; no sync attempted

Login (password):
  signIn(email, password) → setSession
  fetchOrCreateSupabaseUser(id) → get role
  upsertLocalUser(id, email, role)
  fetchAndApplyProfile(id) → merge Supabase profile into local SQLite → setUser
  useSync fires (userId now defined)

Login (magic link):
  sendMagicLink(email) → email sent (emailRedirectTo = Supabase Edge Function URL)
  User taps link in Gmail → HTTPS link opens (Gmail blocks custom schemes)
  Edge Function (supabase/functions/auth-redirect) → 302 to betaapp://auth/callback?code=...
  Android intent filter catches betaapp:// → app opens
  checkPendingDeepLink / initDeepLinkHandler fires
  exchangeCodeForSession(code) → session
  fetchOrCreateSupabaseUser(id) → get role
  upsertLocalUser(id, email, role)
  fetchAndApplyProfile(id) → merge Supabase profile into local SQLite → setUser
  router.navigate({ to: '/' }) — explicit nav needed; router already redirected to /profile
  useSync fires (userId now defined)

Password reset:
  sendPasswordReset(email) → email sent; user taps link
  Deep link opens app → onAuthStateChange fires PASSWORD_RECOVERY event
  App navigates to /reset-password
  User enters new password → updatePassword(newPassword)
  Redirected to /profile

Logout:
  signOut() → setSession(null) → setUser(null)
  Realtime channel unsubscribed (useSync cleanup)
  Local data retained (local-first)
```

---

## Admin guard

Routes that require admin role use `requireAdmin` in the router:

```ts
// router.tsx
const requireAdmin = () => {
  const { isAuthenticated, user } = useAuthStore.getState()
  if (!isAuthenticated) throw redirect({ to: '/profile' })
  if (user?.role !== 'admin') throw redirect({ to: '/' })
}
```

Admin routes: `/admin/locations`, `/admin/routes`
