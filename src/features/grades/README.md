# features/grades

Grade reference data. Seeded locally on first install, overwritten by Supabase on sync.

---

## Schema

```ts
// grades.schema.ts
GradeSchema = {
  id: string
  discipline: 'sport' | 'boulder'
  grade: string       // '5.10a', 'V5', etc.
  sort_order: number
  created_at: string
}
```

---

## SQLite table

```sql
CREATE TABLE IF NOT EXISTS grades_cache (
    id          TEXT PRIMARY KEY,
    discipline  TEXT NOT NULL,
    grade       TEXT NOT NULL,
    sort_order  INTEGER NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

No `updated_at` — grades are replaced wholesale on sync (DELETE + re-insert).

---

## grades.service.ts

| Function | What it does |
|---|---|
| `fetchGrades(discipline)` | Reads from `grades_cache` ordered by `sort_order` |
| `pullGrades()` | Fetches all rows from Supabase `grades`, clears cache, re-inserts |

`pullGrades()` is a full replace (DELETE + INSERT), not an upsert. Called from `useSync` on every sync run.

---

## grades.queries.ts

```ts
useGrades(discipline: 'sport' | 'boulder')
```

---

## Seed data

`grades-seed.ts` contains a static array of grades for both disciplines. It is used to populate `grades_cache` on first install before Supabase is reachable.

The seed runs during app initialization via `pullGrades()` falling back to seed data when the cache is empty. Supabase data overwrites the seed on first successful sync.

---

## Supabase table

```sql
public.grades (
  id uuid pk default gen_random_uuid(),
  discipline text not null,
  grade text not null,
  sort_order integer not null,
  created_at timestamptz default now()
)
-- RLS: authenticated users SELECT only; service role writes
```
