# Code Patterns

Concrete, copy-paste-ready patterns used throughout the codebase. When in doubt, follow these.

---

## Atomic Design — Component Levels

```
atoms      Smallest indivisible UI unit. No sub-components from this project.
           Examples: Button, Badge, Input, Select, TextArea, Spinner

molecules  Two or more atoms forming a simple cohesive unit.
           Examples: FormField, ClimbCard, SyncStatus, GradeSelector, LocationPicker

organisms  Complex, self-contained sections. May use Query hooks or Zustand.
           Examples: ClimbList, ClimbForm, NavBar, FilterPanel, RouteCard

templates  Layout shells with no real data — just children/slots.
           Examples: AppLayout, ModalLayout

views      Templates + real data. One per route.
           Examples: HomeView, AddClimbView, ClimbDetailView, SettingsView
```

**Rule:** `features/` has no JSX. `components/` and `views/` have no raw DB or API calls.

---

## File Structure — One Component Per Folder

Every component lives in its own folder. The implementation file is named in **lowercase-hyphen** format (not `index.tsx`):

```
src/components/atoms/Button/
  button.tsx

src/components/molecules/ClimbCard/
  climb-card.tsx

src/components/organisms/ClimbForm/
  climb-form.tsx
```

Import consumers use the full path including filename:
```ts
import { Button } from '../components/atoms/Button/button'
import { ClimbCard } from '../components/molecules/ClimbCard/climb-card'
```

No path aliases (`@/`) — use relative paths.

---

## Feature Module Structure

```
src/features/climbs/
  climbs.types.ts     ← TypeScript interfaces / enums
  climbs.schema.ts    ← Zod schemas (infer types from these)
  climbs.service.ts   ← async CRUD functions, no React
  climbs.queries.ts   ← TanStack Query hooks
  climbs.store.ts     ← Zustand store for UI state
```

---

## TanStack Query — Query Hook

```ts
// src/features/climbs/climbs.queries.ts
import { useQuery } from '@tanstack/react-query'
import { climbsService } from './climbs.service'

export const climbKeys = {
  all: ['climbs'] as const,
  byStatus: (status: SentStatus) => ['climbs', { status }] as const,
  detail: (id: string) => ['climbs', id] as const,
}

export function useClimbs() {
  return useQuery({
    queryKey: climbKeys.all,
    queryFn: () => climbsService.getAllClimbs(),
  })
}

export function useClimb(id: string) {
  return useQuery({
    queryKey: climbKeys.detail(id),
    queryFn: () => climbsService.getClimbById(id),
  })
}
```

---

## TanStack Query — Mutation Hook

```ts
export function useCreateClimb() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateClimb) => climbsService.createClimb(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: climbKeys.all })
    },
  })
}

export function useDeleteClimb() {
  const queryClient = useQueryClient()
  const { isOnline } = useOnlineStatus()

  return useMutation({
    mutationFn: (id: string) => climbsService.deleteClimb(id, isOnline),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: climbKeys.all })
    },
  })
}
```

---

## Service Function Pattern

```ts
// src/features/climbs/climbs.service.ts
import { db } from '../../lib/db'
import type { Climb, CreateClimb } from './climbs.types'

export const climbsService = {
  async getAllClimbs(): Promise<Climb[]> {
    return db.select<Climb[]>(
      'SELECT * FROM climbs WHERE deleted_at IS NULL ORDER BY created_at DESC'
    )
  },

  async getClimbById(id: string): Promise<Climb | null> {
    const rows = await db.select<Climb[]>(
      'SELECT * FROM climbs WHERE id = $1 AND deleted_at IS NULL',
      [id]
    )
    return rows[0] ?? null
  },

  async createClimb(data: CreateClimb): Promise<Climb> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    await db.execute(
      `INSERT INTO climbs (
        id, user_id, route_id, is_custom_location, route_type, grade,
        moves, sent_status, notes, custom_name, custom_country,
        custom_region, custom_crag, custom_wall, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        id, data.user_id, data.route_id ?? null, data.is_custom_location ? 1 : 0,
        data.route_type, data.grade, data.moves ?? null, data.sent_status,
        data.notes ?? null, data.custom_name ?? null, data.custom_country ?? null,
        data.custom_region ?? null, data.custom_crag ?? null, data.custom_wall ?? null,
        now, now,
      ]
    )
    const [row] = await db.select<Climb[]>('SELECT * FROM climbs WHERE id = $1', [id])
    return row
  },

  async deleteClimb(id: string, isOnline: boolean): Promise<void> {
    if (isOnline) {
      await db.execute('DELETE FROM climbs WHERE id = $1', [id])
    } else {
      const now = new Date().toISOString()
      await db.execute('UPDATE climbs SET deleted_at = $1 WHERE id = $2', [now, id])
    }
  },
}
```

**Rules:**
- Always filter `WHERE deleted_at IS NULL` on every read query
- Use `$1, $2, ...` positional params — never string interpolation (SQL injection risk)
- `crypto.randomUUID()` for IDs
- `updated_at` is set by DB trigger on UPDATE — only set it explicitly on INSERT
- Never import `db.ts` in views or components — only in `*.service.ts` files

---

## Zustand Store Pattern

```ts
// src/features/climbs/climbs.store.ts
import { create } from 'zustand'

interface ClimbsStore {
  activeRouteType: 'sport' | 'boulder' | null
  activeSentStatus: SentStatus | null
  setActiveRouteType: (type: ClimbsStore['activeRouteType']) => void
  setActiveSentStatus: (status: ClimbsStore['activeSentStatus']) => void
}

export const useClimbsStore = create<ClimbsStore>((set) => ({
  activeRouteType: null,
  activeSentStatus: null,
  setActiveRouteType: (activeRouteType) => set({ activeRouteType }),
  setActiveSentStatus: (activeSentStatus) => set({ activeSentStatus }),
}))
```

**What goes in Zustand vs TanStack Query:**

| Zustand | TanStack Query |
|---|---|
| Active filter selections | Climb list from SQLite |
| Sync status (isSyncing, lastSyncedAt) | Grades from cache |
| Auth state (user, session, role) | Location hierarchy from cache |
| Pending download progress | Route search results |
| UI toggles | Any async data with loading/error state |

---

## Zod Schema Pattern

```ts
// src/features/climbs/climbs.schema.ts
import { z } from 'zod'

export const RouteTypeSchema = z.enum(['sport', 'boulder'])
export const SentStatusSchema = z.enum(['send', 'project', 'redpoint', 'flash', 'onsight'])

export const ClimbSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  route_id: z.string().uuid().nullable(),
  is_custom_location: z.number().int().min(0).max(1),
  route_type: RouteTypeSchema,
  grade: z.string().min(1),
  moves: z.string().nullable(),
  sent_status: SentStatusSchema,
  notes: z.string().nullable(),
  custom_name: z.string().nullable(),
  custom_country: z.string().nullable(),
  custom_region: z.string().nullable(),
  custom_crag: z.string().nullable(),
  custom_wall: z.string().nullable(),
  deleted_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type Climb = z.infer<typeof ClimbSchema>

export const CreateClimbSchema = ClimbSchema.omit({
  id: true, deleted_at: true, created_at: true, updated_at: true,
})
export type CreateClimb = z.infer<typeof CreateClimbSchema>
```

**Note:** Column names stay `snake_case` to match SQLite — no camelCase mapping.

---

## Soft Delete Pattern

```ts
// Every read query must filter:
'SELECT * FROM climbs WHERE deleted_at IS NULL'

// Soft delete (offline):
await db.execute('UPDATE climbs SET deleted_at = $1 WHERE id = $2', [now, id])

// Hard delete (online — propagates to Supabase on next push):
await db.execute('DELETE FROM climbs WHERE id = $1', [id])
```

Never omit `WHERE deleted_at IS NULL`. Soft-deleted rows must be invisible to all UI.

---

## TanStack Form Pattern

```ts
const form = useForm({
  defaultValues: {
    grade: '',
    route_type: 'sport' as const,
    sent_status: 'project' as const,
    moves: '',
    notes: '',
  },
  onSubmit: async ({ value }) => {
    const payload = CreateClimbSchema.parse(value)
    await createClimb.mutateAsync(payload)
    navigate({ to: '/' })
  },
})

// Field with Zod validation (no zod-form-adapter — use safeParse directly):
<form.Field
  name="grade"
  validators={{
    onBlur: ({ value }) => {
      const result = z.string().min(1, 'Grade is required').safeParse(value)
      return result.success ? undefined : result.error.issues[0]?.message
    },
  }}
>
  {(field) => (
    <GradeSelector
      value={field.state.value}
      onChange={field.handleChange}
      onBlur={field.handleBlur}
      error={field.state.meta.errors[0]?.toString()}
    />
  )}
</form.Field>
```

**Rules:**
- All form submission through `form.handleSubmit()` — never call service directly from `onClick`
- `onBlur` validators only — avoid premature error messages
- `CreateClimbSchema.parse()` inside `onSubmit` as final safety check
- Use `form.Subscribe` to read `isSubmitting` for button disabled states

---

## Tailwind — Dark-Only App

This app is dark mode only. Do not add `dark:` variants — write dark styles as the base:

```tsx
// Correct
<div className="bg-gray-950 text-white">

// Wrong
<div className="bg-white dark:bg-gray-950 text-black dark:text-white">
```

---

## Safe Areas (Android)

The app runs edge-to-edge. Every view must respect device safe areas.

```tsx
// Top elements (headers, fixed overlays)
style={{ paddingTop: 'env(safe-area-inset-top)' }}

// Bottom elements (nav bar, bottom sheets, fixed buttons)
style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 15px)' }}

// Scrollable content containers
<div
  className="flex-1 overflow-y-auto"
  style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 15px)' }}
>
```

Touch targets minimum `min-h-[48px] min-w-[48px]` (48dp Android guideline).

---

## cn() — Conditional Classes

```ts
// src/lib/cn.ts
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs))
}
```

```tsx
<button className={cn(
  'px-4 py-2 rounded-lg font-medium min-h-[48px]',
  isActive && 'bg-blue-600 text-white',
  isDisabled && 'opacity-50 cursor-not-allowed',
  className,
)}>
```

---

## Admin-Gated Views

Wrap admin routes with a guard component that checks `auth.store`:

```tsx
// src/components/atoms/AdminGuard/admin-guard.tsx
import { useAuthStore } from '../../../features/auth/auth.store'

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const role = useAuthStore((s) => s.role)
  if (role !== 'admin') return null
  return <>{children}</>
}
```

Use in route definitions or at the view level — not buried inside organisms.

---

## Grades Seed

On first install, `grades_cache` is empty. Seed it before displaying any grade-dependent UI:

```ts
// src/features/grades/grades.service.ts
import { GRADES_SEED } from './grades-seed'

async seedIfEmpty(): Promise<void> {
  const existing = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM grades_cache'
  )
  if (existing[0].count > 0) return

  for (const grade of GRADES_SEED) {
    await db.execute(
      'INSERT OR IGNORE INTO grades_cache (id, route_type, value, sort_order, updated_at) VALUES ($1,$2,$3,$4,$5)',
      [grade.id, grade.route_type, grade.value, grade.sort_order, new Date().toISOString()]
    )
  }
}
```

Call `gradesService.seedIfEmpty()` during app initialization (before the router renders).

---

## Supabase Realtime Subscription

```ts
// src/features/sync/sync.service.ts
import { supabase } from '../../lib/supabase'

export function subscribeToClimbs(userId: string, onUpdate: () => void) {
  return supabase
    .channel('climbs-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'climbs',
        filter: `user_id=eq.${userId}`,
      },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          await climbsService.softDeleteLocal(payload.old.id)
        } else {
          await climbsService.upsertFromRemote(payload.new)
        }
        onUpdate()
      }
    )
    .subscribe()
}
```

Call `subscribeToClimbs` after successful auth. Store the channel reference and call `.unsubscribe()` on logout.
