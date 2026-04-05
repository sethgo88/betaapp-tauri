import { getDb } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type { Tag } from "./tags.schema";

// ── Reference data ────────────────────────────────────────────────────────────

export async function fetchTags(): Promise<Tag[]> {
	const db = await getDb();
	return db.select<Tag[]>("SELECT * FROM tags_cache ORDER BY sort_order ASC");
}

export async function pullTags(): Promise<void> {
	const { data, error } = await supabase.from("tags").select("*");
	if (error) throw error;
	if (!data || data.length === 0) return;

	const db = await getDb();
	await db.execute("DELETE FROM tags_cache");
	for (const row of data as Tag[]) {
		await db.execute(
			"INSERT INTO tags_cache (id, name, sort_order) VALUES (?, ?, ?)",
			[row.id, row.name, row.sort_order],
		);
	}
}

// ── Route tags ────────────────────────────────────────────────────────────────

export async function fetchRouteTags(routeId: string): Promise<Tag[]> {
	const db = await getDb();
	return db.select<Tag[]>(
		`SELECT t.id, t.name, t.sort_order
     FROM route_tags_cache rt
     JOIN tags_cache t ON t.id = rt.tag_id
     WHERE rt.route_id = ?
     ORDER BY t.sort_order ASC`,
		[routeId],
	);
}

export async function setRouteTags(
	routeId: string,
	tagIds: string[],
): Promise<void> {
	const db = await getDb();

	// SQLite first — local display always reflects the change immediately
	await db.execute("DELETE FROM route_tags_cache WHERE route_id = ?", [
		routeId,
	]);

	const rows = tagIds.map((tagId) => ({
		id: crypto.randomUUID(),
		route_id: routeId,
		tag_id: tagId,
	}));

	for (const row of rows) {
		await db.execute(
			"INSERT INTO route_tags_cache (id, route_id, tag_id) VALUES (?, ?, ?)",
			[row.id, row.route_id, row.tag_id],
		);
	}

	// Supabase sync
	const { error: delError } = await supabase
		.from("route_tags")
		.delete()
		.eq("route_id", routeId);
	if (delError) throw delError;

	if (tagIds.length === 0) return;

	const { error: insError } = await supabase.from("route_tags").insert(rows);
	if (insError) throw insError;
}

export async function applyRemoteRouteTags(
	routeId: string,
	rows: Array<{ id: string; route_id: string; tag_id: string }>,
): Promise<void> {
	const db = await getDb();
	await db.execute("DELETE FROM route_tags_cache WHERE route_id = ?", [
		routeId,
	]);
	for (const row of rows) {
		await db.execute(
			"INSERT INTO route_tags_cache (id, route_id, tag_id) VALUES (?, ?, ?)",
			[row.id, row.route_id, row.tag_id],
		);
	}
}

// ── Wall tags ─────────────────────────────────────────────────────────────────

export async function fetchWallTags(wallId: string): Promise<Tag[]> {
	const db = await getDb();
	return db.select<Tag[]>(
		`SELECT t.id, t.name, t.sort_order
     FROM wall_tags_cache wt
     JOIN tags_cache t ON t.id = wt.tag_id
     WHERE wt.wall_id = ?
     ORDER BY t.sort_order ASC`,
		[wallId],
	);
}

export async function setWallTags(
	wallId: string,
	tagIds: string[],
): Promise<void> {
	const db = await getDb();

	// SQLite first — local display always reflects the change immediately
	await db.execute("DELETE FROM wall_tags_cache WHERE wall_id = ?", [wallId]);

	const rows = tagIds.map((tagId) => ({
		id: crypto.randomUUID(),
		wall_id: wallId,
		tag_id: tagId,
	}));

	for (const row of rows) {
		await db.execute(
			"INSERT INTO wall_tags_cache (id, wall_id, tag_id) VALUES (?, ?, ?)",
			[row.id, row.wall_id, row.tag_id],
		);
	}

	// Supabase sync
	const { error: delError } = await supabase
		.from("wall_tags")
		.delete()
		.eq("wall_id", wallId);
	if (delError) throw delError;

	if (tagIds.length === 0) return;

	const { error: insError } = await supabase.from("wall_tags").insert(rows);
	if (insError) throw insError;
}

export async function applyRemoteWallTags(
	wallId: string,
	rows: Array<{ id: string; wall_id: string; tag_id: string }>,
): Promise<void> {
	const db = await getDb();
	await db.execute("DELETE FROM wall_tags_cache WHERE wall_id = ?", [wallId]);
	for (const row of rows) {
		await db.execute(
			"INSERT INTO wall_tags_cache (id, wall_id, tag_id) VALUES (?, ?, ?)",
			[row.id, row.wall_id, row.tag_id],
		);
	}
}
