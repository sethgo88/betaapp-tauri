# src/features

Each feature is a self-contained module. No JSX lives here — only data access, state, and validation.

**Rule:** `features/` has no JSX. `components/` and `views/` have no raw DB or Supabase calls.

---

## Module structure

Every feature follows the same file layout:

```
src/features/<domain>/
  <domain>.schema.ts    ← Zod schemas; infer TypeScript types from these
  <domain>.service.ts   ← async functions (SQLite reads/writes, Supabase calls)
  <domain>.queries.ts   ← TanStack Query hooks (useQuery / useMutation)
  <domain>.store.ts     ← Zustand store for UI state only
```

Not every feature needs all four files — add only what exists.

---

## Feature index

| Feature | What it owns |
|---|---|
| [`auth/`](auth/README.md) | Session, user profile, role detection |
| [`climbs/`](climbs/README.md) | Personal climb log (CRUD + sync) |
| [`grades/`](grades/README.md) | Grade reference data, seed, Supabase pull |
| [`locations/`](locations/README.md) | 5-level location hierarchy, region download |
| [`routes/`](routes/README.md) | Community routes, submission, admin verification |
| [`sync/`](sync/README.md) | Push/pull orchestration, Realtime subscription |

---

## Cross-cutting store

`src/stores/ui.store.ts` holds UI state that doesn't belong to any single feature:

```ts
import { useUiStore } from '@/stores/ui.store'

const { addToast } = useUiStore.getState()
addToast({ message: 'Saved', type: 'success' })
```

**Toast types:** `'success' | 'error' | 'warning'`

---

## Patterns

### Service function

```ts
// <domain>.service.ts
import { getDb } from '@/lib/db'

export async function fetchThings(): Promise<Thing[]> {
  const db = await getDb()
  return db.select<Thing[]>(
    'SELECT * FROM things WHERE deleted_at IS NULL ORDER BY created_at DESC'
  )
}

export async function insertThing(data: ThingFormValues): Promise<void> {
  const db = await getDb()
  const id = crypto.randomUUID()
  await db.execute(
    'INSERT INTO things (id, name, created_at) VALUES (?, ?, datetime(\'now\'))',
    [id, data.name]
  )
}
```

### TanStack Query hook

```ts
// <domain>.queries.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const KEY = 'things'

export function useThings() {
  return useQuery({
    queryKey: [KEY],
    queryFn: fetchThings,
  })
}

export function useAddThing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ThingFormValues) => insertThing(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
```

### Zustand store

```ts
// <domain>.store.ts
import { create } from 'zustand'

interface ThingStore {
  selectedId: string | null
  setSelectedId: (id: string | null) => void
}

export const useThingStore = create<ThingStore>((set) => ({
  selectedId: null,
  setSelectedId: (id) => set({ selectedId: id }),
}))
```

### Zod schema

```ts
// <domain>.schema.ts
import { z } from 'zod'

export const ThingSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Name is required'),
  created_at: z.string(),
  deleted_at: z.string().nullable().optional(),
})

export type Thing = z.infer<typeof ThingSchema>

export const ThingFormSchema = ThingSchema.pick({ name: true })
export type ThingFormValues = z.infer<typeof ThingFormSchema>
```

**Rules:**
- Column names stay `snake_case` to match SQLite — no camelCase mapping
- Validate at system boundaries (Supabase responses, form submissions) — not internal Zustand state
- Use `.safeParse()` in TanStack Form validators — never `zod-form-adapter`
