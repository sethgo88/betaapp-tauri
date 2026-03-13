import BetterSqlite3 from "better-sqlite3";
import { runMigrations, setDb } from "@/lib/db";
import { createTestAdapter } from "@/lib/db.test-adapter";

/**
 * Creates a fresh in-memory SQLite database, runs all migrations,
 * and injects it as the active DbAdapter for the current test.
 * Call in beforeEach to get a clean DB per test.
 */
export async function setupTestDb(): Promise<BetterSqlite3.Database> {
	const sqlite = new BetterSqlite3(":memory:");
	const adapter = createTestAdapter(sqlite);
	setDb(adapter);
	await runMigrations(adapter);
	return sqlite;
}
