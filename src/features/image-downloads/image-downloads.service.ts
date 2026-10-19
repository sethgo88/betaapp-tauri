import { isTauri } from "@tauri-apps/api/core";
import {
	addRef,
	cacheImage,
	getCachedKeys,
	releaseRef,
	releaseScope,
} from "@/features/image-cache/image-cache.service";
import { downloadRegion } from "@/features/locations/locations.service";
import { getDb } from "@/lib/db";
import type {
	DownloadResult,
	ImageDownload,
	ScopeImage,
	ScopeSummary,
	ScopeType,
} from "./image-downloads.schema";

const POOL_SIZE = 4;
const CHUNK = 400; // stay well under SQLite's bound-variable limit

type Db = Awaited<ReturnType<typeof getDb>>;

/** Run `build(placeholders)` over `ids` in chunks and concatenate the rows. */
async function selectIn<T>(
	db: Db,
	ids: string[],
	build: (placeholders: string) => string,
): Promise<T[]> {
	const rows: T[] = [];
	for (let i = 0; i < ids.length; i += CHUNK) {
		const chunk = ids.slice(i, i + CHUNK);
		rows.push(
			...(await db.select<T[]>(build(chunk.map(() => "?").join(",")), chunk)),
		);
	}
	return rows;
}

// ── Scope resolution ──────────────────────────────────────────────────────────

type ScopeIds = { wallIds: string[]; routeIds: string[] };

async function resolveDescendants(
	db: Db,
	type: ScopeType,
	id: string,
): Promise<ScopeIds> {
	let wallIds: string[] = [];
	let routeIds: string[] = [];

	if (type === "route") {
		routeIds = [id];
		const rows = await db.select<{ wall_id: string }[]>(
			"SELECT wall_id FROM routes_cache WHERE id = ?",
			[id],
		);
		wallIds = rows.map((r) => r.wall_id);
		return { wallIds, routeIds };
	}

	if (type === "wall") {
		wallIds = [id];
	} else {
		let cragIds: string[];
		if (type === "crag") {
			cragIds = [id];
		} else {
			const crags = await db.select<{ id: string }[]>(
				"SELECT id FROM crags_cache WHERE sub_region_id = ?",
				[id],
			);
			cragIds = crags.map((c) => c.id);
		}
		const walls = await selectIn<{ id: string }>(
			db,
			cragIds,
			(ph) => `SELECT id FROM walls_cache WHERE crag_id IN (${ph})`,
		);
		wallIds = walls.map((w) => w.id);
	}

	const routes = await selectIn<{ id: string }>(
		db,
		wallIds,
		(ph) => `SELECT id FROM routes_cache WHERE wall_id IN (${ph})`,
	);
	routeIds = routes.map((r) => r.id);
	return { wallIds, routeIds };
}

type ScopeInfo = { regionId: string; name: string };

/** Name and owning region of an area, found by walking up the local cache. */
export async function resolveScope(
	type: ScopeType,
	id: string,
): Promise<ScopeInfo | null> {
	const db = await getDb();
	const one = async (sql: string, params: unknown[]) =>
		(await db.select<Record<string, string>[]>(sql, params))[0];

	if (type === "sub_region") {
		const sr = await one(
			"SELECT name, region_id FROM sub_regions_cache WHERE id = ?",
			[id],
		);
		return sr ? { regionId: sr.region_id, name: sr.name } : null;
	}

	let name: string;
	let cragId: string | undefined;
	if (type === "route") {
		const r = await one(
			`SELECT r.name, w.crag_id FROM routes_cache r
       JOIN walls_cache w ON w.id = r.wall_id WHERE r.id = ?`,
			[id],
		);
		if (!r) return null;
		name = r.name;
		cragId = r.crag_id;
	} else if (type === "wall") {
		const w = await one("SELECT name, crag_id FROM walls_cache WHERE id = ?", [
			id,
		]);
		if (!w) return null;
		name = w.name;
		cragId = w.crag_id;
	} else {
		const c = await one("SELECT name FROM crags_cache WHERE id = ?", [id]);
		if (!c) return null;
		name = c.name;
		cragId = id;
	}

	const sr = await one(
		`SELECT s.region_id FROM crags_cache c
     JOIN sub_regions_cache s ON s.id = c.sub_region_id WHERE c.id = ?`,
		[cragId],
	);
	return sr ? { regionId: sr.region_id, name } : null;
}

export async function isRegionDataDownloaded(
	regionId: string,
): Promise<boolean> {
	const db = await getDb();
	const rows = await db.select<{ region_id: string }[]>(
		"SELECT region_id FROM downloaded_regions WHERE region_id = ?",
		[regionId],
	);
	return rows.length > 0;
}

// ── Collection & summary ──────────────────────────────────────────────────────

/**
 * Every image belonging to an area and all its children, de-duplicated by URL
 * (a topo can reuse a gallery image). A route scope also includes its wall's
 * topo, which the route page shows when the route has no topo of its own.
 */
export async function collectScopeImages(
	type: ScopeType,
	id: string,
): Promise<ScopeImage[]> {
	const db = await getDb();
	const { wallIds, routeIds } = await resolveDescendants(db, type, id);

	type Row = { image_url: string; size_bytes: number | null };
	const rows: Row[] = [];

	if (type !== "route") {
		rows.push(
			...(await selectIn<Row>(
				db,
				wallIds,
				(ph) =>
					`SELECT image_url, size_bytes FROM wall_images_cache WHERE wall_id IN (${ph})`,
			)),
		);
	}
	rows.push(
		...(await selectIn<Row>(
			db,
			wallIds,
			(ph) =>
				`SELECT image_url, size_bytes FROM wall_topos_cache WHERE wall_id IN (${ph})`,
		)),
		...(await selectIn<Row>(
			db,
			routeIds,
			(ph) =>
				`SELECT image_url, size_bytes FROM route_images_cache WHERE route_id IN (${ph})`,
		)),
		...(await selectIn<Row>(
			db,
			routeIds,
			(ph) =>
				`SELECT image_url, size_bytes FROM route_topos_cache WHERE route_id IN (${ph})`,
		)),
	);

	const byUrl = new Map<string, ScopeImage>();
	for (const r of rows) {
		const existing = byUrl.get(r.image_url);
		// Prefer a row that knows its size when the same URL appears twice
		if (!existing || (existing.sizeBytes == null && r.size_bytes != null)) {
			byUrl.set(r.image_url, { key: r.image_url, sizeBytes: r.size_bytes });
		}
	}
	return [...byUrl.values()];
}

export async function getScopeSummary(
	type: ScopeType,
	id: string,
): Promise<ScopeSummary> {
	const info = await resolveScope(type, id);
	const areaName = info?.name ?? "this area";
	if (!info) {
		return {
			total: 0,
			toDownload: 0,
			knownBytes: 0,
			unknownCount: 0,
			regionDataMissing: false,
			areaName,
			regionName: null,
		};
	}

	const db = await getDb();
	const region = await db.select<{ name: string }[]>(
		"SELECT name FROM regions_cache WHERE id = ?",
		[info.regionId],
	);
	const regionName = region[0]?.name ?? null;

	if (!(await isRegionDataDownloaded(info.regionId))) {
		return {
			total: 0,
			toDownload: 0,
			knownBytes: 0,
			unknownCount: 0,
			regionDataMissing: true,
			areaName,
			regionName,
		};
	}

	const images = await collectScopeImages(type, id);
	const cached = await getCachedKeys(images.map((i) => i.key));
	const missing = images.filter((i) => !cached.has(i.key));
	return {
		total: images.length,
		toDownload: missing.length,
		knownBytes: missing.reduce((sum, i) => sum + (i.sizeBytes ?? 0), 0),
		unknownCount: missing.filter((i) => i.sizeBytes == null).length,
		regionDataMissing: false,
		areaName,
		regionName,
	};
}

// ── Registry ──────────────────────────────────────────────────────────────────

export async function fetchImageDownloads(): Promise<ImageDownload[]> {
	const db = await getDb();
	return db.select<ImageDownload[]>(
		"SELECT * FROM image_downloads ORDER BY name ASC",
	);
}

export async function fetchImageDownload(
	type: ScopeType,
	id: string,
): Promise<ImageDownload | null> {
	const db = await getDb();
	const rows = await db.select<ImageDownload[]>(
		"SELECT * FROM image_downloads WHERE scope_type = ? AND scope_id = ?",
		[type, id],
	);
	return rows[0] ?? null;
}

async function saveDownload(
	type: ScopeType,
	id: string,
	name: string,
	status: "complete" | "partial",
	imageCount: number,
): Promise<void> {
	const db = await getDb();
	await db.execute(
		`INSERT OR REPLACE INTO image_downloads
     (scope_type, scope_id, name, status, image_count, downloaded_at)
     VALUES (?, ?, ?, ?, ?, ${status === "complete" ? "datetime('now')" : "NULL"})`,
		[type, id, name, status, imageCount],
	);
}

// ── Download / refetch / delete ───────────────────────────────────────────────

type DownloadOptions = {
	signal?: AbortSignal;
	onProgress?: (done: number, total: number) => void;
	/** Injectable for tests */
	fetchImpl?: typeof fetch;
};

/**
 * Download every image in an area (and its children) into the file cache.
 * Images already on the device are only linked to this area; images no longer
 * in the area are unlinked. Safe to re-run: cancelled / failed runs leave the
 * area `partial` and the next run resumes without refetching cached files.
 */
export async function downloadScopeImages(
	type: ScopeType,
	id: string,
	options: DownloadOptions = {},
): Promise<DownloadResult> {
	if (!isTauri()) return { downloaded: 0, failed: 0, cancelled: false };
	const { signal, onProgress, fetchImpl = fetch } = options;
	const scope = { type, id };

	const info = await resolveScope(type, id);
	if (!info) throw new Error("Area not found on this device");

	if (!(await isRegionDataDownloaded(info.regionId))) {
		await downloadRegion(info.regionId);
	}

	const images = await collectScopeImages(type, id);
	const keys = new Set(images.map((i) => i.key));
	await saveDownload(type, id, info.name, "partial", images.length);

	// Unlink images that have left the area since the last download
	const db = await getDb();
	const previous = await db.select<{ key: string }[]>(
		"SELECT key FROM cached_image_refs WHERE scope_type = ? AND scope_id = ?",
		[type, id],
	);
	for (const { key } of previous) {
		if (!keys.has(key)) await releaseRef(key, scope);
	}

	const cached = await getCachedKeys([...keys]);
	for (const key of cached) await addRef(key, scope);
	const todo = images.filter((i) => !cached.has(i.key));

	let next = 0;
	let done = 0;
	let downloaded = 0;
	let failed = 0;
	onProgress?.(0, todo.length);

	const worker = async () => {
		while (!signal?.aborted) {
			const item = todo[next++];
			if (!item) return;
			try {
				const res = await fetchImpl(item.key, { signal });
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				await cacheImage(item.key, await res.blob(), scope);
				downloaded++;
			} catch (err) {
				if (signal?.aborted) return;
				console.error("Image download failed:", item.key, err);
				failed++;
			}
			done++;
			onProgress?.(done, todo.length);
		}
	};
	await Promise.all(Array.from({ length: POOL_SIZE }, worker));

	const cancelled = signal?.aborted ?? false;
	if (!cancelled && failed === 0) {
		await saveDownload(type, id, info.name, "complete", images.length);
	}
	return { downloaded, failed, cancelled };
}

/** Remove an area's downloaded images. Files shared with other areas are kept. */
export async function deleteScopeImages(
	type: ScopeType,
	id: string,
): Promise<void> {
	await releaseScope({ type, id });
	const db = await getDb();
	await db.execute(
		"DELETE FROM image_downloads WHERE scope_type = ? AND scope_id = ?",
		[type, id],
	);
}
