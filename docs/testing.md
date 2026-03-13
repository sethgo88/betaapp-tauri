# Testing

## Overview

BetaApp uses [Vitest](https://vitest.dev/) with a real in-memory SQLite adapter (`better-sqlite3`) so that service functions and migrations are tested against actual SQL — not mocks.

## Running tests

```bash
pnpm test
```

## Architecture

### `DbAdapter` interface (`src/lib/db.ts`)

The production `getDb()` function returns a `DbAdapter` — an interface with `execute()` and `select()` methods that match the `tauri-plugin-sql` API. This makes services depend on the interface, not the Tauri runtime.

```typescript
export interface DbAdapter {
  execute(sql: string, params?: unknown[]): Promise<unknown>;
  select<T>(sql: string, params?: unknown[]): Promise<T>;
}
```

### Test injection (`setDb`)

Tests call `setDb(adapter)` to inject a `better-sqlite3`-backed adapter before running service functions. `getDb()` returns the injected adapter without touching Tauri.

### `@tauri-apps/plugin-sql` mock

`vitest.config.ts` aliases `@tauri-apps/plugin-sql` to `src/test/mocks/tauri-sql.ts` — a stub that throws if `Database.load()` is accidentally called in tests (it shouldn't be, since `setDb()` is called first).

### Test helper (`src/test/setup-db.ts`)

```typescript
const sqlite = await setupTestDb();
```

Creates a fresh in-memory SQLite database, runs all migrations, and injects it as the active adapter. Call in `beforeEach` for a clean database per test.

## Test files

| File | What it tests |
|---|---|
| `src/lib/db.test.ts` | Migration runner: fresh install (v0→v10), idempotency, bootstrap from v3 |
| `src/features/climbs/climbs.service.test.ts` | CRUD: insert, fetch, update, soft delete |
| `src/features/grades/grades.service.test.ts` | Grade fetch filtered by discipline |
| `src/features/climbs/climbs.schema.test.ts` | Zod safeParse for `ClimbFormSchema` and `ClimbSchema` |

## Adding new tests

1. Create `<feature>.test.ts` alongside the file under test
2. Call `await setupTestDb()` in `beforeEach`
3. Import and call service functions directly — `getDb()` returns the injected adapter
4. If the service imports `@/lib/supabase`, add `vi.mock('@/lib/supabase', () => ({ supabase: {} }))` at the top of the test file before other imports
