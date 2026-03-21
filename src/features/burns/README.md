# src/features/burns

Per-user timestamped notes on a climb representing a single attempt or session. Burns live inline on `ClimbDetailView` — no dedicated route.

---

## Schema (`burns.schema.ts`)

| Schema | Purpose |
|---|---|
| `BurnSchema` | Full DB record: `id, climb_id, user_id, date, outcome, notes, feel, created_at, updated_at, deleted_at` |
| `BurnFormSchema` | Form input: `date, notes, feel` |

Types: `Burn`, `BurnFormValues`

The `outcome` column exists in the DB but defaults to `'attempt'` and is not exposed in the UI.

The `feel` column is an optional integer 0–5 rating of how close the climber felt to sending:
- 0: Impossible
- 1: Very far
- 2: Far
- 3: Getting closer
- 4: Close
- 5: It will go

---

## Service (`burns.service.ts`)

| Function | Description |
|---|---|
| `fetchBurns(climbId)` | All non-deleted burns for a climb, sorted date DESC |
| `insertBurn(climbId, userId, data)` | Insert with `crypto.randomUUID()`, outcome defaults to `'attempt'` |
| `updateBurn(id, data)` | Update date, notes, and feel |
| `softDeleteBurn(id)` | Set `deleted_at` |
| `applyRemoteBurn(burn)` | `INSERT OR REPLACE` preserving server timestamps |

---

## Queries (`burns.queries.ts`)

| Hook | Description |
|---|---|
| `useBurns(climbId)` | Query with key `["burns", climbId]` |
| `useAddBurn()` | Mutation → `insertBurn` + invalidate + silent push |
| `useUpdateBurn()` | Mutation → `updateBurn` + invalidate + silent push |
| `useDeleteBurn()` | Mutation → `softDeleteBurn` + invalidate + silent push |

All mutations trigger a silent `pushBurns(userId)` after success.

---

## Sync

`pushBurns` and `pullBurns` in `sync.service.ts` mirror the climbs pattern. Burns are included in `useSync` launch sync and Realtime subscription.

---

## Data domain

| Domain | Owner | Sync direction |
|---|---|---|
| `burns` | Current user | Bidirectional, full push/pull |
