import type { Climb } from "@/features/climbs/climbs.schema";
import { getDb } from "@/lib/db";
import { supabase } from "@/lib/supabase";

// Push all local climbs (including soft-deleted) to Supabase.
// Runs before pull so local changes always reach the server first.
export async function pushClimbs(userId: string): Promise<void> {
	const db = await getDb();
	const climbs = await db.select<Climb[]>(
		"SELECT * FROM climbs WHERE user_id = ?",
		[userId],
	);
	if (climbs.length === 0) return;

	const { error } = await supabase.from("climbs").upsert(climbs, {
		onConflict: "id",
	});
	if (error) throw error;
}

// Pull all Supabase climbs for the user and apply them locally.
// Uses INSERT OR REPLACE to bypass the updated_at trigger — preserving
// the server timestamp rather than stamping the current time.
export async function pullClimbs(userId: string): Promise<void> {
	const { data, error } = await supabase
		.from("climbs")
		.select("*")
		.eq("user_id", userId);
	if (error) throw error;
	if (!data || data.length === 0) return;

	const db = await getDb();
	for (const row of data) {
		await db.execute(
			`INSERT OR REPLACE INTO climbs
       (id, user_id, name, route_type, grade, moves, sent_status,
        country, area, sub_area, route_location, link, route_id,
        created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				row.id,
				row.user_id,
				row.name,
				row.route_type,
				row.grade,
				row.moves,
				row.sent_status,
				row.country ?? null,
				row.area ?? null,
				row.sub_area ?? null,
				row.route_location ?? null,
				row.link ?? null,
				row.route_id ?? null,
				row.created_at,
				row.updated_at,
				row.deleted_at ?? null,
			],
		);
	}
}
