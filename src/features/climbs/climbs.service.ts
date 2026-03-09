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
): Promise<void> {
	const db = await getDb();
	const id = crypto.randomUUID();
	await db.execute(
		`INSERT INTO climbs (id, user_id, name, route_type, grade, moves, sent_status, country, area, sub_area, route_location, link)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
			data.route_location ?? null,
			data.link ?? null,
		],
	);
}

export async function updateClimb(
	id: string,
	data: ClimbFormValues,
): Promise<void> {
	const db = await getDb();
	await db.execute(
		`UPDATE climbs
     SET name = ?, route_type = ?, grade = ?, moves = ?, sent_status = ?,
         country = ?, area = ?, sub_area = ?, route_location = ?, link = ?
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
			data.route_location ?? null,
			data.link ?? null,
			id,
		],
	);
}

export async function softDeleteClimb(id: string): Promise<void> {
	const db = await getDb();
	await db.execute(
		"UPDATE climbs SET deleted_at = datetime('now') WHERE id = ?",
		[id],
	);
}
