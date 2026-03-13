import type BetterSqlite3 from "better-sqlite3";
import type { DbAdapter } from "./db";

export function createTestAdapter(db: BetterSqlite3.Database): DbAdapter {
	return {
		async execute(sql: string, params: unknown[] = []): Promise<unknown> {
			db.prepare(sql).run(...(params as never[]));
			return undefined;
		},
		async select<T>(sql: string, params: unknown[] = []): Promise<T> {
			return db.prepare(sql).all(...(params as never[])) as T;
		},
	};
}
