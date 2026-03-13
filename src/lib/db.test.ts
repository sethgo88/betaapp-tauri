import BetterSqlite3 from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestAdapter } from "./db.test-adapter";
import { runMigrations, setDb } from "./db";

describe("runMigrations", () => {
	let sqlite: BetterSqlite3.Database;

	beforeEach(() => {
		sqlite = new BetterSqlite3(":memory:");
	});

	it("applies all 10 migrations from v0 on a fresh database", async () => {
		const adapter = createTestAdapter(sqlite);
		setDb(adapter);
		await runMigrations(adapter);

		const tables = sqlite
			.prepare(
				"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
			)
			.all() as { name: string }[];
		const names = tables.map((t) => t.name);

		// Core tables from v1
		expect(names).toContain("climbs");
		expect(names).toContain("users");
		expect(names).toContain("grades_cache");
		expect(names).toContain("sync_meta");

		// Later migration tables
		expect(names).toContain("burns"); // v6
		expect(names).toContain("route_links"); // v7
		expect(names).toContain("route_images_cache"); // v8
		expect(names).toContain("climb_images"); // v9

		const row = sqlite.prepare("SELECT version FROM schema_version").get() as {
			version: number;
		};
		expect(row.version).toBe(10);
	});

	it("is idempotent — running migrations twice does not error", async () => {
		const adapter = createTestAdapter(sqlite);
		setDb(adapter);
		await runMigrations(adapter);
		await runMigrations(adapter);

		const row = sqlite.prepare("SELECT version FROM schema_version").get() as {
			version: number;
		};
		expect(row.version).toBe(10);
	});

	it("bootstraps from v3 when climbs table exists without schema_version rows", async () => {
		// Simulate a pre-migration-runner install: tables exist up to v3 but
		// schema_version is empty (no rows).
		sqlite.exec(`
      CREATE TABLE schema_version (version INTEGER NOT NULL);
      CREATE TABLE climbs (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
        route_type TEXT NOT NULL DEFAULT 'sport', grade TEXT NOT NULL,
        moves TEXT NOT NULL DEFAULT '[]', sent_status TEXT NOT NULL DEFAULT 'project',
        country TEXT, area TEXT, sub_area TEXT, route_location TEXT, link TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT, route_id TEXT
      );
      CREATE TABLE users (
        id TEXT PRIMARY KEY, email TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')), deleted_at TEXT
      );
      CREATE TABLE grades_cache (id TEXT PRIMARY KEY, discipline TEXT NOT NULL, grade TEXT NOT NULL, sort_order INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE countries_cache (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL, sort_order INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE regions_cache (id TEXT PRIMARY KEY, country_id TEXT NOT NULL, name TEXT NOT NULL, sort_order INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE sub_regions_cache (id TEXT PRIMARY KEY, region_id TEXT NOT NULL, name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), status TEXT NOT NULL DEFAULT 'verified', created_by TEXT);
      CREATE TABLE crags_cache (id TEXT PRIMARY KEY, sub_region_id TEXT NOT NULL, name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), status TEXT NOT NULL DEFAULT 'verified', created_by TEXT);
      CREATE TABLE walls_cache (id TEXT PRIMARY KEY, crag_id TEXT NOT NULL, name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), status TEXT NOT NULL DEFAULT 'verified', created_by TEXT);
      CREATE TABLE routes_cache (id TEXT PRIMARY KEY, wall_id TEXT NOT NULL, name TEXT NOT NULL, grade TEXT NOT NULL, route_type TEXT NOT NULL DEFAULT 'sport', description TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), status TEXT NOT NULL DEFAULT 'verified');
      CREATE TABLE downloaded_regions (region_id TEXT PRIMARY KEY, downloaded_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE sync_meta (id TEXT PRIMARY KEY DEFAULT 'singleton', last_synced_at TEXT);
    `);

		const adapter = createTestAdapter(sqlite);
		setDb(adapter);
		await runMigrations(adapter);

		const row = sqlite.prepare("SELECT version FROM schema_version").get() as {
			version: number;
		};
		expect(row.version).toBe(10);

		// v4 added display_name to users — verify it was applied
		const cols = sqlite.prepare("PRAGMA table_info(users)").all() as {
			name: string;
		}[];
		expect(cols.map((c) => c.name)).toContain("display_name");

		// v10 added lat/lng to crags_cache
		const cragCols = sqlite.prepare("PRAGMA table_info(crags_cache)").all() as {
			name: string;
		}[];
		expect(cragCols.map((c) => c.name)).toContain("lat");
		expect(cragCols.map((c) => c.name)).toContain("lng");
	});
});
