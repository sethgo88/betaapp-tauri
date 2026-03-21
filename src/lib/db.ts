import Database from "@tauri-apps/plugin-sql";

export interface DbAdapter {
	execute(sql: string, params?: unknown[]): Promise<unknown>;
	select<T>(sql: string, params?: unknown[]): Promise<T>;
}

let _dbReady: Promise<DbAdapter> | null = null;

// Injected by tests via setDb — bypasses the lazy-init path.
let _testDb: DbAdapter | null = null;

export function setDb(adapter: DbAdapter): void {
	_testDb = adapter;
	_dbReady = Promise.resolve(adapter);
}

export function getDb(): Promise<DbAdapter> {
	if (_testDb) return Promise.resolve(_testDb);
	if (!_dbReady) {
		_dbReady = (async () => {
			const db = await Database.load("sqlite:betaapp.db");
			const adapter = db as unknown as DbAdapter;
			await runMigrations(adapter);
			return adapter;
		})();
	}
	return _dbReady;
}

type Migration = (db: DbAdapter) => Promise<void>;

const migrations: Migration[] = [
	// v1: baseline schema
	async (db) => {
		await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT
      )
    `);

		await db.execute(`
      CREATE TABLE IF NOT EXISTS climbs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        route_type TEXT NOT NULL DEFAULT 'sport',
        grade TEXT NOT NULL,
        moves TEXT NOT NULL DEFAULT '[]',
        sent_status TEXT NOT NULL DEFAULT 'project',
        country TEXT,
        area TEXT,
        sub_area TEXT,
        route_location TEXT,
        link TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT
      )
    `);

		await db.execute(`
      CREATE TABLE IF NOT EXISTS grades_cache (
        id TEXT PRIMARY KEY,
        discipline TEXT NOT NULL,
        grade TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

		await db.execute(`
      CREATE TABLE IF NOT EXISTS countries_cache (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

		await db.execute(`
      CREATE TABLE IF NOT EXISTS regions_cache (
        id TEXT PRIMARY KEY,
        country_id TEXT NOT NULL,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

		await db.execute(`
      CREATE TABLE IF NOT EXISTS sub_regions_cache (
        id TEXT PRIMARY KEY,
        region_id TEXT NOT NULL,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

		await db.execute(`
      CREATE TABLE IF NOT EXISTS crags_cache (
        id TEXT PRIMARY KEY,
        sub_region_id TEXT NOT NULL,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

		await db.execute(`
      CREATE TABLE IF NOT EXISTS walls_cache (
        id TEXT PRIMARY KEY,
        crag_id TEXT NOT NULL,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

		await db.execute(`
      CREATE TABLE IF NOT EXISTS routes_cache (
        id TEXT PRIMARY KEY,
        wall_id TEXT NOT NULL,
        name TEXT NOT NULL,
        grade TEXT NOT NULL,
        route_type TEXT NOT NULL DEFAULT 'sport',
        description TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

		await db.execute(`
      CREATE TABLE IF NOT EXISTS downloaded_regions (
        region_id TEXT PRIMARY KEY,
        downloaded_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

		await db.execute(`
      CREATE TABLE IF NOT EXISTS sync_meta (
        id TEXT PRIMARY KEY DEFAULT 'singleton',
        last_synced_at TEXT
      )
    `);
		await db.execute(
			`INSERT OR IGNORE INTO sync_meta (id) VALUES ('singleton')`,
		);

		await db.execute(`
      CREATE TRIGGER IF NOT EXISTS climbs_updated_at
      AFTER UPDATE ON climbs
      BEGIN
        UPDATE climbs SET updated_at = datetime('now') WHERE id = NEW.id;
      END
    `);

		await db.execute(`
      CREATE TRIGGER IF NOT EXISTS users_updated_at
      AFTER UPDATE ON users
      BEGIN
        UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
      END
    `);
	},

	// v2: add route_id to climbs
	async (db) => {
		await db.execute(`ALTER TABLE climbs ADD COLUMN route_id TEXT`);
	},

	// v3: add status to routes_cache; add status + created_by to location caches
	async (db) => {
		await db.execute(
			`ALTER TABLE routes_cache ADD COLUMN status TEXT NOT NULL DEFAULT 'verified'`,
		);
		for (const table of ["sub_regions_cache", "crags_cache", "walls_cache"]) {
			await db.execute(
				`ALTER TABLE ${table} ADD COLUMN status TEXT NOT NULL DEFAULT 'verified'`,
			);
			await db.execute(`ALTER TABLE ${table} ADD COLUMN created_by TEXT`);
		}
	},

	// v4: user profile fields (#5)
	async (db) => {
		await db.execute(`ALTER TABLE users ADD COLUMN display_name TEXT`);
		await db.execute(`ALTER TABLE users ADD COLUMN height_cm INTEGER`);
		await db.execute(`ALTER TABLE users ADD COLUMN ape_index_cm INTEGER`);
		await db.execute(`ALTER TABLE users ADD COLUMN max_redpoint_sport TEXT`);
		await db.execute(`ALTER TABLE users ADD COLUMN max_redpoint_boulder TEXT`);
		await db.execute(
			`ALTER TABLE users ADD COLUMN default_unit TEXT NOT NULL DEFAULT 'metric'`,
		);
	},

	// v5: description on location cache tables (#8)
	async (db) => {
		await db.execute(
			`ALTER TABLE sub_regions_cache ADD COLUMN description TEXT`,
		);
		await db.execute(`ALTER TABLE crags_cache ADD COLUMN description TEXT`);
		await db.execute(`ALTER TABLE walls_cache ADD COLUMN description TEXT`);
	},

	// v6: burns table (#14)
	async (db) => {
		await db.execute(`
      CREATE TABLE IF NOT EXISTS burns (
        id TEXT PRIMARY KEY,
        climb_id TEXT NOT NULL REFERENCES climbs(id),
        user_id TEXT NOT NULL,
        date TEXT NOT NULL,
        outcome TEXT NOT NULL DEFAULT 'attempt',
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT
      )
    `);
		await db.execute(`
      CREATE TRIGGER IF NOT EXISTS burns_updated_at
      AFTER UPDATE ON burns
      BEGIN
        UPDATE burns SET updated_at = datetime('now') WHERE id = NEW.id;
      END
    `);
	},

	// v7: route_links table (#13)
	async (db) => {
		await db.execute(`
      CREATE TABLE IF NOT EXISTS route_links (
        id TEXT PRIMARY KEY,
        route_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT,
        link_type TEXT NOT NULL DEFAULT 'video',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT
      )
    `);
	},

	// v8: route_images_cache + wall_images_cache (#11)
	async (db) => {
		await db.execute(`
      CREATE TABLE IF NOT EXISTS route_images_cache (
        id TEXT PRIMARY KEY,
        route_id TEXT NOT NULL,
        url TEXT NOT NULL,
        caption TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
		await db.execute(`
      CREATE TABLE IF NOT EXISTS wall_images_cache (
        id TEXT PRIMARY KEY,
        wall_id TEXT NOT NULL,
        url TEXT NOT NULL,
        caption TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
	},

	// v9: climb_images table (#12)
	async (db) => {
		await db.execute(`
      CREATE TABLE IF NOT EXISTS climb_images (
        id TEXT PRIMARY KEY,
        climb_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        url TEXT NOT NULL,
        caption TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT
      )
    `);
	},

	// v10: lat/lng on crags_cache (#15)
	async (db) => {
		await db.execute(`ALTER TABLE crags_cache ADD COLUMN lat REAL`);
		await db.execute(`ALTER TABLE crags_cache ADD COLUMN lng REAL`);
	},

	// v11: lat/lng on walls_cache (#15)
	async (db) => {
		await db.execute(`ALTER TABLE walls_cache ADD COLUMN lat REAL`);
		await db.execute(`ALTER TABLE walls_cache ADD COLUMN lng REAL`);
	},

	// v12: wall_type + climbing type counts on walls_cache and crags_cache (#25)
	async (db) => {
		await db.execute(
			`ALTER TABLE walls_cache ADD COLUMN wall_type TEXT NOT NULL DEFAULT 'wall'`,
		);
		await db.execute(
			`ALTER TABLE walls_cache ADD COLUMN sport_count INTEGER NOT NULL DEFAULT 0`,
		);
		await db.execute(
			`ALTER TABLE walls_cache ADD COLUMN trad_count INTEGER NOT NULL DEFAULT 0`,
		);
		await db.execute(
			`ALTER TABLE walls_cache ADD COLUMN boulder_count INTEGER NOT NULL DEFAULT 0`,
		);
		await db.execute(
			`ALTER TABLE crags_cache ADD COLUMN sport_count INTEGER NOT NULL DEFAULT 0`,
		);
		await db.execute(
			`ALTER TABLE crags_cache ADD COLUMN trad_count INTEGER NOT NULL DEFAULT 0`,
		);
		await db.execute(
			`ALTER TABLE crags_cache ADD COLUMN boulder_count INTEGER NOT NULL DEFAULT 0`,
		);
	},

	// v13: restructure route_images_cache + wall_images_cache (#11)
	// Drop the v8 stubs (url/caption) and recreate with image_url + uploaded_by.
	// Safe to drop — these are admin-managed cache tables with no user data.
	async (db) => {
		await db.execute(`DROP TABLE IF EXISTS route_images_cache`);
		await db.execute(`
      CREATE TABLE route_images_cache (
        id          TEXT PRIMARY KEY,
        route_id    TEXT NOT NULL,
        image_url   TEXT NOT NULL,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        uploaded_by TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
		await db.execute(`DROP TABLE IF EXISTS wall_images_cache`);
		await db.execute(`
      CREATE TABLE wall_images_cache (
        id          TEXT PRIMARY KEY,
        wall_id     TEXT NOT NULL,
        image_url   TEXT NOT NULL,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        uploaded_by TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
	},

	// v14: rebuild climb_images (v9 used 'url'; rename to 'image_url' for consistency)
	// and add climb_image_pins (#32). Safe to drop — feature was never shipped.
	async (db) => {
		await db.execute(`DROP TABLE IF EXISTS climb_images`);
		await db.execute(`
      CREATE TABLE climb_images (
        id          TEXT PRIMARY KEY,
        climb_id    TEXT NOT NULL,
        user_id     TEXT NOT NULL,
        image_url   TEXT NOT NULL,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at  TEXT
      )
    `);
		await db.execute(`
      CREATE TABLE IF NOT EXISTS climb_image_pins (
        id             TEXT PRIMARY KEY,
        climb_image_id TEXT NOT NULL,
        pin_type       TEXT NOT NULL,
        x_pct          REAL NOT NULL,
        y_pct          REAL NOT NULL,
        description    TEXT,
        sort_order     INTEGER NOT NULL DEFAULT 0,
        created_at     TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
	},

	// v15: server_updated_at on downloaded_regions (#31)
	async (db) => {
		const cols = await db.select<{ name: string }[]>(
			`PRAGMA table_info(downloaded_regions)`,
		);
		if (!cols.some((c) => c.name === "server_updated_at")) {
			await db.execute(
				`ALTER TABLE downloaded_regions ADD COLUMN server_updated_at TEXT`,
			);
		}
	},

	// v16: add pointer_dir to climb_image_pins (#38)
	async (db) => {
		const cols = await db.select<{ name: string }[]>(
			`PRAGMA table_info(climb_image_pins)`,
		);
		if (!cols.some((c) => c.name === "pointer_dir")) {
			await db.execute(
				`ALTER TABLE climb_image_pins ADD COLUMN pointer_dir TEXT NOT NULL DEFAULT 'bottom'`,
			);
		}
	},

	// v17: backfill server_updated_at on downloaded_regions for devices that skipped v15
	async (db) => {
		const cols = await db.select<{ name: string }[]>(
			`PRAGMA table_info(downloaded_regions)`,
		);
		const hasColumn = cols.some((c) => c.name === "server_updated_at");
		if (!hasColumn) {
			await db.execute(
				`ALTER TABLE downloaded_regions ADD COLUMN server_updated_at TEXT`,
			);
		}
	},

	// v18: add crag and wall to climbs (#44)
	async (db) => {
		const cols = await db.select<{ name: string }[]>(
			`PRAGMA table_info(climbs)`,
		);
		const names = cols.map((c) => c.name);
		if (!names.includes("crag")) {
			await db.execute(`ALTER TABLE climbs ADD COLUMN crag TEXT`);
		}
		if (!names.includes("wall")) {
			await db.execute(`ALTER TABLE climbs ADD COLUMN wall TEXT`);
		}
	},

	// v19: topo tables for wall and route topos
	async (db) => {
		await db.execute(`
      CREATE TABLE IF NOT EXISTS wall_topos_cache (
        id         TEXT PRIMARY KEY,
        wall_id    TEXT NOT NULL,
        image_url  TEXT NOT NULL,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
		await db.execute(`
      CREATE TABLE IF NOT EXISTS wall_topo_lines_cache (
        id         TEXT PRIMARY KEY,
        topo_id    TEXT NOT NULL,
        route_id   TEXT NOT NULL,
        points     TEXT NOT NULL,
        color      TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
		await db.execute(`
      CREATE TABLE IF NOT EXISTS route_topos_cache (
        id         TEXT PRIMARY KEY,
        route_id   TEXT NOT NULL,
        image_url  TEXT NOT NULL,
        points     TEXT NOT NULL,
        color      TEXT NOT NULL DEFAULT '#EF4444',
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
	},

	// v20: approach text on crags_cache and walls_cache (#92)
	async (db) => {
		await db.execute(`ALTER TABLE crags_cache ADD COLUMN approach TEXT`);
		await db.execute(`ALTER TABLE walls_cache ADD COLUMN approach TEXT`);
	},
];

export async function runMigrations(db: DbAdapter): Promise<void> {
	await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL
    )
  `);

	const rows = await db.select<{ version: number }[]>(
		`SELECT version FROM schema_version LIMIT 1`,
	);

	let currentVersion: number;

	if (rows.length === 0) {
		// Bootstrap: if climbs table exists, this is an existing install already at v3
		const tableCheck = await db.select<{ name: string }[]>(
			`SELECT name FROM sqlite_master WHERE type='table' AND name='climbs'`,
		);
		currentVersion = tableCheck.length > 0 ? 3 : 0;
		await db.execute(`INSERT INTO schema_version (version) VALUES (?)`, [
			currentVersion,
		]);
	} else {
		currentVersion = rows[0].version;
	}

	for (let i = currentVersion; i < migrations.length; i++) {
		await migrations[i](db);
		await db.execute(`UPDATE schema_version SET version = ?`, [i + 1]);
	}
}
