import { getDb } from "@/lib/db";
import { supabase as _supabase } from "@/lib/supabase";
import type { Point, RouteTopo, WallTopo, WallTopoLine } from "./topos.schema";

// Topo tables are not yet in the generated Supabase types — cast to bypass until types are regenerated
// biome-ignore lint/suspicious/noExplicitAny: topo tables not in generated types
const supabase = _supabase as any;

// ── Wall topos ────────────────────────────────────────────────────────────────

export async function fetchWallTopo(wallId: string): Promise<WallTopo | null> {
	const db = await getDb();
	const rows = await db.select<WallTopo[]>(
		"SELECT * FROM wall_topos_cache WHERE wall_id = ? LIMIT 1",
		[wallId],
	);
	return rows[0] ?? null;
}

export async function upsertWallTopo(
	wallId: string,
	imageUrl: string,
	createdBy: string,
): Promise<string> {
	const db = await getDb();

	// Only one topo per wall — check for existing
	const existing = await fetchWallTopo(wallId);
	if (existing) {
		// Update image url
		await supabase
			.from("wall_topos")
			.update({ image_url: imageUrl })
			.eq("id", existing.id);
		await db.execute("UPDATE wall_topos_cache SET image_url = ? WHERE id = ?", [
			imageUrl,
			existing.id,
		]);
		return existing.id;
	}

	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	await supabase.from("wall_topos").insert({
		id,
		wall_id: wallId,
		image_url: imageUrl,
		created_by: createdBy,
		created_at: now,
	});
	await db.execute(
		`INSERT INTO wall_topos_cache (id, wall_id, image_url, created_by, created_at)
     VALUES (?, ?, ?, ?, ?)`,
		[id, wallId, imageUrl, createdBy, now],
	);
	return id;
}

export async function deleteWallTopo(
	id: string,
	imageUrl: string,
): Promise<void> {
	const db = await getDb();
	// Delete all lines first
	await supabase.from("wall_topo_lines").delete().eq("topo_id", id);
	await db.execute("DELETE FROM wall_topo_lines_cache WHERE topo_id = ?", [id]);
	await supabase.from("wall_topos").delete().eq("id", id);
	await db.execute("DELETE FROM wall_topos_cache WHERE id = ?", [id]);
	// Remove from storage
	const marker = "/storage/v1/object/public/route-images/";
	const storagePath = imageUrl.includes(marker)
		? imageUrl.split(marker)[1]
		: null;
	if (storagePath?.startsWith("topos/")) {
		await supabase.storage.from("route-images").remove([storagePath]);
	}
}

// ── Wall topo lines ───────────────────────────────────────────────────────────

type WallTopoLineRow = Omit<WallTopoLine, "points"> & { points: string };

export async function fetchWallTopoLines(
	topoId: string,
): Promise<WallTopoLine[]> {
	const db = await getDb();
	const rows = await db.select<WallTopoLineRow[]>(
		"SELECT * FROM wall_topo_lines_cache WHERE topo_id = ? ORDER BY sort_order ASC",
		[topoId],
	);
	return rows.map((r) => ({
		...r,
		points: JSON.parse(r.points) as Point[],
	}));
}

export async function upsertWallTopoLine(
	topoId: string,
	routeId: string,
	points: Point[],
	color: string,
	sortOrder: number,
): Promise<string> {
	const db = await getDb();
	const pointsJson = JSON.stringify(points);

	// Check if a line for this route already exists on this topo
	const existing = await db.select<{ id: string }[]>(
		"SELECT id FROM wall_topo_lines_cache WHERE topo_id = ? AND route_id = ? LIMIT 1",
		[topoId, routeId],
	);

	if (existing[0]) {
		const lineId = existing[0].id;
		await supabase.from("wall_topo_lines").upsert({
			id: lineId,
			topo_id: topoId,
			route_id: routeId,
			points: pointsJson,
			color,
			sort_order: sortOrder,
		});
		await db.execute(
			`UPDATE wall_topo_lines_cache SET points = ?, color = ?, sort_order = ? WHERE id = ?`,
			[pointsJson, color, sortOrder, lineId],
		);
		return lineId;
	}

	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	await supabase.from("wall_topo_lines").insert({
		id,
		topo_id: topoId,
		route_id: routeId,
		points: pointsJson,
		color,
		sort_order: sortOrder,
		created_at: now,
	});
	await db.execute(
		`INSERT INTO wall_topo_lines_cache (id, topo_id, route_id, points, color, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[id, topoId, routeId, pointsJson, color, sortOrder, now],
	);
	return id;
}

export async function deleteWallTopoLine(id: string): Promise<void> {
	const db = await getDb();
	await supabase.from("wall_topo_lines").delete().eq("id", id);
	await db.execute("DELETE FROM wall_topo_lines_cache WHERE id = ?", [id]);
}

// ── Route topos ───────────────────────────────────────────────────────────────

type RouteTopoRow = Omit<RouteTopo, "points"> & { points: string };

export async function fetchRouteTopo(
	routeId: string,
): Promise<RouteTopo | null> {
	const db = await getDb();
	const rows = await db.select<RouteTopoRow[]>(
		"SELECT * FROM route_topos_cache WHERE route_id = ? LIMIT 1",
		[routeId],
	);
	if (!rows[0]) return null;
	return { ...rows[0], points: JSON.parse(rows[0].points) as Point[] };
}

export async function upsertRouteTopo(
	routeId: string,
	imageUrl: string,
	points: Point[],
	color: string,
	createdBy: string,
): Promise<string> {
	const db = await getDb();
	const pointsJson = JSON.stringify(points);

	const existing = await fetchRouteTopo(routeId);
	if (existing) {
		await supabase
			.from("route_topos")
			.update({ image_url: imageUrl, points: pointsJson, color })
			.eq("id", existing.id);
		await db.execute(
			"UPDATE route_topos_cache SET image_url = ?, points = ?, color = ? WHERE id = ?",
			[imageUrl, pointsJson, color, existing.id],
		);
		return existing.id;
	}

	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	await supabase.from("route_topos").insert({
		id,
		route_id: routeId,
		image_url: imageUrl,
		points: pointsJson,
		color,
		created_by: createdBy,
		created_at: now,
	});
	await db.execute(
		`INSERT INTO route_topos_cache (id, route_id, image_url, points, color, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[id, routeId, imageUrl, pointsJson, color, createdBy, now],
	);
	return id;
}

export async function deleteRouteTopo(
	id: string,
	imageUrl: string,
): Promise<void> {
	const db = await getDb();
	await supabase.from("route_topos").delete().eq("id", id);
	await db.execute("DELETE FROM route_topos_cache WHERE id = ?", [id]);
	const marker = "/storage/v1/object/public/route-images/";
	const storagePath = imageUrl.includes(marker)
		? imageUrl.split(marker)[1]
		: null;
	if (storagePath?.startsWith("topos/")) {
		await supabase.storage.from("route-images").remove([storagePath]);
	}
}
