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
