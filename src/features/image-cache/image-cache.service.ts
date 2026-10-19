import { getDb } from "@/lib/db";
import { getImageFileStore } from "@/lib/image-cache";
import { base64ToBlob } from "@/lib/image-utils";
import { type CacheScope, climbImageKey } from "./image-cache.keys";

type CachedImageRow = {
	key: string;
	local_path: string;
	bytes: number;
	created_at: string;
};

const EXT_BY_MIME: Record<string, string> = {
	"image/webp": "webp",
	"image/png": "png",
};
const MIME_BY_EXT: Record<string, string> = {
	webp: "image/webp",
	png: "image/png",
	jpg: "image/jpeg",
};

async function fileNameFor(key: string, mime: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(key),
	);
	const hash = Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	return `${hash}.${EXT_BY_MIME[mime] ?? "jpg"}`;
}

async function getRow(key: string): Promise<CachedImageRow | null> {
	const db = await getDb();
	const rows = await db.select<CachedImageRow[]>(
		"SELECT * FROM cached_images WHERE key = ?",
		[key],
	);
	return rows[0] ?? null;
}

/** Which of the given keys already have a cached file. */
export async function getCachedKeys(keys: string[]): Promise<Set<string>> {
	if (keys.length === 0) return new Set();
	const db = await getDb();
	const rows = await db.select<{ key: string }[]>(
		`SELECT key FROM cached_images WHERE key IN (${keys.map(() => "?").join(",")})`,
		keys,
	);
	return new Set(rows.map((r) => r.key));
}

export async function addRef(key: string, scope: CacheScope): Promise<void> {
	const db = await getDb();
	await db.execute(
		`INSERT OR IGNORE INTO cached_image_refs (key, scope_type, scope_id)
     VALUES (?, ?, ?)`,
		[key, scope.type, scope.id],
	);
}

/**
 * Write an image to the file cache and link it to a scope. If the key is
 * already cached the existing file is kept and only the ref is added.
 */
export async function cacheImage(
	key: string,
	blob: Blob,
	scope: CacheScope,
): Promise<void> {
	const existing = await getRow(key);
	if (!existing) {
		const name = await fileNameFor(key, blob.type);
		const bytes = new Uint8Array(await blob.arrayBuffer());
		await getImageFileStore().write(name, bytes);
		const db = await getDb();
		await db.execute(
			`INSERT OR REPLACE INTO cached_images (key, local_path, bytes)
       VALUES (?, ?, ?)`,
			[key, name, bytes.byteLength],
		);
	}
	await addRef(key, scope);
}

async function deleteIfUnreferenced(key: string): Promise<void> {
	const db = await getDb();
	const refs = await db.select<{ count: number }[]>(
		"SELECT COUNT(*) as count FROM cached_image_refs WHERE key = ?",
		[key],
	);
	if ((refs[0]?.count ?? 0) > 0) return;
	const row = await getRow(key);
	if (!row) return;
	await getImageFileStore().remove(row.local_path);
	await db.execute("DELETE FROM cached_images WHERE key = ?", [key]);
}

/** Unlink a key from a scope; the file is deleted when no scope references it. */
export async function releaseRef(
	key: string,
	scope: CacheScope,
): Promise<void> {
	const db = await getDb();
	await db.execute(
		"DELETE FROM cached_image_refs WHERE key = ? AND scope_type = ? AND scope_id = ?",
		[key, scope.type, scope.id],
	);
	await deleteIfUnreferenced(key);
}

/** Unlink every key from a scope (e.g. delete a downloaded area). */
export async function releaseScope(scope: CacheScope): Promise<void> {
	const db = await getDb();
	const rows = await db.select<{ key: string }[]>(
		"SELECT key FROM cached_image_refs WHERE scope_type = ? AND scope_id = ?",
		[scope.type, scope.id],
	);
	await db.execute(
		"DELETE FROM cached_image_refs WHERE scope_type = ? AND scope_id = ?",
		[scope.type, scope.id],
	);
	for (const { key } of rows) await deleteIfUnreferenced(key);
}

/** Read a cached image back as a Blob, or null if it isn't cached. */
export async function readCachedBlob(key: string): Promise<Blob | null> {
	const row = await getRow(key);
	if (!row) return null;
	try {
		const bytes = await getImageFileStore().read(row.local_path);
		const ext = row.local_path.split(".").pop() ?? "jpg";
		return new Blob([bytes as BlobPart], {
			type: MIME_BY_EXT[ext] ?? "image/jpeg",
		});
	} catch {
		// File missing (e.g. storage cleared) — drop the stale row so callers fall back to the network
		const db = await getDb();
		await db.execute("DELETE FROM cached_images WHERE key = ?", [key]);
		await db.execute("DELETE FROM cached_image_refs WHERE key = ?", [key]);
		return null;
	}
}

export type CacheStats = { count: number; bytes: number };

/**
 * Total cached files and bytes. Pass `{ type, id }` for one scope, or just
 * `{ type }` for every scope of that type (e.g. all personal climb photos).
 */
export async function getCacheStats(scope?: {
	type: string;
	id?: string;
}): Promise<CacheStats> {
	const db = await getDb();
	let sql = "SELECT COUNT(*) as count, SUM(bytes) as bytes FROM cached_images";
	const params: unknown[] = [];
	if (scope) {
		sql += ` WHERE key IN (SELECT key FROM cached_image_refs WHERE scope_type = ?${
			scope.id !== undefined ? " AND scope_id = ?" : ""
		})`;
		params.push(scope.type);
		if (scope.id !== undefined) params.push(scope.id);
	}
	const rows = await db.select<{ count: number; bytes: number | null }[]>(
		sql,
		params,
	);
	return { count: rows[0]?.count ?? 0, bytes: rows[0]?.bytes ?? 0 };
}

/**
 * One-time conversion of legacy base64 `climb_images.local_data` into files.
 * Safe to run on every launch: converted rows have local_data cleared, and a
 * row that fails is left untouched and retried next time.
 */
export async function migrateLocalDataToFiles(): Promise<void> {
	const db = await getDb();
	const rows = await db.select<
		{ id: string; climb_id: string; image_url: string; local_data: string }[]
	>(
		"SELECT id, climb_id, image_url, local_data FROM climb_images WHERE local_data IS NOT NULL",
	);
	for (const row of rows) {
		try {
			await cacheImage(
				climbImageKey(row.image_url),
				base64ToBlob(row.local_data),
				{ type: "climb", id: row.climb_id },
			);
			await db.execute(
				"UPDATE climb_images SET local_data = NULL WHERE id = ?",
				[row.id],
			);
		} catch (err) {
			console.error("local_data migration failed for", row.id, err);
		}
	}
}
