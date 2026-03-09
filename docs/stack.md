# Stack Guide

Each technology in the project — why it was chosen and what you need to know to use it correctly.

---

## Tauri 2

**What:** Native app shell that wraps a web UI (React) and provides a Rust backend for system APIs.
**Why:** Delivers a true native Android APK with access to SQLite and system storage — without the overhead of React Native or Electron. Tauri 2 has first-class Android support.

**Key concepts:**
- The frontend is a standard web app (Vite + React) running in the system WebView
- The Rust backend exposes typed **commands** that the frontend calls via `invoke()`
- **Capabilities** (`src-tauri/capabilities/`) declare what APIs the app can use. Missing capability = silent failure.
- Plugins extend Tauri: `tauri-plugin-sql` for SQLite, `tauri-plugin-deep-link` for magic link callbacks

**In this project:**
- `src-tauri/src/lib.rs` — plugin registration and migration definitions only
- No custom Rust data commands — all SQLite access is JS-side via `tauri-plugin-sql`

---

## React 19 + TypeScript

**What:** UI library + type system.
**Why:** React is the standard Tauri frontend. TypeScript strict mode catches entire classes of bugs at compile time.

**Rules:**
- `"strict": true` in `tsconfig.json` — always on, no exceptions
- No `any` — use `unknown` and narrow, or write the proper type
- No `useEffect` for data fetching — use TanStack Query
- Functional components only

---

## Tailwind CSS

**What:** Utility-first CSS framework.
**Why:** No context switching between CSS files. Co-located styles.

**Setup:** Uses the Vite plugin (`@tailwindcss/vite`) and `@import "tailwindcss"` in the main CSS file.

**Rules:**
- Dark mode only — write dark styles as the base, no `dark:` variants
- No inline styles, no CSS modules
- Use `cn()` from `src/lib/cn.ts` for conditional class composition
- Touch targets: `min-h-[48px] min-w-[48px]` minimum (48dp Android guideline)

---

## Biome

**What:** Unified linter and formatter (replaces ESLint + Prettier).
**Why:** Single tool, no config conflicts between lint and format.

```bash
pnpm lint      # biome check . — lint only
pnpm format    # biome format --write . — auto-fix formatting
```

- `pnpm lint` must pass with zero warnings before any commit
- Config in `biome.json` at project root

---

## TanStack Router

**What:** Type-safe router for React.
**Why:** Route params are part of the TypeScript type system — no `string | undefined` from `useParams()`.

**Critical:** Use `createMemoryHistory({ initialEntries: ["/"] })` — browser history causes blank screens in Tauri's Android WebView.

**Route definition pattern:**
```ts
import { createRouter, createMemoryHistory, createRootRoute, createRoute } from '@tanstack/react-router'

const rootRoute = createRootRoute({ component: AppLayout })
const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomeView })
const climbDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/climb/$id',
  component: ClimbDetailView,
})

const routeTree = rootRoute.addChildren([homeRoute, climbDetailRoute, ...])
const memoryHistory = createMemoryHistory({ initialEntries: ['/'] })
export const router = createRouter({ routeTree, history: memoryHistory })
```

---

## TanStack Query

**What:** Async state manager — caching, loading/error states, background refetch.
**Why:** Eliminates manual `useEffect` data fetching, loading booleans, and cache invalidation bugs.

**This is the most important architectural rule:** every async operation goes through TanStack Query.

```ts
// Query
export function useClimbs() {
  return useQuery({
    queryKey: ['climbs'],
    queryFn: () => climbsService.getAllClimbs(),
  })
}

// Mutation
export function useCreateClimb() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateClimb) => climbsService.createClimb(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['climbs'] }),
  })
}
```

**Rules:**
- `queryKey` must include all variables the query depends on
- Invalidate the relevant key in `onSuccess` after mutations
- Never call service functions directly in components — always go through a hook
- Query hooks live in `*.queries.ts` files only

---

## TanStack Form

**What:** Headless, type-safe form state manager.
**Why:** Field-level validation, async submission state, dirty tracking — without coupling to a specific validation library.

**Critical:** Do NOT install `@tanstack/zod-form-adapter` — it requires zod@^3. Use Zod's `.safeParse()` directly:

```ts
validators={{
  onBlur: ({ value }) => {
    const result = z.string().min(1, 'Required').safeParse(value)
    return result.success ? undefined : result.error.issues[0]?.message
  },
}}
```

See `docs/patterns.md` for the full form pattern.

---

## Zustand

**What:** Lightweight React state management.
**Why:** Minimal boilerplate for UI state that doesn't belong in the server cache.

**What goes in Zustand:** active filters, sync status, auth state (user/session/role), UI toggles, download progress.
**What goes in TanStack Query:** anything async with loading/error state (climbs, grades, locations, routes).

---

## Zod v4

**What:** Runtime schema validation and TypeScript type inference.
**Why:** TypeScript types are erased at runtime. Zod validates that data from Supabase and forms actually matches what the types say.

**Rules:**
- Validate at system boundaries: Supabase API responses, form submissions
- Do not validate internal state from Zustand stores
- Keep schemas in `*.schema.ts`, infer types with `z.infer<typeof Schema>`

---

## tauri-plugin-sql (SQLite)

**What:** Tauri plugin that gives the frontend JavaScript access to SQLite.
**Why:** True embedded SQLite — no network, works offline. Data survives app restarts.

**Key concepts:**
- JS API is async (`await db.select(...)`, `await db.execute(...)`)
- All access goes through `src/lib/db.ts` — never import the plugin directly in feature code
- Migrations defined in Rust (`src-tauri/src/lib.rs`), run automatically on launch

---

## Supabase

**What:** Hosted Postgres with Auth, Realtime, and REST API.
**Why:** No self-hosting required. Provides everything needed: auth (magic link), real-time sync, row-level security, and a web dashboard as an admin CMS.

**In this project:**
- **Auth:** Magic link email sign-in. Session token stored in Tauri secure store.
- **Sync:** User climbs pushed immediately on mutation; pulled on startup and via Realtime.
- **Reference data:** Grades, location hierarchy, and routes managed by admin. Read-only for users.
- **RLS:** Enforces data isolation between users on the backend.
- **Realtime:** WebSocket channel on `climbs` table — pushes changes to the local SQLite cache in real-time while the app is open.

**Client:** `src/lib/supabase.ts` — configured singleton using `@supabase/supabase-js`.

**Credentials:** Supabase URL and anon key stored in Tauri secure store — never hardcoded, never in `.env` for production builds.

---

## tauri-plugin-deep-link

**What:** Handles custom URL scheme callbacks on Android (e.g. `betaapp://auth/callback`).
**Why:** Required for Supabase magic link auth — the email link redirects back to the app via the custom scheme.

**Setup required:**
1. Register intent filter in Android manifest for `betaapp://` scheme
2. Call `onOpenUrl` in the plugin to register a listener in `auth.service.ts`
3. Parse the token from the URL and pass to `supabase.auth.exchangeCodeForSession()`

See `docs/android.md` for the full deep link setup.

---

## pnpm

**What:** Package manager.
**Why:** Fast, efficient disk usage, strict dependency resolution.

Always use `pnpm` — never `npm` or `yarn`.
