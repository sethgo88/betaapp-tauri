import { getDb } from "@/lib/db";
import type { Climb, ClimbFormValues } from "./climbs.schema";

export async function fetchClimbs(userId: string): Promise<Climb[]> {
	const db = await getDb();
	return db.select<Climb[]>(
		"SELECT * FROM climbs WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC",
		[userId],
	);
}

export async function fetchClimb(id: string): Promise<Climb | null> {
	const db = await getDb();
	const rows = await db.select<Climb[]>(
		"SELECT * FROM climbs WHERE id = ? AND deleted_at IS NULL",
		[id],
	);
	return rows[0] ?? null;
}

export async function insertClimb(
	userId: string,
	data: ClimbFormValues,
	routeId?: string,
): Promise<void> {
	const db = await getDb();
	const id = crypto.randomUUID();
	await db.execute(
		`INSERT INTO climbs (id, user_id, name, route_type, grade, moves, sent_status, country, area, sub_area, crag, wall, route_location, link, route_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			id,
			userId,
			data.name,
			data.route_type,
			data.grade,
			data.moves,
			data.sent_status,
			data.country ?? null,
			data.area ?? null,
			data.sub_area ?? null,
			data.crag ?? null,
			data.wall ?? null,
			data.route_location ?? null,
			data.link ?? null,
			routeId ?? null,
		],
	);
}

export async function updateClimb(
	id: string,
	data: ClimbFormValues,
	routeId?: string | null,
): Promise<void> {
	const db = await getDb();
	await db.execute(
		`UPDATE climbs
     SET name = ?, route_type = ?, grade = ?, moves = ?, sent_status = ?,
         country = ?, area = ?, sub_area = ?, crag = ?, wall = ?, route_location = ?, link = ?, route_id = ?
     WHERE id = ? AND deleted_at IS NULL`,
		[
			data.name,
			data.route_type,
			data.grade,
			data.moves,
			data.sent_status,
			data.country ?? null,
			data.area ?? null,
			data.sub_area ?? null,
			data.crag ?? null,
			data.wall ?? null,
			data.route_location ?? null,
			data.link ?? null,
			routeId ?? null,
			id,
		],
	);
}

export async function updateClimbMoves(
	id: string,
	moves: string,
): Promise<void> {
	const db = await getDb();
	await db.execute(
		"UPDATE climbs SET moves = ? WHERE id = ? AND deleted_at IS NULL",
		[moves, id],
	);
}

export async function linkClimbToRoute(
	climbId: string,
	routeId: string,
): Promise<void> {
	const db = await getDb();
	await db.execute(
		"UPDATE climbs SET route_id = ? WHERE id = ? AND deleted_at IS NULL",
		[routeId, climbId],
	);
}

export async function softDeleteClimb(id: string): Promise<void> {
	const db = await getDb();
	await db.execute(
		"UPDATE climbs SET deleted_at = datetime('now') WHERE id = ?",
		[id],
	);
}

// Apply a climb received from Supabase Realtime or a pull.
// Uses INSERT OR REPLACE to bypass the updated_at trigger so the
// server timestamp is preserved exactly.
export async function applyRemoteClimb(climb: Climb): Promise<void> {
	const db = await getDb();
	await db.execute(
		`INSERT OR REPLACE INTO climbs
     (id, user_id, name, route_type, grade, moves, sent_status,
      country, area, sub_area, crag, wall, route_location, link, route_id,
      created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			climb.id,
			climb.user_id,
			climb.name,
			climb.route_type,
			climb.grade,
			climb.moves,
			climb.sent_status,
			climb.country ?? null,
			climb.area ?? null,
			climb.sub_area ?? null,
			climb.crag ?? null,
			climb.wall ?? null,
			climb.route_location ?? null,
			climb.link ?? null,
			climb.route_id ?? null,
			climb.created_at,
			climb.updated_at,
			climb.deleted_at ?? null,
		],
	);
}
