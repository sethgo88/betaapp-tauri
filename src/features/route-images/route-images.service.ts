import { getDb } from "@/lib/db";
import type { RouteImage, WallImage } from "./route-images.schema";

// ── Route images ──────────────────────────────────────────────────────────────

export async function fetchRouteImages(routeId: string): Promise<RouteImage[]> {
	const db = await getDb();
	return db.select<RouteImage[]>(
		"SELECT * FROM route_images_cache WHERE route_id = ? ORDER BY sort_order ASC",
		[routeId],
	);
}

export async function insertRouteImage(
	routeId: string,
	uploadedBy: string,
	imageUrl: string,
	sortOrder: number,
	sizeBytes?: number,
): Promise<string> {
	const db = await getDb();
	const id = crypto.randomUUID();
	await db.execute(
		`INSERT INTO route_images_cache (id, route_id, image_url, sort_order, uploaded_by, size_bytes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
		[id, routeId, imageUrl, sortOrder, uploadedBy, sizeBytes ?? null],
	);
	return id;
}

export async function deleteRouteImage(id: string): Promise<void> {
	const db = await getDb();
	await db.execute("DELETE FROM route_images_cache WHERE id = ?", [id]);
}

export async function applyRemoteRouteImage(image: RouteImage): Promise<void> {
	const db = await getDb();
	await db.execute(
		`INSERT OR REPLACE INTO route_images_cache
     (id, route_id, image_url, sort_order, uploaded_by, size_bytes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[
			image.id,
			image.route_id,
			image.image_url,
			image.sort_order,
			image.uploaded_by,
			image.size_bytes ?? null,
			image.created_at,
		],
	);
}

// ── Wall images ───────────────────────────────────────────────────────────────

export async function fetchWallImages(wallId: string): Promise<WallImage[]> {
	const db = await getDb();
	return db.select<WallImage[]>(
		"SELECT * FROM wall_images_cache WHERE wall_id = ? ORDER BY sort_order ASC",
		[wallId],
	);
}

export async function insertWallImage(
	wallId: string,
	uploadedBy: string,
	imageUrl: string,
	sortOrder: number,
	sizeBytes?: number,
): Promise<string> {
	const db = await getDb();
	const id = crypto.randomUUID();
	await db.execute(
		`INSERT INTO wall_images_cache (id, wall_id, image_url, sort_order, uploaded_by, size_bytes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
		[id, wallId, imageUrl, sortOrder, uploadedBy, sizeBytes ?? null],
	);
	return id;
}

export async function deleteWallImage(id: string): Promise<void> {
	const db = await getDb();
	await db.execute("DELETE FROM wall_images_cache WHERE id = ?", [id]);
}

export async function applyRemoteWallImage(image: WallImage): Promise<void> {
	const db = await getDb();
	await db.execute(
		`INSERT OR REPLACE INTO wall_images_cache
     (id, wall_id, image_url, sort_order, uploaded_by, size_bytes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[
			image.id,
			image.wall_id,
			image.image_url,
			image.sort_order,
			image.uploaded_by,
			image.size_bytes ?? null,
			image.created_at,
		],
	);
}

// ── Size lookup ───────────────────────────────────────────────────────────────

/**
 * Recorded size of a gallery image, found by its public URL. Used when a topo
 * reuses an existing route/wall image so it inherits that image's size.
 * Returns null for legacy images with no recorded size.
 */
export async function getImageSizeByUrl(
	imageUrl: string,
): Promise<number | null> {
	const db = await getDb();
	for (const table of ["route_images_cache", "wall_images_cache"]) {
		const rows = await db.select<{ size_bytes: number | null }[]>(
			`SELECT size_bytes FROM ${table} WHERE image_url = ? LIMIT 1`,
			[imageUrl],
		);
		if (rows[0]) return rows[0].size_bytes;
	}
	return null;
}
