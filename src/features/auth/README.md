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
-- User profile (mirrors local users table)
public.users (id uuid pk, email text, role text default 'user', ...)

-- Role lookup — source of truth for admin access
public.user_roles (user_id uuid pk, role text default 'user')
```

Role is **not** read from `public.users.role` — always fetched from `user_roles` after login.

---

## auth.service.ts

| Function | What it does |
|---|---|
| `signIn(email, password)` | `signInWithPassword` → returns Session |
| `signUp(email, password)` | Creates account + returns Session (email confirm must be off) |
| `restoreSession()` | `supabase.auth.getSession()` — call on app launch |
| `signOut()` | Clears Supabase session |
| `upsertLocalUser(id, email, role)` | Writes/updates the local `users` row; migrates climbs if a pre-auth UUID exists |
| `fetchOrCreateSupabaseUser(userId, email)` | Reads role from `user_roles` → returns `'user' \| 'admin'` |

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

`isAuthenticated` is derived from `session !== null`. Set both `user` and `session` after login.

---

## Session lifecycle

```
App launch:
  restoreSession() → if session exists → setSession + setUser + run sync

Login:
  signIn(email, password) → setSession
  fetchOrCreateSupabaseUser(id) → get role
  upsertLocalUser(id, email, role) → setUser
  useSync fires (userId now defined)

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
