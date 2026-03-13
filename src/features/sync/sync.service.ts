import type { Burn } from "@/features/burns/burns.schema";
import type { Climb } from "@/features/climbs/climbs.schema";
import { getDb } from "@/lib/db";
import { supabase } from "@/lib/supabase";

// ── Sync metadata ─────────────────────────────────────────────────────────────

export async function getSyncMeta(): Promise<{
	last_synced_at: string | null;
}> {
	const db = await getDb();
	const rows = await db.select<{ last_synced_at: string | null }[]>(
		"SELECT last_synced_at FROM sync_meta WHERE id = 'singleton'",
	);
	return rows[0] ?? { last_synced_at: null };
}

export async function setSyncMeta(lastSyncedAt: string): Promise<void> {
	const db = await getDb();
	await db.execute(
		"UPDATE sync_meta SET last_synced_at = ? WHERE id = 'singleton'",
		[lastSyncedAt],
	);
}

// ── Push ──────────────────────────────────────────────────────────────────────

// Push local climbs to Supabase. Runs before pull so local changes always win.
// If `since` is provided, only pushes climbs modified after that timestamp (delta).
// Full push (no `since`) is used on first sync to ensure the server is complete.
export async function pushClimbs(
	userId: string,
	since?: string,
): Promise<void> {
	const db = await getDb();
	const climbs = await db.select<Climb[]>(
		since
			? "SELECT * FROM climbs WHERE user_id = ? AND updated_at > ?"
			: "SELECT * FROM climbs WHERE user_id = ?",
		since ? [userId, since] : [userId],
	);
	if (climbs.length === 0) return;

	const { error } = await supabase.from("climbs").upsert(climbs, {
		onConflict: "id",
	});
	if (error) throw error;
}

// ── Pull ──────────────────────────────────────────────────────────────────────

// Pull Supabase climbs and apply locally using INSERT OR REPLACE to preserve
// server timestamps (bypasses the updated_at trigger).
// If `since` is provided, only fetches climbs modified after that timestamp (delta).
export async function pullClimbs(
	userId: string,
	since?: string,
): Promise<void> {
	let query = supabase.from("climbs").select("*").eq("user_id", userId);
	if (since) query = query.gt("updated_at", since);

	const { data, error } = await query;
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

// ── Burns push ───────────────────────────────────────────────────────────────

export async function pushBurns(userId: string, since?: string): Promise<void> {
	const db = await getDb();
	const burns = await db.select<Burn[]>(
		since
			? "SELECT * FROM burns WHERE user_id = ? AND updated_at > ?"
			: "SELECT * FROM burns WHERE user_id = ?",
		since ? [userId, since] : [userId],
	);
	if (burns.length === 0) return;

	const { error } = await supabase.from("burns").upsert(burns, {
		onConflict: "id",
	});
	if (error) throw error;
}

// ── Burns pull ───────────────────────────────────────────────────────────────

export async function pullBurns(userId: string, since?: string): Promise<void> {
	let query = supabase.from("burns").select("*").eq("user_id", userId);
	if (since) query = query.gt("updated_at", since);

	const { data, error } = await query;
	if (error) throw error;
	if (!data || data.length === 0) return;

	const db = await getDb();
	for (const row of data) {
		await db.execute(
			`INSERT OR REPLACE INTO burns
       (id, climb_id, user_id, date, outcome, notes,
        created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				row.id,
				row.climb_id,
				row.user_id,
				row.date,
				row.outcome,
				row.notes ?? null,
				row.created_at,
				row.updated_at,
				row.deleted_at ?? null,
			],
		);
	}
}
