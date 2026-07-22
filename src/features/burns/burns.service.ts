import { isTauri } from "@tauri-apps/api/core";
import { getDb } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type { Burn, BurnFormValues } from "./burns.schema";

export async function fetchBurns(climbId: string): Promise<Burn[]> {
	if (!isTauri()) {
		const { data, error } = await supabase
			.from("burns")
			.select("*")
			.eq("climb_id", climbId)
			.is("deleted_at", null)
			.order("date");
		if (error) throw error;
		return (data as Burn[]) ?? [];
	}
	const db = await getDb();
	return db.select<Burn[]>(
		"SELECT * FROM burns WHERE climb_id = ? AND deleted_at IS NULL ORDER BY date ASC",
		[climbId],
	);
}

export async function insertBurn(
	climbId: string,
	userId: string,
	data: BurnFormValues,
): Promise<void> {
	if (!isTauri()) {
		const { error } = await supabase.from("burns").insert({
			id: crypto.randomUUID(),
			climb_id: climbId,
			user_id: userId,
			date: data.date,
			outcome: "attempt",
			notes: data.notes ?? null,
			feel: data.feel ?? null,
		});
		if (error) throw error;
		return;
	}
	const db = await getDb();
	const id = crypto.randomUUID();
	await db.execute(
		`INSERT INTO burns (id, climb_id, user_id, date, outcome, notes, feel)
     VALUES (?, ?, ?, ?, 'attempt', ?, ?)`,
		[id, climbId, userId, data.date, data.notes ?? null, data.feel ?? null],
	);
}

export async function updateBurn(
	id: string,
	data: BurnFormValues,
): Promise<void> {
	if (!isTauri()) {
		const { error } = await supabase
			.from("burns")
			.update({ date: data.date, notes: data.notes ?? null, feel: data.feel ?? null })
			.eq("id", id)
			.is("deleted_at", null);
		if (error) throw error;
		return;
	}
	const db = await getDb();
	await db.execute(
		`UPDATE burns SET date = ?, notes = ?, feel = ?
     WHERE id = ? AND deleted_at IS NULL`,
		[data.date, data.notes ?? null, data.feel ?? null, id],
	);
}

export async function softDeleteBurn(id: string): Promise<void> {
	if (!isTauri()) {
		const { error } = await supabase
			.from("burns")
			.update({ deleted_at: new Date().toISOString() })
			.eq("id", id)
			.is("deleted_at", null);
		if (error) throw error;
		return;
	}
	const db = await getDb();
	await db.execute(
		"UPDATE burns SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL",
		[id],
	);
}

export async function applyRemoteBurn(burn: Burn): Promise<void> {
	if (!isTauri()) return;
	const db = await getDb();
	await db.execute(
		`INSERT OR REPLACE INTO burns
     (id, climb_id, user_id, date, outcome, notes, feel,
      created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			burn.id,
			burn.climb_id,
			burn.user_id,
			burn.date,
			burn.outcome,
			burn.notes ?? null,
			burn.feel ?? null,
			burn.created_at,
			burn.updated_at,
			burn.deleted_at ?? null,
		],
	);
}
