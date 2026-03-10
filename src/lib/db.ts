import Database from "@tauri-apps/plugin-sql";

let _db: Database | null = null;

export async function getDb(): Promise<Database> {
	if (!_db) {
		_db = await Database.load("sqlite:betaapp.db");
		await initSchema(_db);
	}
	return _db;
}

async function initSchema(db: Database): Promise<void> {
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
      route_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    )
  `);

	// Migrate existing climbs table to add route_id if not present
	try {
		await db.execute(`ALTER TABLE climbs ADD COLUMN route_id TEXT`);
	} catch {
		// Column already exists — safe to ignore
	}

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
      verified INTEGER NOT NULL DEFAULT 0,
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
}
